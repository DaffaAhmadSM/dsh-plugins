/**
 * RTK integration for DeepSeek Harness.
 *
 * DSH deliberately cannot rewrite tool arguments in `tools/pre-execute`, so
 * this plugin decorates the mounted `ctx.shell` executor instead. Every agent
 * shell command is offered to `rtk rewrite`; a returned rewrite replaces the
 * command string before the executor sees it. RTK remains an external binary:
 * this package bundles no RTK code and adds no permissions.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const REWRITE_TIMEOUT_MS = 2000
const MAX_BUFFER = 1024 * 1024
// Cordis exposes the raw service instance behind its traceable service proxy.
// The symbol is global, so the plugin needs no Cordis import or peer package.
const SERVICE_TARGET = Symbol.for('cordis.original')

/** Cordis plugin name. */
export const name = 'rtk'
/** The shell executor is the only required service. */
export const inject = ['shell']

class RtkDenied extends Error {
  constructor(message) {
    super(message)
    this.name = 'RtkDenied'
    this.rtkDenied = true
  }
}

function clean(text) {
  return typeof text === 'string' ? text.trimEnd() : ''
}

function alreadyRtk(command) {
  return /^\s*rtk(?:\s|$)/.test(command)
}

/**
 * Offer one command to `rtk rewrite` and return the replacement, or null when
 * the command should run unchanged.
 *
 * Exit codes are RTK's hook contract: 0 and 3 carry a rewrite, 1 carries none,
 * 2 is a deny. Failures other than a deny fail open so a missing or broken RTK
 * never stops the agent from running commands.
 */
function createRewriter(logger) {
  const binary = process.env.DSH_RTK_BIN?.trim() || 'rtk'
  let missing = false
  let warnedMissing = false

  return async function rewrite(command, signal, workdir) {
    if (missing) return null

    try {
      const { stdout } = await execFileAsync(binary, ['rewrite', command], {
        cwd: workdir,
        timeout: REWRITE_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
        encoding: 'utf8',
        ...(signal === undefined ? {} : { signal }),
      })
      return clean(stdout) || null
    } catch (error) {
      if (error?.code === 'ENOENT') {
        missing = true
        if (!warnedMissing) {
          warnedMissing = true
          logger?.warn?.(
            `rtk: ${binary} was not found; shell commands will run without RTK filtering`,
          )
        }
        return null
      }

      if (error?.code === 2) {
        const detail = clean(`${error.stdout ?? ''}${error.stderr ?? ''}`)
        throw new RtkDenied(
          detail.length > 0 ? `rtk denied the command: ${detail}` : 'rtk denied the command',
        )
      }

      if (error?.code === 3) {
        return clean(error.stdout) || null
      }

      return null
    }
  }
}

/**
 * Wrap `ctx.shell.execute`. The wrapper keeps the original executor's
 * background handles, sandbox policy, output budgets, and job integration
 * because it delegates the resolved spec unchanged apart from `command`.
 */
export function apply(ctx) {
  const rewrite = createRewriter(ctx.logger)

  ctx.effect(() => {
    const service = ctx.shell[SERVICE_TARGET] ?? ctx.shell
    const original = service.execute

    const wrapped = async function executeWithRtk(spec) {
      if (process.env.DSH_RTK_DISABLED === '1') return original.call(this, spec)

      // Only agent shell calls carry a session id. This leaves internal
      // plugin-to-shell calls untouched, where a compressed result could
      // break a caller that parses the command's output.
      if (spec?.dshEnv?.DSH_SESSION_ID === undefined) return original.call(this, spec)

      const command = spec.command
      if (typeof command !== 'string' || command.trim().length === 0 || alreadyRtk(command)) {
        return original.call(this, spec)
      }

      let next = command
      try {
        const rewritten = await rewrite(command, spec.signal, spec.workdir)
        if (rewritten !== null) next = rewritten
      } catch (error) {
        if (error?.rtkDenied === true) throw new Error(error.message)
        ctx.logger?.warn?.(`rtk: rewrite failed, running the original command: ${String(error)}`)
      }

      return original.call(this, next === command ? spec : { ...spec, command: next })
    }

    try {
      service.execute = wrapped
    } catch (error) {
      throw new Error(
        'rtk: cannot install the shell rewrite wrapper because ctx.shell.execute is not writable',
        { cause: error },
      )
    }
    if (service.execute !== wrapped) {
      throw new Error(
        'rtk: cannot install the shell rewrite wrapper because ctx.shell.execute is not writable',
      )
    }

    return () => {
      if (service.execute !== wrapped) return
      delete service.execute
      if (service.execute !== original) service.execute = original
    }
  })
}
