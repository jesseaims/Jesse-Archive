/* Isolated content script: relays WebAuthn requests of passkey-page.js to the
 * background script and the replies back to the page. It adds no data of its own;
 * the background takes the origin from the browser (sender), not from the page. */
(() => {
  const api = globalThis.browser || chrome;
  const reply = (id, result) =>
    window.postMessage({ jesseArchivePasskey: 'response', id, result: result || { action: 'fallback' } }, location.origin);
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin) return;
    if (data?.jesseArchivePasskey !== 'request' || typeof data.id !== 'string' || data.id.length > 100) return;
    const message = { kind: 'passkey', op: data.op, pageRequest: data.id, options: data.options, timeout: data.timeout };
    if (data.op === 'cancel') {
      api.runtime.sendMessage(message).catch(() => {});
      return;
    }
    if (data.op !== 'create' && data.op !== 'get') return;
    api.runtime.sendMessage(message).then(
      (result) => reply(data.id, result),
      () => reply(data.id, { action: 'fallback' }),
    );
  });
})();
