import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// AES-256-GCM: cifrado autenticado, IV único por registro.
// Formato almacenado (base64): [version:1][iv:12][authTag:16][ciphertext:N]
const VERSION = 0x01;
const IV_LEN  = 12;
const TAG_LEN = 16;

let cachedKey = null;
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error('PII_ENCRYPTION_KEY ausente o demasiado corta (mínimo 32 chars).');
  }
  // Deriva 32 bytes de la passphrase. El salt fijo es aceptable porque la
  // passphrase ya es de alta entropía (la genera el usuario con openssl rand).
  cachedKey = scryptSync(raw, 'estetikas-pii-v1', 32);
  return cachedKey;
}

export function encryptPII(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const key = getKey();
  const iv  = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct  = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([Buffer.from([VERSION]), iv, tag, ct]);
  return out.toString('base64');
}

export function decryptPII(b64) {
  if (!b64) return null;
  const buf = Buffer.from(b64, 'base64');
  if (buf[0] !== VERSION) throw new Error('Versión de cifrado desconocida.');
  const iv  = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct  = buf.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
