import { Authority } from './employee.types';

/**
 * The centralized action-risk policy. Tool PERMISSION ("may this employee use
 * this tool at all?") and AUTHORITY ("may it act without a human?") are
 * independent checks; this file owns the second one so approval rules live in
 * exactly one place instead of being scattered across employees.
 *
 * SAFE            — internal reads/writes with no external blast radius.
 * EXTERNAL_IMPACT — leaves the building or changes business state a customer
 *                   sees: messages, documents, invoices, payment links, job
 *                   status, dispatch. These execute automatically only for
 *                   AUTONOMOUS employees (their pre-existing behavior); for
 *                   APPROVE-authority actors — including the Command Center by
 *                   default — they become durable AgentApprovals instead.
 */
export type ToolRisk = 'SAFE' | 'EXTERNAL_IMPACT';

export const TOOL_RISK: Record<string, ToolRisk> = {
  email: 'EXTERNAL_IMPACT',
  sms: 'EXTERNAL_IMPACT',
  generate_quote: 'SAFE', // creates a DRAFT document; sending it is a separate tool
  generate_invoice: 'SAFE', // draft only, same reasoning
  send_document: 'EXTERNAL_IMPACT',
  payment_link: 'EXTERNAL_IMPACT',
  dispatch_lead: 'EXTERNAL_IMPACT',
  update_job_status: 'EXTERNAL_IMPACT',
  search_knowledge: 'SAFE',
  recall_memory: 'SAFE',
  remember: 'SAFE',
  ingest_knowledge: 'SAFE',
  llm: 'SAFE',
  vision: 'SAFE',
  business_snapshot: 'SAFE',
  list_leads: 'SAFE',
  list_goals: 'SAFE',
  list_overdue_invoices: 'SAFE',
};

export function riskOf(toolName: string): ToolRisk {
  // Unknown tools are treated as EXTERNAL_IMPACT: fail closed, not open.
  return TOOL_RISK[toolName] ?? 'EXTERNAL_IMPACT';
}

export type ExecutionVerdict = 'EXECUTE' | 'REQUIRE_APPROVAL' | 'DENY';

/**
 * Decide what happens for a PERMITTED tool given the actor's authority.
 * (Permission itself is checked separately, before this is ever consulted.)
 */
export function verdictFor(toolName: string, authority: Authority): ExecutionVerdict {
  const risk = riskOf(toolName);
  if (risk === 'SAFE') return 'EXECUTE';
  switch (authority) {
    case 'AUTONOMOUS':
      return 'EXECUTE'; // preserves existing AUTONOMOUS employee behavior exactly
    case 'APPROVE':
      return 'REQUIRE_APPROVAL';
    case 'SUGGEST':
      return 'DENY'; // suggest-only actors never cause external impact
  }
}
