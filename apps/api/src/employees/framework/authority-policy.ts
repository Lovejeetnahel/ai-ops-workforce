import { Authority } from './employee.types';

/**
 * Effective-authority resolution (Release 3).
 *
 * History: before Release 3, creating an AgentInstallation row through an
 * enable toggle or a config PATCH silently stored authority AUTONOMOUS (the
 * old hardcoded default) — indistinguishable after the fact from an owner's
 * explicit choice, because the AGENT_INSTALLED event never recorded authority
 * or the actor and no audit row was written. The product promise, however, is
 * approval-first unless the owner explicitly grants autonomy.
 *
 * Resolution therefore trusts stored AUTONOMOUS only when the row carries a
 * confirmation marker written at explicit-grant time (config.authorityDecision,
 * stamped by EmployeeRegistry.install() whenever authority is passed — an
 * OWNER-only path). Unconfirmed AUTONOMOUS is treated as APPROVE at read time
 * and flagged for owner review. The stored value is never mutated: no data is
 * overwritten, and a later confirmation is a fresh, durable, attributable
 * owner decision rather than a silent claim that the old default was chosen.
 */

export const AUTHORITY_POLICY_VERSION = 2;

export interface AuthorityDecision {
  authority: Authority;
  decidedByUserId: string | null;
  decidedAt: string; // ISO timestamp
  policy: number;
}

export interface EffectiveAuthority {
  authority: Authority;
  /** true when stored AUTONOMOUS lacks proof of an explicit owner grant */
  reviewRequired: boolean;
  /** true when the stored authority carries a matching confirmation marker */
  confirmed: boolean;
}

const AUTHORITIES: ReadonlySet<string> = new Set(['SUGGEST', 'APPROVE', 'AUTONOMOUS']);

/** Defensive read of the marker — malformed JSON never grants autonomy. */
export function readAuthorityDecision(config: unknown): AuthorityDecision | null {
  if (!config || typeof config !== 'object') return null;
  const d = (config as Record<string, unknown>).authorityDecision;
  if (!d || typeof d !== 'object') return null;
  const v = d as Record<string, unknown>;
  if (typeof v.authority !== 'string' || !AUTHORITIES.has(v.authority)) return null;
  if (typeof v.decidedAt !== 'string') return null;
  return {
    authority: v.authority as Authority,
    decidedByUserId: typeof v.decidedByUserId === 'string' ? v.decidedByUserId : null,
    decidedAt: v.decidedAt,
    policy: typeof v.policy === 'number' ? v.policy : 0,
  };
}

export function stampAuthorityDecision(
  config: Record<string, unknown>,
  authority: Authority,
  decidedByUserId: string | null,
): Record<string, unknown> {
  const decision: AuthorityDecision = {
    authority,
    decidedByUserId,
    decidedAt: new Date().toISOString(),
    policy: AUTHORITY_POLICY_VERSION,
  };
  return { ...config, authorityDecision: decision };
}

export function resolveEffectiveAuthority(
  row: { authority: Authority; config: unknown } | null | undefined,
  defaultAuthority?: Authority,
): EffectiveAuthority {
  if (!row) {
    // No installation row: the definition default applies (all APPROVE since
    // Release 3). Fail safe: an unknown definition can never imply autonomy.
    return { authority: defaultAuthority ?? 'APPROVE', reviewRequired: false, confirmed: false };
  }
  const decision = readAuthorityDecision(row.config);
  const confirmed = decision !== null && decision.authority === row.authority;
  if (row.authority === 'AUTONOMOUS' && !confirmed) {
    return { authority: 'APPROVE', reviewRequired: true, confirmed: false };
  }
  return { authority: row.authority, reviewRequired: false, confirmed };
}
