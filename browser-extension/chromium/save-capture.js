/* Isolated content script (every HTTPS frame): when the user submits a form with a
 * password, sends what was typed to the background script. The background forwards it
 * to the app only if "offer to save" is on there; the app asks for confirmation in its
 * own window and writes the vault only after the user accepts. Nothing is stored here.
 * Only fields the user really typed into count (trusted input events): values set by
 * page scripts, or by this extension's own fill (already saved), never trigger a save. */
(() => {
  const api = globalThis.browser || chrome;
  const TEXT = ['text', 'email', 'tel', 'date', 'url', 'number'];
  // Never offered for the notes: payment data, one-time codes, captchas, searches.
  const EXCLUDED = /captcha|otp|one.?time|2fa|mfa|totp|verif\w*.?code|cvv|cvc|card|iban|search|coupon|promo|voucher|token|csrf/i;
  const IDENTIFIER = /user|login|account|nick|handle/i;
  const typed = new WeakSet();
  let last = { key: '', at: 0 };

  const visible = (el) =>
    !el.disabled && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  // Inputs in document order, also inside open shadow roots (web components).
  const deepInputs = (root) => {
    const out = [];
    const walk = (node) => {
      for (const el of node.querySelectorAll('*')) {
        if (el instanceof HTMLInputElement) out.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(root);
    return out;
  };
  const token = (el) => (el.getAttribute('autocomplete') || '').trim().toLowerCase().split(/\s+/).pop();
  const labelOf = (el) =>
    (el.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.placeholder || el.name || el.id || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
  const typedPassword = (el) =>
    el instanceof HTMLInputElement && el.type === 'password' && el.value && typed.has(el) && visible(el);
  const formOf = (start) => {
    for (let n = start; n; n = n.parentNode || n.host) if (n instanceof HTMLFormElement) return n;
    return null;
  };
  // The form, or for forms without <form> (single-page apps) the nearest ancestor that
  // contains a password the user typed.
  const scopeFrom = (start, test) => {
    const form = formOf(start);
    if (form) return form;
    let n = start;
    for (let depth = 0; n && depth < 12; depth++, n = n.parentNode || n.host) {
      if ((n instanceof Element || n instanceof ShadowRoot) && deepInputs(n).some(test)) return n;
    }
    return null;
  };

  function collect(scope) {
    const inputs = deepInputs(scope).filter(visible);
    const passwords = inputs.filter((el) => el.type === 'password' && el.value);
    if (!passwords.some(typedPassword) || passwords.length > 3) return null;
    const fresh = passwords.filter((el) => token(el) === 'new-password');
    const current = passwords.find((el) => token(el) === 'current-password');
    let password = '',
      old = '',
      signup = false;
    if (fresh.length) {
      // Sign-up (new password + confirmation) or change (current + new).
      if (fresh.some((el) => el.value !== fresh[0].value)) return null;
      password = fresh[0].value;
      old = current?.value || '';
      signup = !current;
    } else if (passwords.length === 1) {
      password = passwords[0].value;
    } else if (passwords.length === 2) {
      // Password and confirmation; two different values without hints are ambiguous.
      if (passwords[0].value !== passwords[1].value) return null;
      password = passwords[0].value;
      signup = true;
    } else {
      // Current, new and confirmation.
      if (passwords[1].value !== passwords[2].value) return null;
      [old, password] = [passwords[0].value, passwords[1].value];
    }
    if (old && old === password) return null;
    const fields = [];
    for (const el of inputs) {
      if (fields.length >= 12) break;
      const auto = token(el);
      if (!TEXT.includes(el.type) || !el.value.trim() || el.value.length > 200) continue;
      if (auto.startsWith('cc-') || EXCLUDED.test(`${el.name} ${el.id} ${auto}`)) continue;
      fields.push({ el, label: labelOf(el), auto, type: el.type, value: el.value.trim() });
    }
    // The login identifier: declared username, then a username-like name, then email,
    // then the last text field before the password.
    const score = (f) =>
      f.auto === 'username'
        ? 3
        : f.type !== 'email' && IDENTIFIER.test(`${f.el.name} ${f.el.id}`)
          ? 2
          : f.auto === 'email' || f.type === 'email'
            ? 1
            : 0;
    let user = -1,
      best = 0;
    fields.forEach((f, i) => {
      if (score(f) > best) [best, user] = [score(f), i];
    });
    const first = inputs.indexOf(passwords[0]);
    if (user < 0) {
      for (let i = fields.length - 1; i >= 0; i--) {
        if (inputs.indexOf(fields[i].el) < first && ['text', 'email', 'tel'].includes(fields[i].type)) {
          user = i;
          break;
        }
      }
    }
    return { password, old, signup, user, fields: fields.map(({ el, ...f }) => f) };
  }

  // First step of a two-step login: only the identifier, kept by the background for
  // a few minutes so the password step can be saved with it.
  function rememberIdentifier(start) {
    const scope = scopeFrom(start, (el) => el.value && TEXT.includes(el.type));
    if (!scope) return;
    const inputs = deepInputs(scope).filter(visible);
    if (inputs.some((el) => el.type === 'password')) return;
    // Only fields that are clearly an identifier (never a search box or a comment).
    const ids = inputs.filter(
      (el) =>
        ['text', 'email', 'tel'].includes(el.type) &&
        el.value.trim() &&
        el.value.length <= 200 &&
        !EXCLUDED.test(`${el.name} ${el.id} ${token(el)}`) &&
        (el.type === 'email' ||
          ['username', 'email'].includes(token(el)) ||
          /user|login|account|mail|nick|handle/i.test(`${el.name} ${el.id}`)),
    );
    if (ids.length === 1 && (typed.has(ids[0]) || ids[0].readOnly)) {
      api.runtime.sendMessage({ kind: 'save-user', value: ids[0].value.trim() }).catch(() => {});
    }
  }

  function attempt(start) {
    if (!(start instanceof Node)) return;
    const scope = scopeFrom(start, typedPassword);
    const data = scope && collect(scope);
    if (!data) {
      rememberIdentifier(start);
      return;
    }
    // Submit, click and Enter often fire together for the same form.
    const key = `${location.href}\n${data.password}\n${data.fields[data.user]?.value || ''}`;
    if (key === last.key && Date.now() - last.at < 4000) return;
    last = { key, at: Date.now() };
    api.runtime.sendMessage({ kind: 'save', ...data }).catch(() => {});
  }

  const origin = (e) => e.composedPath?.()[0] || e.target;
  for (const type of ['input', 'paste', 'keydown']) {
    addEventListener(
      type,
      (e) => {
        if (e.isTrusted && origin(e) instanceof HTMLInputElement) typed.add(origin(e));
      },
      true,
    );
  }
  addEventListener('submit', (e) => attempt(origin(e)), true);
  addEventListener(
    'click',
    (e) => {
      const target = origin(e);
      if (!e.isTrusted || !(target instanceof Element)) return;
      const button = target.closest('button, input[type="submit"], input[type="button"], [role="button"]');
      if (button) attempt(button);
    },
    true,
  );
  addEventListener(
    'keydown',
    (e) => {
      if (e.isTrusted && e.key === 'Enter' && origin(e) instanceof HTMLInputElement) attempt(origin(e));
    },
    true,
  );
})();
