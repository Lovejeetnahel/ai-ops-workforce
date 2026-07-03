import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM envelope for per-tenant integration credentials. Stored format:
 * `iv:authTag:ciphertext` (all base64). The key comes from
 * CREDENTIALS_ENCRYPTION_KEY (32-byte hex) and should be sourced from a KMS /
 * secrets manager in production.
 */
@Injectable()
export class CryptoService {
  private readonly key = Buffer.from(
    process.env.CREDENTIALS_ENCRYPTION_KEY ?? '0'.repeat(64),
    'hex',
  );

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  encryptJson(obj: unknown): string {
    return this.encrypt(JSON.stringify(obj));
  }

  decryptJson<T>(payload: string): T {
    return JSON.parse(this.decrypt(payload)) as T;
  }
}
