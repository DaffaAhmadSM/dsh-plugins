# Adding a plugin

Each plugin lives in `plugins/<plugin>/` and is an independent npm package. A package is installable when it declares `dsh.bundle` and ships a `cordis.patch.yml` that inserts its own row.

## Checklist

1. Copy `plugins/screen-lock` to `plugins/<plugin>`.
2. Rename the package to `@daffaahmadsm/dsh-<plugin>` and bump `version` to `1.0.0`.
3. Rename the row id in `cordis.patch.yml` and point `name` at the new package.
4. Update the `window.__ModuleLoader__.load({ id: ... })` id in `client.js` to match the package name exactly.
5. Update `package.json` `repository.directory`, `files`, `icon`, and the README. Keep `LICENSE` in the package.
6. Run `npm run check`.
7. Test a local install and the Web UI.
8. Commit, then tag `<plugin>-v1.0.0` and push the tag.

## Package shape

```json
{
  "name": "@daffaahmadsm/dsh-example",
  "version": "1.0.0",
  "description": "One sentence.",
  "license": "MIT",
  "type": "module",
  "main": "index.js",
  "icon": "./icon.svg",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg",
    "./package.json": "./package.json"
  },
  "files": ["index.js", "client.js", "cordis.patch.yml", "locale/*.json", "icon.svg", "README.md", "LICENSE"],
  "engines": { "dsh": ">=0.0.0-0" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": ["@deepseek-ai/dsh-client-ui-layout"]
    }
  },
  "publishConfig": { "access": "public" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/DaffaAhmadSM/dsh-plugins.git",
    "directory": "plugins/example"
  }
}
```

## Rules

- Keep `engines.dsh` at `>=0.0.0-0`. The repository installs on any DSH version.
- Do not add `@deepseek-ai/*` dependencies or peer dependencies. Importing a host package couples the plugin to one DSH version and can shadow the host's copy.
- Do not add `scripts`, especially `prepare`. GitHub and tarball installs must not need build approval.
- Prefer plain committed JavaScript. If a plugin genuinely needs a build, it must ship its built output in the package and the install paths in the README must be updated.
- Host code goes in `index.js`; browser code goes in `client.js`. The browser loader id must equal the package name.
- Add every runtime file to `files`, or the packed tarball will omit it.
- Keep the plugin's `README.md` install link in sync with its version.

## Verify

```sh
npm run check
npm pack ./plugins/<plugin>
```

Then install the tarball into a throwaway profile:

```sh
export DSH_HOME="$(mktemp -d)"
dsh plugin --profile test add ./dsh-<plugin>-1.0.0.tgz
dsh --profile test --dump-config | grep <plugin>
```

Finally, install it in the Web GUI and confirm the new row appears under **Plugins** and can be enabled.
