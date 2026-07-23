import {
  AUTHORITY_POLICY_VERSION,
  readAuthorityDecision,
  resolveEffectiveAuthority,
  stampAuthorityDecision,
} from './authority-policy';

/**
 * Release 3 pre-merge safety: stored AUTONOMOUS is only honored when the row
 * carries proof of an explicit owner grant. Rows that inherited AUTONOMOUS
 * from the pre-R3 silent default (enable toggles, config PATCHes) must behave
 * as APPROVE and be flagged for owner review — without mutating stored data.
 */
describe('effective authority resolution', () => {
  it('no installation row → definition default; missing definition fails safe to APPROVE', () => {
    expect(resolveEffectiveAuthority(null, 'APPROVE')).toEqual({ authority: 'APPROVE', reviewRequired: false, confirmed: false });
    expect(resolveEffectiveAuthority(null, 'SUGGEST')).toEqual({ authority: 'SUGGEST', reviewRequired: false, confirmed: false });
    // Unknown definition can never imply autonomy.
    expect(resolveEffectiveAuthority(null, undefined).authority).toBe('APPROVE');
  });

  it('legacy unconfirmed AUTONOMOUS behaves as APPROVE and requires review', () => {
    const eff = resolveEffectiveAuthority({ authority: 'AUTONOMOUS', config: {} });
    expect(eff.authority).toBe('APPROVE');
    expect(eff.reviewRequired).toBe(true);
    expect(eff.confirmed).toBe(false);
  });

  it('explicitly confirmed AUTONOMOUS remains autonomous', () => {
    const config = stampAuthorityDecision({}, 'AUTONOMOUS', 'user_owner_1');
    const eff = resolveEffectiveAuthority({ authority: 'AUTONOMOUS', config });
    expect(eff).toEqual({ authority: 'AUTONOMOUS', reviewRequired: false, confirmed: true });
  });

  it('unconfirmed APPROVE and SUGGEST pass through without a review flag (already fail-safe)', () => {
    expect(resolveEffectiveAuthority({ authority: 'APPROVE', config: {} })).toEqual({ authority: 'APPROVE', reviewRequired: false, confirmed: false });
    expect(resolveEffectiveAuthority({ authority: 'SUGGEST', config: {} })).toEqual({ authority: 'SUGGEST', reviewRequired: false, confirmed: false });
  });

  it('a marker for a DIFFERENT authority than stored does not confirm autonomy', () => {
    // e.g. owner confirmed APPROVE, then something else (manual DB edit)
    // flipped the column to AUTONOMOUS — the mismatch must not count as proof.
    const config = stampAuthorityDecision({}, 'APPROVE', 'user_owner_1');
    const eff = resolveEffectiveAuthority({ authority: 'AUTONOMOUS', config });
    expect(eff.authority).toBe('APPROVE');
    expect(eff.reviewRequired).toBe(true);
  });

  it('malformed or forged markers never grant autonomy', () => {
    for (const bad of [
      { authorityDecision: 'yes' },
      { authorityDecision: { authority: 'GODMODE', decidedAt: 'now' } },
      { authorityDecision: { authority: 'AUTONOMOUS' } }, // no decidedAt
      { authorityDecision: null },
      'not-an-object',
      42,
    ]) {
      expect(resolveEffectiveAuthority({ authority: 'AUTONOMOUS', config: bad }).authority).toBe('APPROVE');
    }
  });

  it('stamp is durable data: attributable, timestamped, versioned, and preserves other config', () => {
    const config = stampAuthorityDecision({ personality: 'friendly' }, 'AUTONOMOUS', 'user_owner_1');
    expect(config.personality).toBe('friendly');
    const decision = readAuthorityDecision(config)!;
    expect(decision.authority).toBe('AUTONOMOUS');
    expect(decision.decidedByUserId).toBe('user_owner_1');
    expect(decision.policy).toBe(AUTHORITY_POLICY_VERSION);
    expect(Number.isNaN(Date.parse(decision.decidedAt))).toBe(false);
    // Round-trips through JSON (the Prisma Json column) unchanged.
    const rehydrated = JSON.parse(JSON.stringify(config));
    expect(resolveEffectiveAuthority({ authority: 'AUTONOMOUS', config: rehydrated }).confirmed).toBe(true);
  });

  it('confirming APPROVE on a legacy-autonomous row lowers it durably', () => {
    // Owner reviews and picks approval-first: install() stores authority
    // APPROVE + matching marker; resolution is then confirmed APPROVE.
    const config = stampAuthorityDecision({}, 'APPROVE', 'user_owner_1');
    expect(resolveEffectiveAuthority({ authority: 'APPROVE', config })).toEqual({ authority: 'APPROVE', reviewRequired: false, confirmed: true });
  });
});
