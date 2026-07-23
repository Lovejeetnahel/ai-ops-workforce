import { Injectable, Logger } from '@nestjs/common';
import { MemorySubject, UserRole } from '@prisma/client';
import { BusinessBrainService } from './business-brain.service';

export interface ComposeInput {
  /** The agent/module persona (from the industry module config). */
  persona: string;
  /** What the agent is about to reason about (drives RAG + memory recall). */
  query: string;
  /** Permission tier of the audience this context will serve. */
  role?: UserRole | string;
  /** Optional subject to personalize for (a customer or employee). */
  subject?: { type: MemorySubject; id: string; label?: string };
  /** Retrieval breadth. */
  topK?: number;
  /** Sprint 1: which AI employee this context serves — selects the goals it supports. */
  agent?: { key?: string; department?: string };
}

/**
 * Composes the grounded system context for an agent. This is the enforcement
 * point for the platform rule: **no agent prompt without Business Brain
 * context.** Agents pass their persona + the current query; they get back a
 * persona enriched with the business profile, the most relevant knowledge
 * (RAG), and the subject's memory — permission-filtered by role.
 *
 * Fails OPEN to the bare persona if the Brain is empty or unreachable, so
 * adopting it is always non-breaking.
 */
@Injectable()
export class BrainContextService {
  private readonly logger = new Logger(BrainContextService.name);

  constructor(private readonly brain: BusinessBrainService) {}

  async composeAgentContext(input: ComposeInput): Promise<string> {
    const parts: string[] = [input.persona.trim()];

    try {
      // retrieveGrounded embeds `query` ONCE and reuses it for both knowledge
      // search and memory recall (was two separate embedding calls — AI cost).
      // Each source fails open INDEPENDENTLY: an embeddings-provider outage
      // (e.g. an invalid Voyage key — seen in production, err_89cf7e1ae093)
      // must not also discard the structured company facts and goals, which
      // need no embeddings at all.
      const [profile, grounded, company] = await Promise.all([
        this.brain.businessProfile(input.role as string).catch(() => []),
        this.brain
          .retrieveGrounded(input.query, { role: input.role as string, topK: input.topK, subject: input.subject })
          .catch((err) => {
            this.logger.warn(`knowledge retrieval unavailable (embeddings?): ${(err as Error).message}`);
            return { knowledge: [], memory: [] };
          }),
        this.brain.companyFacts(input.agent).catch(() => ({ profile: null, goals: [] as any[] })),
      ]);
      const { knowledge, memory } = grounded;

      // Sprint 1: structured company identity + the goals this agent supports.
      if (company.profile) {
        const p = company.profile;
        const identityLines = [
          p.brandName || p.legalName ? `- Name: ${p.brandName ?? p.legalName}` : null,
          p.tagline ? `- Tagline: ${p.tagline}` : null,
          p.mission ? `- Mission: ${truncate(p.mission, 240)}` : null,
          p.vision ? `- Vision: ${truncate(p.vision, 240)}` : null,
          p.targetMarket ? `- Target market: ${truncate(p.targetMarket, 240)}` : null,
          p.brandVoice ? `- Voice: write like this — ${truncate(p.brandVoice, 240)}` : null,
        ].filter(Boolean);
        if (identityLines.length) parts.push('## Company identity\n' + identityLines.join('\n'));
        const rules = Array.isArray(p.businessRules) ? (p.businessRules as unknown[]).filter((r) => typeof r === 'string').slice(0, 12) : [];
        if (rules.length) {
          parts.push('## Standing business rules (always follow these)\n' + rules.map((r) => `- ${truncate(String(r), 200)}`).join('\n'));
        }
      }
      if (company.goals.length) {
        parts.push(
          '## Active goals you support (work toward these)\n' +
            company.goals
              .map((g) => `- [${g.priority}] ${g.title} — ${g.progress}% done${g.dueAt ? `, due ${new Date(g.dueAt).toISOString().slice(0, 10)}` : ''}`)
              .join('\n'),
        );
      }

      if (profile.length) {
        parts.push(
          '## Business facts\n' +
            profile.map((d) => `- (${d.type}) ${d.title}: ${truncate(d.content, 280)}`).join('\n'),
        );
      }

      if (knowledge.length) {
        parts.push(
          '## Relevant knowledge (cite when helpful)\n' +
            knowledge.map((k, i) => `[${i + 1}] ${k.title}: ${truncate(k.content, 320)}`).join('\n'),
        );
      }

      if (Array.isArray(memory) && memory.length && input.subject) {
        const label = input.subject.label ?? 'this person';
        parts.push(
          `## What we remember about ${label}\n` +
            memory.map((m: any) => `- ${m.content}`).join('\n'),
        );
      }

      parts.push(
        'Use the facts and knowledge above. If something is not covered, say you will ' +
          'check rather than inventing details. Personalize using what we remember.',
      );
    } catch (err) {
      this.logger.warn(`Brain context unavailable, using bare persona: ${(err as Error).message}`);
    }

    return parts.join('\n\n');
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
