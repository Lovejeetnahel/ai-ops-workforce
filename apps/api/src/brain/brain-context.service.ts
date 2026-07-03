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
      const [profile, grounded] = await Promise.all([
        this.brain.businessProfile(input.role as string),
        this.brain.retrieveGrounded(input.query, { role: input.role as string, topK: input.topK, subject: input.subject }),
      ]);
      const { knowledge, memory } = grounded;

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
