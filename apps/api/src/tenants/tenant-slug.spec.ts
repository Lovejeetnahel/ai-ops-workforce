import { slugify } from './tenants.service';

/**
 * Regression coverage for the production signup failure: Tenant.slug is
 * @unique, and the old name-only derivation crashed provisioning with a
 * P2002 whenever two businesses slugified to the same value — surfaced to
 * the user as a generic "Could not create your account."
 */
describe('tenant slug derivation', () => {
  it('slugifies names deterministically', () => {
    expect(slugify('Zulu HVAC')).toBe('zulu-hvac');
    expect(slugify("Joe's Plumbing & Heating")).toBe('joe-s-plumbing-heating');
    expect(slugify('  --Acme--  ')).toBe('acme');
  });

  it('collides for distinct names that normalize identically (the production bug)', () => {
    // These two REAL-WORLD distinct business names produce the same slug —
    // exactly the case that used to 500. uniqueSlug() must disambiguate.
    expect(slugify('Joes Plumbing')).toBe(slugify('Joe’s Plumbing'));
    expect(slugify('A+B Cleaning')).toBe(slugify('A B Cleaning'));
  });

  it('empty/symbol-only names produce an empty base (uniqueSlug falls back to "business")', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('')).toBe('');
  });
});
