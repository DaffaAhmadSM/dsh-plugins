import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { apply } from './index.js'

if (process.platform === 'win32') {
  console.log('rtk tests: skipped on Windows (fake rtk uses /bin/sh)')
  process.exit(0)
}

const dir = mkdtempSync(join(process.cwd(), '.rtk-test-'))
const fake = join(dir, 'rtk')

writeFileSync(
  fake,
  `#!/bin/sh
case "$2" in
  *deny*) printf 'blocked by test policy\\n' >&2; exit 2;;
  *none*) exit 1;;
  *allow*) printf 'rtk %s' "$2"; exit 0;;
  *) printf 'rtk %s' "$2"; exit 3;;
esac
`,
  { mode: 0o755 },
)
chmodSync(fake, 0o755)

process.env.DSH_RTK_BIN = fake
delete process.env.DSH_RTK_DISABLED

function session(command) {
  return { command, dshEnv: { DSH_SESSION_ID: 'test-session' } }
}

function harness() {
  const seen = []
  const logs = []
  const disposers = []
  const original = async (spec) => {
    seen.push(spec)
    return { result: async () => ({}) }
  }
  const ctx = {
    shell: { execute: original },
    logger: {
      warn(message) {
        logs.push(message)
      },
    },
    effect(callback) {
      disposers.push(callback())
    },
  }
  apply(ctx)
  return { ctx, seen, logs, original, dispose: () => disposers.forEach((dispose) => dispose()) }
}

try {
  const test = harness()

  await test.ctx.shell.execute(session('git status'))
  assert.equal(test.seen.at(-1).command, 'rtk git status', 'rewrites a supported command')

  await test.ctx.shell.execute(session('allow me'))
  assert.equal(test.seen.at(-1).command, 'rtk allow me', 'accepts an exit-0 rewrite')

  await test.ctx.shell.execute(session('none here'))
  assert.equal(test.seen.at(-1).command, 'none here', 'passes through an exit-1 command')

  await test.ctx.shell.execute(session('rtk git status'))
  assert.equal(test.seen.at(-1).command, 'rtk git status', 'does not wrap an rtk command again')

  await test.ctx.shell.execute({ command: 'git status', dshEnv: {} })
  assert.equal(test.seen.at(-1).command, 'git status', 'skips calls without a session id')

  await assert.rejects(
    () => test.ctx.shell.execute(session('deny me')),
    /rtk denied the command: blocked by test policy/,
    'surfaces a deny',
  )

  process.env.DSH_RTK_DISABLED = '1'
  await test.ctx.shell.execute(session('git status'))
  assert.equal(test.seen.at(-1).command, 'git status', 'DSH_RTK_DISABLED passes through')
  delete process.env.DSH_RTK_DISABLED

  test.dispose()
  assert.equal(test.ctx.shell.execute, test.original, 'restores the original executor')

  process.env.DSH_RTK_BIN = join(dir, 'does-not-exist')
  const missingHarness = harness()
  await missingHarness.ctx.shell.execute(session('git status'))
  assert.equal(missingHarness.seen.at(-1).command, 'git status', 'missing rtk passes through')
  assert.match(missingHarness.logs[0], /was not found/, 'warns once when rtk is missing')
  missingHarness.dispose()

  console.log('rtk tests: ok')
} finally {
  delete process.env.DSH_RTK_BIN
  delete process.env.DSH_RTK_DISABLED
  rmSync(dir, { recursive: true, force: true })
}
