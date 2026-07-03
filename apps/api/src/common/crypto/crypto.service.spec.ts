import { CryptoService } from './crypto.service';

describe('CryptoService (AES-256-GCM envelope)', () => {
  const svc = new CryptoService();

  it('round-trips a string through encrypt/decrypt', () => {
    const plain = 'twilio-auth-token-super-secret';
    const cipher = svc.encrypt(plain);
    expect(cipher).not.toContain(plain);
    expect(cipher.split(':')).toHaveLength(3); // iv:tag:ciphertext
    expect(svc.decrypt(cipher)).toBe(plain);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
  });

  it('round-trips JSON credentials', () => {
    const creds = { accountSid: 'AC123', authToken: 'tok', from: '+15550000000' };
    const cipher = svc.encryptJson(creds);
    expect(svc.decryptJson(cipher)).toEqual(creds);
  });

  it('fails to decrypt tampered ciphertext (auth tag)', () => {
    const cipher = svc.encrypt('integrity');
    const [iv, tag, data] = cipher.split(':');
    const tampered = `${iv}:${tag}:${Buffer.from('garbage').toString('base64')}`;
    expect(() => svc.decrypt(tampered)).toThrow();
  });
});
