#!/usr/bin/env node
// Repository checks for dsh-plugins. Dependency-free on purpose: a plugin
// package must be installable without a build step, so the checks must run
// without installing anything.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import vm from 'node:vm'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PLUGINS = join(ROOT, 'plugins')
const SCOPE = '@daffaahmadsm/'
const NAME = /^@daffaahmadsm\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const REQUIRED_FILES = ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'README.md']

function fail(message) {
  throw new Error(message)
}

function readJson(path) {
  const raw = readFileSync(path, 'utf8')
  if (raw.charCodeAt(0) === 0xfeff) fail(`${path}: UTF-8 BOM is not allowed`)
  try {
    return JSON.parse(raw)
  } catch (error) {
    fail(`${path}: invalid JSON: ${error.message}`)
  }
}

function patternExists(dir, pattern) {
  if (!pattern.includes('*')) return existsSync(join(dir, pattern))
  const slash = pattern.lastIndexOf('/')
  const folder = slash === -1 ? dir : join(dir, pattern.slice(0, slash))
  const suffix = pattern.slice(slash + 1).replaceAll('*', '')
  return existsSync(folder) && readdirSync(folder).some((entry) => entry.endsWith(suffix))
}

function checkManifest(dir) {
  const manifestPath = join(dir, 'package.json')
  const manifest = readJson(manifestPath)
  const folder = dir.split('/').pop()

  assert.match(manifest.name, NAME, `${manifestPath}: name must match ${SCOPE}dsh-<kebab-name>`)
  assert.equal(
    manifest.name.slice(SCOPE.length + 'dsh-'.length),
    folder,
    `${manifestPath}: package name must match its folder (${folder})`,
  )
  assert.match(manifest.version, VERSION, `${manifestPath}: version must be semver`)
  assert.equal(manifest.private, undefined, `${manifestPath}: remove "private"`)
  assert.equal(manifest.scripts, undefined, `${manifestPath}: lifecycle scripts are not allowed`)
  assert.equal(
    manifest.engines?.dsh,
    '>=0.0.0-0',
    `${manifestPath}: engines.dsh must be ">=0.0.0-0"`,
  )
  assert.equal(manifest.license, 'MIT', `${manifestPath}: license must be MIT`)
  assert.equal(manifest.type, 'module', `${manifestPath}: type must be module`)
  assert.equal(manifest.publishConfig?.access, 'public', `${manifestPath}: publishConfig.access`)
  assert.match(
    manifest.repository?.url ?? '',
    /github\.com\/DaffaAhmadSM\/dsh-plugins/,
    `${manifestPath}: repository.url`,
  )
  assert.equal(
    manifest.repository?.directory,
    `plugins/${folder}`,
    `${manifestPath}: repository.directory`,
  )

  for (const section of ['dependencies', 'peerDependencies']) {
    const names = Object.keys(manifest[section] ?? {})
    assert.deepEqual(
      names.filter((name) => name.startsWith('@deepseek-ai/')),
      [],
      `${manifestPath}: ${section} must not contain DSH packages`,
    )
  }

  const patch = manifest.dsh?.bundle?.patch
  assert.equal(typeof patch, 'string', `${manifestPath}: dsh.bundle.patch is required`)
  assert.ok(existsSync(join(dir, patch)), `${manifestPath}: bundle patch ${patch} does not exist`)

  const client = manifest.dsh?.client
  assert.equal(client?.platform, 'web', `${manifestPath}: dsh.client.platform must be web`)
  assert.ok(Array.isArray(client?.inject), `${manifestPath}: dsh.client.inject must be an array`)
  assert.match(manifest.icon ?? '', /\.svg$/, `${manifestPath}: top-level icon is required`)

  const files = manifest.files
  assert.ok(Array.isArray(files), `${manifestPath}: files is required`)
  for (const required of REQUIRED_FILES) {
    assert.ok(files.includes(required), `${manifestPath}: files must include ${required}`)
    assert.ok(existsSync(join(dir, required)), `${manifestPath}: missing ${required}`)
  }
  for (const pattern of files) {
    assert.ok(patternExists(dir, pattern), `${manifestPath}: files entry ${pattern} does not exist`)
  }

  for (const value of Object.values(manifest.exports ?? {})) {
    if (typeof value === 'string' && !value.includes('*')) {
      assert.ok(existsSync(join(dir, value)), `${manifestPath}: export ${value} does not exist`)
    }
  }

  const patchText = readFileSync(join(dir, patch), 'utf8')
  assert.ok(patchText.length > 0, `${manifestPath}: bundle patch is empty`)
  assert.ok(
    patchText.includes(`'${manifest.name}'`) || patchText.includes(`"${manifest.name}"`),
    `${manifestPath}: bundle patch does not reference ${manifest.name}`,
  )

  return manifest
}

function checkJavaScript(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      checkJavaScript(join(dir, entry.name))
      continue
    }
    if (!entry.name.endsWith('.js')) continue
    const path = join(dir, entry.name)
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' })
  }
}

function checkClient(dir, manifest) {
  const source = readFileSync(join(dir, 'client.js'), 'utf8')
  assert.ok(!/^\s*(?:import|export)\s/m.test(source), `${dir}: client.js must not use ESM import/export`)

  const registrations = []
  const React = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
  }

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    TextEncoder,
    TextDecoder,
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    crypto: globalThis.crypto,
    window: {
      __ModuleLoader__: {
        load(entry) {
          registrations.push(entry)
        },
      },
    },
  }

  vm.runInNewContext(source, sandbox, { filename: join(dir, 'client.js'), timeout: 5000 })

  assert.equal(registrations.length, 1, `${dir}: client.js must register exactly one factory`)
  const [{ id, factory }] = registrations
  assert.equal(id, manifest.name, `${dir}: client factory id must equal the package name`)
  assert.equal(typeof factory, 'function', `${dir}: client factory must be a function`)

  const require = (request) => {
    if (request === 'react') return React
    throw new Error(`unexpected client require(${JSON.stringify(request)})`)
  }

  const client = factory(require)
  assert.equal(typeof client?.apply, 'function', `${dir}: client module must export apply`)
  assert.ok(Array.isArray(client.inject), `${dir}: client module must export inject`)
  assert.ok(client.inject.includes('slots'), `${dir}: client must inject slots`)

  const calls = { inject: [], register: [] }
  client.apply({
    slots: {
      inject(name, callback) {
        calls.inject.push(name)
        callback()
      },
      register(definition, component) {
        calls.register.push({ definition, component })
      },
    },
  })

  assert.ok(calls.inject.includes('shell.overlay'), `${dir}: client must inject shell.overlay`)
  assert.equal(calls.register.length, 1, `${dir}: client must register one overlay`)
  assert.equal(calls.register[0].definition.name, 'shell.overlay', `${dir}: overlay name`)
  assert.equal(typeof calls.register[0].component, 'function', `${dir}: overlay component`)
}

function checkPlugin(name) {
  const dir = join(PLUGINS, name)
  const manifest = checkManifest(dir)
  checkJavaScript(dir)
  checkClient(dir, manifest)
  console.log(`ok  ${manifest.name}@${manifest.version}`)
}

function main() {
  if (!existsSync(PLUGINS)) fail(`missing ${PLUGINS}`)
  const plugins = readdirSync(PLUGINS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  if (plugins.length === 0) fail('no plugins found')

  for (const plugin of plugins) checkPlugin(plugin)
  console.log(`\n${plugins.length} plugin(s) passed.`)
}

try {
  main()
} catch (error) {
  console.error(`\ncheck failed: ${error.message}`)
  process.exitCode = 1
}
