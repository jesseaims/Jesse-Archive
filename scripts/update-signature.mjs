// Ed25519 signatures for automatic updates (see src-tauri/src/updater.rs).
//
//   node scripts/update-signature.mjs keygen
//       Prints {"privatePem": ..., "publicKey": ...} on stdout. Called only by
//       scripts/Update-SigningKey.ps1, which protects the private key with DPAPI.
//   node scripts/update-signature.mjs sign <installer> <version> <out.sig>
//       Reads the private key (PKCS#8 PEM) from stdin and writes the signed manifest.
//   node scripts/update-signature.mjs verify <installer> <file.sig> <public-key-file>
//       Checks a manifest against the installer and the key embedded in the app.
//   node scripts/update-signature.mjs encrypt | decrypt
//       stdin {"pem","passphrase"} -> stdout PEM: encrypted backup of the private key.
//
// The private key is never written to disk by this script and never printed except
// to the PowerShell caller that protects it.
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const HEADER = 'JesseArchive update v1';
const INSTALLER = 'JesseArchive-Setup.exe';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function rawPublicKey(key) {
  // SPKI DER of an Ed25519 key: 12-byte prefix followed by the 32-byte key.
  const publicKey = key?.type === 'public' ? key : createPublicKey(key);
  return publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
}

async function manifestBody(file, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Versione non valida: ${version}`);
  if (path.basename(file) !== INSTALLER) fail(`Il file deve chiamarsi ${INSTALLER}.`);
  const size = fs.statSync(file).size;
  return `${HEADER}\nversion: ${version}\nfile: ${INSTALLER}\nsize: ${size}\nsha256: ${await sha256(file)}\n`;
}

function parseManifest(text) {
  const at = text.indexOf('\nsignature: ');
  if (at < 0) fail('Firma mancante nel manifest.');
  const body = text.slice(0, at + 1);
  const signature = text.slice(at + 1 + 'signature: '.length).replace(/\n$/, '');
  const fields = Object.fromEntries(
    body
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.split(': ')),
  );
  return { body, signature, fields };
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'keygen': {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    process.stdout.write(
      JSON.stringify({
        privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        publicKey: rawPublicKey(publicKey).toString('base64'),
      }),
    );
    break;
  }
  case 'public': {
    process.stdout.write(rawPublicKey(createPrivateKey(readStdin())).toString('base64'));
    break;
  }
  case 'sign': {
    const [file, version, out] = args;
    if (!file || !version || !out) fail('Uso: sign <installer> <version> <out.sig>');
    const key = createPrivateKey(readStdin());
    const body = await manifestBody(file, version);
    const signature = sign(null, Buffer.from(body, 'utf8'), key).toString('base64');
    fs.writeFileSync(out, `${body}signature: ${signature}\n`, { encoding: 'utf8' });
    break;
  }
  case 'verify': {
    const [file, sigFile, keyFile] = args;
    if (!file || !sigFile || !keyFile) fail('Uso: verify <installer> <file.sig> <public-key-file>');
    const raw = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64');
    if (raw.length !== 32) fail('Chiave pubblica non valida.');
    const publicKey = createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]),
      format: 'der',
      type: 'spki',
    });
    const { body, signature, fields } = parseManifest(fs.readFileSync(sigFile, 'utf8'));
    if (!verify(null, Buffer.from(body, 'utf8'), publicKey, Buffer.from(signature, 'base64')))
      fail('Firma non valida per la chiave pubblica incorporata nell’app.');
    if (body !== (await manifestBody(file, fields.version)))
      fail('Il manifest non corrisponde al setup (dimensione o SHA-256).');
    console.log(
      `Firma valida: Beta ${fields.version}, ${fields.size} byte, SHA-256 ${fields.sha256}`,
    );
    break;
  }
  case 'encrypt': {
    const { pem, passphrase } = JSON.parse(readStdin());
    if (!passphrase || passphrase.length < 12)
      fail('Passphrase troppo corta (minimo 12 caratteri).');
    process.stdout.write(
      createPrivateKey(pem).export({
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase,
      }),
    );
    break;
  }
  case 'decrypt': {
    const { pem, passphrase } = JSON.parse(readStdin());
    process.stdout.write(
      createPrivateKey({ key: pem, passphrase }).export({ type: 'pkcs8', format: 'pem' }),
    );
    break;
  }
  default:
    fail('Comando non valido: keygen | public | sign | verify | encrypt | decrypt');
}
