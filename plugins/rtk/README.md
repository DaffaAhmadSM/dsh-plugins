# RTK for DeepSeek Harness

Routes DeepSeek Harness shell commands through [RTK](https://github.com/rtk-ai/rtk) so the model reads compact command output instead of raw output.

## Requirements

- A DSH installation with the shell executor (`ctx.shell`).
- RTK installed and on `PATH`:

```sh
rtk --version
```

Tested with RTK `0.49.0` and DSH `0.2.2-rc.1`. This plugin does not bundle RTK; install it separately.

## Install

Copy this link:

```text
https://github.com/DaffaAhmadSM/dsh-plugins/releases/download/rtk-v0.1.0/dsh-rtk-0.1.0.tgz
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
  https://github.com/DaffaAhmadSM/dsh-plugins/releases/download/rtk-v0.1.0/dsh-rtk-0.1.0.tgz
```

From a checkout:

```sh
dsh plugin --profile web add ./plugins/rtk
```

No build approval is needed. The package ships ready-to-run JavaScript and declares no lifecycle scripts.

## How it works

DSH does not allow a hook to rewrite tool arguments. This plugin decorates the mounted `ctx.shell.execute` method instead:

1. An agent shell call arrives with its resolved spec.
2. The plugin runs `rtk rewrite "<command>"` in the host process.
3. On a rewrite, it passes the same spec to the original executor with only `command` replaced.
4. The command runs as `rtk <command>`, so RTK filters the output before the model reads it.

The wrapper delegates to the mounted executor, so sandboxing, timeouts, output budgets, background jobs, and job controls still come from DSH. It restores the original method when the plugin unloads.

Only agent shell calls are rewritten. Calls made internally by other DSH plugins do not carry `DSH_SESSION_ID` and pass through unchanged.

### RTK exit codes

- `0` or `3` with output: run the rewrite.
- `1`: RTK has no rewrite; run the original command.
- `2`: RTK denied the command; the tool fails with RTK's message.
- Missing RTK, timeout, abort, or another error: fail open and run the original command.

Exit `3` is normal when no Claude Code permission rules exist. DSH's own sandbox and approval policy already decided on the original command. RTK deny rules are honored; RTK ask rules are not re-prompted.

## Configuration

| Variable | Meaning |
| --- | --- |
| `DSH_RTK_BIN` | Path or name of the RTK binary. Default `rtk`. |
| `DSH_RTK_DISABLED=1` | Pass commands through without RTK for this process. |
| `RTK_DISABLED=1` | Prefix one command, for example `RTK_DISABLED=1 git status`, to run it raw. |
| `rtk bypass <command>` | Run one command unfiltered but still tracked by RTK. |

If the DSH process cannot find `rtk` on its `PATH`, set an absolute path:

```sh
DSH_RTK_BIN=/home/you/.cargo/bin/rtk dsh web
```

## Limits

- Applies to shell commands routed through `ctx.shell` (the normal `bash`/`pwsh` tool), including background jobs and subagents.
- DSH's built-in `read`, `grep`, and `glob` tools do not use the shell and do not pass through RTK.
- Persistent terminal tools do not use `ctx.shell` and are not covered.
- RTK decides what to rewrite. Commands it does not recognize, and constructs it refuses such as command substitution or file redirects, run unchanged.
- An already-prefixed `rtk` command is not wrapped again.
- On Windows the plugin calls `rtk.exe` through the same seam; it has not been exercised in this repository's Linux-only CI.

## Security

- RTK runs as the same user and inside the same DSH sandbox as the original command. The plugin adds no permissions.
- `rtk rewrite` runs in the DSH host process and returns a command string; it does not execute the user's command.
- RTK's telemetry is off by default and this plugin sends nothing.

## Uninstall

In **Plugins**, open the bundle and select **Remove**. With the CLI:

```sh
dsh plugin --profile web remove @daffaahmadsm/dsh-rtk
```

## Development

`index.js` is plain JavaScript and imports only Node built-ins. From the repository root:

```sh
npm run check
npm test
```

`test.mjs` uses a fake `rtk` executable to verify rewrite, pass-through, deny, disable, missing-binary, session-gating, and disposer behavior.

## License

MIT. RTK is a separate project under its own Apache-2.0/BUSL-1.1 terms.
