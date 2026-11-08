# dsh-plugins

Plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), packaged as independent bundles and installable by pasting a release link into the Web GUI.

## Plugins

| Plugin | What it does | Copy-paste install link |
| --- | --- | --- |
| [RTK](./plugins/rtk) | Compresses shell command output through RTK before the model reads it. Requires RTK installed separately. | `https://github.com/DaffaAhmadSM/dsh-plugins/releases/download/rtk-v0.1.0/dsh-rtk-0.1.0.tgz` |
| [Screen lock](./plugins/screen-lock) | Asks for a password every time the Web GUI is opened. | `https://github.com/DaffaAhmadSM/dsh-plugins/releases/download/screen-lock-v1.0.0/dsh-screen-lock-1.0.0.tgz` |

Each plugin is its own package. Installing one does not install the others.

## Install in the Web GUI

1. Open **Plugins** in the sidebar.
2. Select **Add plugin**.
3. Paste the plugin's install link from the table above.
4. Select **Install**, then **Enable now**.
5. Reload the GUI.

The same link also works with the CLI:

```sh
dsh plugin --profile web add \
  https://github.com/DaffaAhmadSM/dsh-plugins/releases/download/screen-lock-v1.0.0/dsh-screen-lock-1.0.0.tgz
```

Replace `web` with the profile you run. No build approval is needed: the published tarballs contain ready-to-run JavaScript and declare no lifecycle scripts.

### Other install sources

Directly from GitHub (uses the current default branch, so it can change):

```sh
dsh plugin --profile web add "github:DaffaAhmadSM/dsh-plugins#path:/plugins/screen-lock"
```

Pin a commit for a reproducible install:

```sh
dsh plugin --profile web add "github:DaffaAhmadSM/dsh-plugins#<commit-sha>&path:/plugins/screen-lock"
```

From a local checkout:

```sh
dsh plugin --profile web add ./plugins/screen-lock
```

Quote specs containing `#` in shells that treat it as a comment character.

## Compatibility

Every package declares:

```json
"engines": { "dsh": ">=0.0.0-0" }
```

DSH enforces `engines.dsh` alone when it is present, and this range accepts every published DSH version, including prereleases. The packages declare no `@deepseek-ai/*` peer dependencies, so there is no exact-version whitelist to update when DSH releases.

The host halves import nothing from DSH. The browser halves use only the public `slots` service and the baseline `react` module. The Web UI has been tested with DSH `0.2.2-rc.1`; a future DSH change to the client slot contract would need a new plugin release, but it will not block installation.

## Security

Screen lock is a **client-side privacy gate, not encryption**. It stores a PBKDF2 hash in the browser's `localStorage`. Anyone with access to the browser's developer tools can remove or bypass the overlay, and the lock does not protect session data, the DSH API, or the files on disk. Use it to keep a casual observer from reading the screen, not as a security boundary. See [its README](./plugins/screen-lock/README.md) for details.

RTK is a separate external binary. The plugin adds no permissions and sends no data on its own; RTK runs inside the same sandbox as the original command, and its telemetry is off by default. See [its README](./plugins/rtk/README.md).

## Development

Requirements: Node.js 24.9 or newer, pnpm, and a DSH installation.

```sh
npm run check
npm test
```

The check validates every package manifest, patch file, JavaScript syntax, packaged file list, and any browser module's registration contract. It has no dependencies. The test exercises the RTK wrapper with a fake `rtk` binary.

Test a local install against a throwaway DSH home:

```sh
export DSH_HOME="$(mktemp -d)"
dsh plugin --profile test add ./plugins/screen-lock
dsh --profile test --dump-config | grep screen-lock
```

Layout:

```text
plugins/<plugin>/
  package.json        # dsh.bundle, plus optional dsh.client
  cordis.patch.yml    # rows this bundle inserts
  index.js            # host half
  client.js           # optional browser half, loaded through __ModuleLoader__
  README.md
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) to add a plugin.

## Releasing

Each plugin has its own tag: `<plugin>-v<version>`, for example `screen-lock-v1.0.0`.

```sh
git tag screen-lock-v1.0.0
git push origin screen-lock-v1.0.0
```

The release workflow verifies that the tag matches `plugins/<plugin>/package.json`, runs the checks, packs `dsh-<plugin>-<version>.tgz`, and attaches it to a GitHub Release. Nothing is published to npm yet.

## License

MIT
