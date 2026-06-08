import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

export function encrypt(secret: string, key: string): EncryptedPayload {
  const keyBuffer = Buffer.from(key.slice(0, 32), 'utf8');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decrypt(payload: EncryptedPayload, key: string): string {
  const keyBuffer = Buffer.from(key.slice(0, 32), 'utf8');
  const decipher = createDecipheriv(
    ALGORITHM,
    keyBuffer,
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function encryptToString(secret: string, key: string): string {
  return JSON.stringify(encrypt(secret, key));
}

export function decryptFromString(stored: string, key: string): string {
  try {
    const parsed = JSON.parse(stored) as EncryptedPayload;
    if (parsed.iv && parsed.tag && parsed.ciphertext) {
      return decrypt(parsed, key);
    }
  } catch {
    // plaintext legacy value
  }
  return stored;
}
