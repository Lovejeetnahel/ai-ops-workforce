export type Authority = 'SUGGEST' | 'APPROVE' | 'AUTONOMOUS';

export interface SubjectRefs {
  contactId?: string | null;
  leadId?: string | null;
  jobId?: string | null;
}

/** A unit of work handed to an AI employee. */
export interface EmployeeTaskInput {
  type: string;
  subjects?: SubjectRefs;
  params?: Record<string, unknown>;
}

export interface EmployeeResult {
  ok: boolean;
  summary: string;
  output?: Record<string, unknown>;
  /** Business value generated (booked to the Value Ledger in reflect()). */
  value?: number;
  emitted?: string[];
}

/** Static descriptor of an AI employee (the "job description"). */
export interface AgentDefinition {
  key: string;
  name: string;
  department: string;
  description: string;
  defaultAuthority: Authority;
  /** Tool registry permissions this employee may use. */
  tools: string[];
  /** Events that should auto-trigger this employee (documentation/routing). */
  triggers?: string[];
}

/** Context passed into an employee's execute() step. */
export interface ExecuteContext {
  input: EmployeeTaskInput;
  observed: Record<string, unknown>;
  plan: string;
  taskId: string;
  /** True when authority === AUTONOMOUS (side effects allowed). */
  autonomous: boolean;
  /** The full authority in force for this run (drives the ToolGateway's risk verdict). */
  authority: Authority;
}
