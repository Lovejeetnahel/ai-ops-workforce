import { DomainEvent } from '../automation/events';

/**
 * Common contract for every AI agent. Agents are stateless services that react
 * to a domain event (or a direct trigger from an automation action) and may emit
 * new events. They never call each other directly — they cooperate through the
 * event bus, which keeps the workforce loosely coupled and independently
 * testable/scalable.
 */
export interface AgentContext {
  /** The event that triggered this run (if reactive). */
  event?: DomainEvent;
  /** Params from a TRIGGER_AGENT automation action (if directed). */
  params?: Record<string, unknown>;
}

export interface AgentResult {
  agent: string;
  ok: boolean;
  summary: string;
  emitted?: string[];
}

export interface Agent {
  /** Stable name used by the registry and TRIGGER_AGENT actions. */
  readonly name: string;
  run(ctx: AgentContext): Promise<AgentResult>;
}
