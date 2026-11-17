"""Cross-language fixture verification. Requires pip install cryptography."""
import base64, hashlib, json
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
fixture = json.loads((Path(__file__).parent.parent / 'fixtures' / 'legacy_v1_synthetic.json').read_text())
h = fixture['header']
salt = base64.b64decode(h['salt'])
kdf = hashlib.scrypt(fixture['password'].encode(),salt=salt,n=2**15,r=8,p=1,dklen=32,maxmem=2**27)
assert kdf.hex() == fixture['expected_kdf_hex']
raw = base64.b64decode(h['wrap'])
dek = AESGCM(kdf).decrypt(raw[:12],raw[12:],None)
assert dek.hex() == fixture['expected_dek_hex']
raw = base64.b64decode(h['data'])
data = json.loads(AESGCM(dek).decrypt(raw[:12],raw[12:],None))
assert data == fixture['expected_data']
print('Synthetic legacy v1 fixture OK (AES-GCM/scrypt).')
