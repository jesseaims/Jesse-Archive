/* Runs in the page (MAIN world) at document_start, top frame of HTTPS pages only.
 * Intercepts WebAuthn requests and asks Jesse's Archive through the extension
 * bridge. The page never receives anything it did not request: the reply is the
 * credential for its own challenge, or the browser's native dialog (fallback).
 * The trusted origin is taken by the background script from the browser, not
 * from this script. */
(() => {
  const container = globalThis.navigator?.credentials;
  if (window.top !== window || !container || typeof PublicKeyCredential === 'undefined') return;
  const nativeCreate = container.create.bind(container);
  const nativeGet = container.get.bind(container);
  const post = window.postMessage.bind(window);
  const listen = window.addEventListener.bind(window);
  const unlisten = window.removeEventListener.bind(window);
  const origin = location.origin;

  const toBytes = (source) => {
    if (source instanceof ArrayBuffer) return new Uint8Array(source);
    if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    throw new TypeError('BufferSource atteso');
  };
  const b64u = (source) => {
    let text = '';
    for (const byte of toBytes(source)) text += String.fromCharCode(byte);
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const buffer = (value) => {
    const text = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4));
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
    return out.buffer;
  };

  function createOptions(pk) {
    return {
      rp: { id: pk.rp?.id, name: String(pk.rp?.name || '') },
      user: { id: b64u(pk.user.id), name: String(pk.user.name || ''), displayName: String(pk.user.displayName || '') },
      challenge: b64u(pk.challenge),
      pubKeyCredParams: (pk.pubKeyCredParams || []).map((p) => ({ type: p.type, alg: p.alg })),
      excludeCredentials: (pk.excludeCredentials || []).map((c) => b64u(c.id)),
      attachment: pk.authenticatorSelection?.authenticatorAttachment,
      credProps: !!pk.extensions?.credProps,
    };
  }
  function getOptions(pk) {
    return {
      rpId: pk.rpId,
      challenge: b64u(pk.challenge),
      allowCredentials: (pk.allowCredentials || []).map((c) => b64u(c.id)),
    };
  }

  function ask(op, options, timeout, signal) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const cleanup = () => {
        unlisten('message', onMessage);
        signal?.removeEventListener('abort', onAbort);
      };
      const onMessage = (event) => {
        if (event.source !== window || event.data?.jesseArchivePasskey !== 'response' || event.data.id !== id) return;
        cleanup();
        resolve(event.data.result || { action: 'fallback' });
      };
      const onAbort = () => {
        cleanup();
        post({ jesseArchivePasskey: 'request', op: 'cancel', id }, origin);
        reject(signal.reason ?? new DOMException('Operazione annullata.', 'AbortError'));
      };
      if (signal?.aborted) return onAbort();
      listen('message', onMessage);
      signal?.addEventListener('abort', onAbort, { once: true });
      post({ jesseArchivePasskey: 'request', op, id, options, timeout }, origin);
    });
  }

  function credential(r) {
    const extensions = r.extensions || {};
    const common = { clientDataJSON: { value: buffer(r.clientDataJSON), enumerable: true } };
    let response, responseJSON;
    if (r.op === 'create') {
      response = Object.create(AuthenticatorAttestationResponse.prototype, {
        ...common,
        attestationObject: { value: buffer(r.attestationObject), enumerable: true },
        getAuthenticatorData: { value: () => buffer(r.authenticatorData) },
        getPublicKey: { value: () => buffer(r.publicKey) },
        getPublicKeyAlgorithm: { value: () => r.publicKeyAlgorithm },
        getTransports: { value: () => [...r.transports] },
      });
      responseJSON = {
        clientDataJSON: r.clientDataJSON,
        attestationObject: r.attestationObject,
        authenticatorData: r.authenticatorData,
        publicKey: r.publicKey,
        publicKeyAlgorithm: r.publicKeyAlgorithm,
        transports: [...r.transports],
      };
    } else {
      response = Object.create(AuthenticatorAssertionResponse.prototype, {
        ...common,
        authenticatorData: { value: buffer(r.authenticatorData), enumerable: true },
        signature: { value: buffer(r.signature), enumerable: true },
        userHandle: { value: r.userHandle ? buffer(r.userHandle) : null, enumerable: true },
      });
      responseJSON = {
        clientDataJSON: r.clientDataJSON,
        authenticatorData: r.authenticatorData,
        signature: r.signature,
        userHandle: r.userHandle,
      };
    }
    return Object.create(PublicKeyCredential.prototype, {
      id: { value: r.id, enumerable: true },
      rawId: { value: buffer(r.id), enumerable: true },
      type: { value: 'public-key', enumerable: true },
      authenticatorAttachment: { value: 'platform', enumerable: true },
      response: { value: response, enumerable: true },
      getClientExtensionResults: { value: () => ({ ...extensions }) },
      toJSON: {
        value: () => ({
          id: r.id,
          rawId: r.id,
          type: 'public-key',
          authenticatorAttachment: 'platform',
          clientExtensionResults: { ...extensions },
          response: responseJSON,
        }),
      },
    });
  }

  async function handle(op, options, native) {
    let payload;
    try {
      payload = op === 'create' ? createOptions(options.publicKey) : getOptions(options.publicKey);
    } catch {
      return native(); // malformed options: the browser reports the proper error
    }
    const result = await ask(op, payload, options.publicKey.timeout, options.signal);
    if (result.action === 'result' && result.op === op) return credential(result);
    if (result.action === 'error') throw new DOMException(result.message || 'Operazione non consentita.', result.name || 'NotAllowedError');
    return native();
  }

  const create = function create(options) {
    if (!options?.publicKey) return nativeCreate(options);
    return handle('create', options, () => nativeCreate(options));
  };
  const get = function get(options) {
    // Conditional (autofill) requests stay with the browser: no unsolicited panel.
    if (!options?.publicKey || options.mediation === 'conditional') return nativeGet(options);
    return handle('get', options, () => nativeGet(options));
  };
  Object.defineProperty(container, 'create', { value: create, configurable: true, writable: true });
  Object.defineProperty(container, 'get', { value: get, configurable: true, writable: true });
})();
