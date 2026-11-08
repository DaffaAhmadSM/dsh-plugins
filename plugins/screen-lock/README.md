# Screen lock

Asks for a password every time the DeepSeek Harness Web GUI is opened in a browser. The password is set on first use and stored only in that browser.

## Install

Copy this link:

```text
https://github.com/DaffaAhmadSM/dsh-plugins/releases/download/screen-lock-v1.0.0/dsh-screen-lock-1.0.0.tgz
```

Then:

1. Open **Plugins** in the DSH sidebar.
2. Select **Add plugin**.
3. Paste the link.
4. Select **Install**, then **Enable now**.
5. Reload the GUI.

With the CLI:

```sh
dsh plugin --profile web add \
  https://github.com/DaffaAhmadSM/dsh-plugins/releases/download/screen-lock-v1.0.0/dsh-screen-lock-1.0.0.tgz
```

From a checkout:

```sh
dsh plugin --profile web add ./plugins/screen-lock
```

No build approval is needed. The package ships ready-to-run JavaScript and declares no lifecycle scripts.

## Use

- On the first load, set a password of at least 6 characters and confirm it.
- On every later load in that browser, enter the password to pass the overlay.
- The eye button reveals the password while typing.
- The password is local to the browser profile; another browser or machine asks for its own.

## Reset

The lock is stored in `localStorage` under `dsh.screen-lock.v1`. To reset it, clear that key or the site's data in the browser, then reload. The next load asks you to set a new password.

## Security model

This is a **privacy screen, not encryption**.

- It stores a PBKDF2-SHA-256 hash and salt in `localStorage`; the password itself is never stored.
- The overlay is rendered by the page. Anyone with browser developer tools can remove it, edit `localStorage`, or call the DSH API directly.
- It does not encrypt session content, files, credentials, or network traffic.
- It is not a substitute for locking your operating system or protecting the DSH profile.

Use it to stop a casual observer from reading the screen.

## Compatibility

The package declares `"engines": { "dsh": ">=0.0.0-0" }` and no `@deepseek-ai/*` peer dependencies, so DSH does not block installation on any published version. The host half imports nothing; the browser half uses the public `slots` service. Tested with DSH `0.2.2-rc.1`.

A non-Web profile ignores the browser half and runs the empty host half, so installing it elsewhere is harmless.

## Uninstall

In **Plugins**, open the bundle and select **Remove**. With the CLI:

```sh
dsh plugin --profile web remove @daffaahmadsm/dsh-screen-lock
```

Removing the plugin does not remove the stored hash; clear the site data if you want to reset it.

## Development

The package is plain JavaScript, with no build step.

- `index.js` is the empty host half.
- `client.js` is the browser half, registered through `window.__ModuleLoader__`.
- `cordis.patch.yml` inserts the `screen-lock` row.

From the repository root, run `npm run check`.

## License

MIT
