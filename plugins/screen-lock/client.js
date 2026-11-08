window.__ModuleLoader__.load({
  id: '@daffaahmadsm/dsh-screen-lock',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const STORAGE_KEY = 'dsh.screen-lock.v1';
    const MIN_LENGTH = 6;
    const ITERATIONS = 310000;

    function toBase64(bytes) {
      let binary = '';
      const view = new Uint8Array(bytes);
      for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
      return btoa(binary);
    }

    function fromBase64(text) {
      const binary = atob(text);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    function readRecord() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
          !parsed ||
          typeof parsed.hash !== 'string' ||
          typeof parsed.salt !== 'string' ||
          typeof parsed.iterations !== 'number' ||
          parsed.iterations < 1
        ) {
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    }

    function writeRecord(record) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    }

    async function derive(password, salt, iterations) {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
      );
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        key,
        256,
      );
      return new Uint8Array(bits);
    }

    function equalBytes(left, right) {
      if (left.length !== right.length) return false;
      let difference = 0;
      for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
      return difference === 0;
    }

    const CSS = `
.dsh-lock {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 24px;
  overflow: auto;
  pointer-events: auto;
  color: var(--dsw-alias-label-primary, #f4f4f5);
  background-color: var(--dsw-alias-bg-base, #101014);
  background-image: radial-gradient(900px 520px at 50% -12%,
    color-mix(in srgb, var(--dsw-alias-brand-primary, #5b8cff) 20%, transparent),
    transparent 62%);
  -webkit-font-smoothing: antialiased;
}
.dsh-lock-card {
  box-sizing: border-box;
  width: min(92vw, 392px);
  padding: 34px 30px 24px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
  border-radius: 18px;
  background: var(--dsw-alias-bg-layer-1, #17171d);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  animation: dsh-lock-in 220ms ease-out;
}
@keyframes dsh-lock-in {
  from { opacity: 0; transform: translateY(8px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-lock-card { animation: none; }
}
.dsh-lock-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: 18px;
  border-radius: 12px;
  color: var(--dsw-alias-brand-primary, #5b8cff);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #5b8cff) 14%, transparent);
}
.dsh-lock-title {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--dsw-alias-label-primary, #f4f4f5);
}
.dsh-lock-subtitle {
  margin: 8px 0 22px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary, #a1a1aa);
}
.dsh-lock-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, #a1a1aa);
}
.dsh-lock-label + .dsh-lock-field { margin-bottom: 14px; }
.dsh-lock-field { position: relative; }
.dsh-lock-input {
  box-sizing: border-box;
  width: 100%;
  height: 42px;
  padding: 0 42px 0 12px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.14));
  border-radius: 10px;
  outline: none;
  background: var(--dsw-alias-bg-layer-2, #1e1e25);
  color: var(--dsw-alias-label-primary, #f4f4f5);
  font: inherit;
  font-size: 14px;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.dsh-lock-input::placeholder { color: var(--dsw-alias-state-idle-primary, #71717a); }
.dsh-lock-input:focus {
  border-color: var(--dsw-alias-brand-primary, #5b8cff);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #5b8cff) 24%, transparent);
}
.dsh-lock-input:disabled { opacity: 0.65; }
.dsh-lock-eye {
  position: absolute;
  top: 50%;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  transform: translateY(-50%);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #a1a1aa);
  cursor: pointer;
}
.dsh-lock-eye:hover { background: var(--dsw-alias-bg-layer-1, #17171d); }
.dsh-lock-error {
  margin: 0 0 12px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--dsw-alias-state-error-primary, #f87171);
}
.dsh-lock-submit {
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  margin-top: 4px;
  border: 0;
  border-radius: 10px;
  background: var(--dsw-alias-brand-primary, #4f7cff);
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 120ms ease;
}
.dsh-lock-submit:hover:not(:disabled) { filter: brightness(1.08); }
.dsh-lock-submit:disabled { opacity: 0.6; cursor: default; }
.dsh-lock-hint {
  margin: 16px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
  text-align: center;
  color: var(--dsw-alias-label-secondary, #a1a1aa);
}
`;

    const EYE_OPEN = h(
      'svg',
      { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': true },
      h('path', {
        d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinejoin: 'round',
      }),
      h('circle', { cx: 12, cy: 12, r: 3, stroke: 'currentColor', strokeWidth: 1.6 }),
    );

    const EYE_CLOSED = h(
      'svg',
      { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': true },
      h('path', {
        d: 'M3 3l18 18M10.6 6.2A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17.6 17.6 0 0 1-3.2 3.8M6.4 7.6A17.7 17.7 0 0 0 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.7-.7',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
    );

    function LockScreen() {
      const [record, setRecord] = React.useState(readRecord);
      const [unlocked, setUnlocked] = React.useState(false);
      const [password, setPassword] = React.useState('');
      const [confirmation, setConfirmation] = React.useState('');
      const [revealed, setRevealed] = React.useState(false);
      const [error, setError] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const inputRef = React.useRef(null);
      const overlayRef = React.useRef(null);

      const setup = record === null;

      React.useEffect(() => {
        if (unlocked) return undefined;
        const timer = window.setTimeout(() => {
          if (inputRef.current) inputRef.current.focus();
        }, 0);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          window.clearTimeout(timer);
          document.body.style.overflow = previousOverflow;
        };
      }, [unlocked, setup]);

      React.useEffect(() => {
        if (unlocked) return undefined;
        const guard = (event) => {
          const overlay = overlayRef.current;
          if (!overlay) return;
          if (event.type === 'keydown' && event.key === 'Tab') {
            const focusables = overlay.querySelectorAll(
              'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (focusables.length > 0) {
              event.preventDefault();
              event.stopPropagation();
              const current = Array.prototype.indexOf.call(
                focusables,
                document.activeElement,
              );
              const step = event.shiftKey ? -1 : 1;
              const next =
                current === -1
                  ? 0
                  : (current + step + focusables.length) % focusables.length;
              focusables[next].focus();
            }
            return;
          }
          if (event.target instanceof Node && overlay.contains(event.target)) return;
          event.stopPropagation();
        };
        window.addEventListener('keydown', guard, true);
        window.addEventListener('keypress', guard, true);
        window.addEventListener('keyup', guard, true);
        return () => {
          window.removeEventListener('keydown', guard, true);
          window.removeEventListener('keypress', guard, true);
          window.removeEventListener('keyup', guard, true);
        };
      }, [unlocked]);

      if (unlocked) return null;

      async function handleSubmit(event) {
        event.preventDefault();
        if (busy) return;

        if (setup) {
          if (password.length < MIN_LENGTH) {
            setError('Use at least ' + MIN_LENGTH + ' characters.');
            return;
          }
          if (password !== confirmation) {
            setError('The two passwords do not match.');
            return;
          }
          setBusy(true);
          setError('');
          try {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const hash = await derive(password, salt, ITERATIONS);
            const next = {
              v: 1,
              salt: toBase64(salt),
              hash: toBase64(hash),
              iterations: ITERATIONS,
              createdAt: new Date().toISOString(),
            };
            writeRecord(next);
            setRecord(next);
            setPassword('');
            setConfirmation('');
            setUnlocked(true);
          } catch {
            setError('This browser could not store the password.');
          } finally {
            setBusy(false);
          }
          return;
        }

        setBusy(true);
        setError('');
        try {
          const hash = await derive(password, fromBase64(record.salt), record.iterations);
          if (!equalBytes(hash, fromBase64(record.hash))) {
            setError('Incorrect password.');
            setPassword('');
            if (inputRef.current) inputRef.current.focus();
            return;
          }
          setPassword('');
          setUnlocked(true);
        } catch {
          setError('This browser could not verify the password.');
        } finally {
          setBusy(false);
        }
      }

      return h(
        React.Fragment,
        null,
        h('style', null, CSS),
        h(
          'div',
          {
            className: 'dsh-lock',
            ref: overlayRef,
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': setup ? 'Set a screen lock password' : 'Unlock DeepSeek Harness',
          },
          h(
            'form',
            { className: 'dsh-lock-card', onSubmit: handleSubmit, noValidate: true },
            h(
              'div',
              { className: 'dsh-lock-icon', 'aria-hidden': 'true' },
              h(
                'svg',
                { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none' },
                h('rect', {
                  x: 4.5,
                  y: 10,
                  width: 15,
                  height: 10.5,
                  rx: 2.4,
                  stroke: 'currentColor',
                  strokeWidth: 1.7,
                }),
                h('path', {
                  d: 'M8 10V7.5a4 4 0 0 1 8 0V10',
                  stroke: 'currentColor',
                  strokeWidth: 1.7,
                  strokeLinecap: 'round',
                }),
                h('circle', { cx: 12, cy: 15, r: 1.5, fill: 'currentColor' }),
              ),
            ),
            h('h1', { className: 'dsh-lock-title' }, 'DeepSeek Harness'),
            h(
              'p',
              { className: 'dsh-lock-subtitle' },
              setup
                ? 'Set a password. It is asked for every time this GUI is opened in this browser.'
                : 'Enter your password to continue.',
            ),
            h(
              'label',
              { className: 'dsh-lock-label', htmlFor: 'dsh-lock-password' },
              'Password',
            ),
            h(
              'div',
              { className: 'dsh-lock-field' },
              h('input', {
                id: 'dsh-lock-password',
                ref: inputRef,
                className: 'dsh-lock-input',
                type: revealed ? 'text' : 'password',
                value: password,
                autoComplete: setup ? 'new-password' : 'current-password',
                autoFocus: true,
                spellCheck: false,
                disabled: busy,
                placeholder: setup ? 'At least ' + MIN_LENGTH + ' characters' : 'Password',
                onChange: (event) => {
                  setPassword(event.target.value);
                  if (error) setError('');
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-lock-eye',
                  onClick: () => setRevealed((value) => !value),
                  'aria-label': revealed ? 'Hide password' : 'Show password',
                  tabIndex: -1,
                },
                revealed ? EYE_CLOSED : EYE_OPEN,
              ),
            ),
            setup
              ? h(
                  React.Fragment,
                  null,
                  h(
                    'label',
                    { className: 'dsh-lock-label', htmlFor: 'dsh-lock-confirm' },
                    'Confirm password',
                  ),
                  h(
                    'div',
                    { className: 'dsh-lock-field' },
                    h('input', {
                      id: 'dsh-lock-confirm',
                      className: 'dsh-lock-input',
                      type: revealed ? 'text' : 'password',
                      value: confirmation,
                      autoComplete: 'new-password',
                      spellCheck: false,
                      disabled: busy,
                      placeholder: 'Repeat the password',
                      onChange: (event) => {
                        setConfirmation(event.target.value);
                        if (error) setError('');
                      },
                    }),
                  ),
                )
              : null,
            error
              ? h('p', { className: 'dsh-lock-error', role: 'alert' }, error)
              : null,
            h(
              'button',
              { className: 'dsh-lock-submit', type: 'submit', disabled: busy },
              busy ? 'Checking…' : setup ? 'Set password' : 'Unlock',
            ),
            h(
              'p',
              { className: 'dsh-lock-hint' },
              setup
                ? 'The password is stored in this browser only.'
                : 'Forgot it? Clear this site’s data to set a new password.',
            ),
          ),
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'screen-lock', order: -1000 },
            LockScreen,
          ),
        );
      },
    };
  },
});
