/**
 * Typed, RUNTIME-VALIDATED shape of AgentInstallation.config. Arbitrary JSON
 * is never cast straight into an interface: parseEmployeeConfig() checks every
 * field, silently drops anything unknown/invalid, and enforces length caps so
 * a tenant can't inflate prompts (and token spend) without bound. The version
 * field lets future shapes migrate deliberately instead of by accident.
 */

export const EMPLOYEE_CONFIG_VERSION = 1;

export const CONFIG_LIMITS = {
  personality: 2000,
  instructions: 4000,
  goal: 1000,
  kpiCount: 10,
  kpiLength: 200,
} as const;

export interface EmployeeSchedule {
  frequency: 'daily' | 'weekly';
  /** 0-23, interpreted in the TENANT's timezone. */
  hour: number;
  /** 0 (Sunday) - 6 (Saturday); required when frequency === 'weekly'. */
  dayOfWeek?: number;
  /** The EmployeeTaskInput.type the scheduled run executes. */
  taskType: string;
}

export interface EmployeeConfig {
  version: number;
  personality?: string;
  instructions?: string;
  goal?: string;
  kpis?: string[];
  schedule?: EmployeeSchedule;
}

function cleanString(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

export function parseSchedule(value: unknown): EmployeeSchedule | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const frequency = v.frequency === 'daily' || v.frequency === 'weekly' ? v.frequency : undefined;
  const hour = typeof v.hour === 'number' && Number.isInteger(v.hour) && v.hour >= 0 && v.hour <= 23 ? v.hour : undefined;
  const taskType = cleanString(v.taskType, 100);
  if (!frequency || hour === undefined || !taskType) return undefined;
  if (frequency === 'weekly') {
    const dayOfWeek = typeof v.dayOfWeek === 'number' && Number.isInteger(v.dayOfWeek) && v.dayOfWeek >= 0 && v.dayOfWeek <= 6 ? v.dayOfWeek : undefined;
    if (dayOfWeek === undefined) return undefined;
    return { frequency, hour, dayOfWeek, taskType };
  }
  return { frequency, hour, taskType };
}

/** Defensive parse of stored config. Never throws; invalid fields are dropped. */
export function parseEmployeeConfig(raw: unknown): EmployeeConfig {
  const out: EmployeeConfig = { version: EMPLOYEE_CONFIG_VERSION };
  if (!raw || typeof raw !== 'object') return out;
  const v = raw as Record<string, unknown>;

  out.personality = cleanString(v.personality, CONFIG_LIMITS.personality);
  out.instructions = cleanString(v.instructions, CONFIG_LIMITS.instructions);
  out.goal = cleanString(v.goal, CONFIG_LIMITS.goal);

  if (Array.isArray(v.kpis)) {
    const kpis = v.kpis
      .map((k) => cleanString(k, CONFIG_LIMITS.kpiLength))
      .filter((k): k is string => !!k)
      .slice(0, CONFIG_LIMITS.kpiCount);
    if (kpis.length) out.kpis = kpis;
  }

  out.schedule = parseSchedule(v.schedule);
  return out;
}

/**
 * Validate a config PATCH payload strictly (for the API): returns the errors
 * a caller must fix, unlike parseEmployeeConfig's silent-drop read path.
 */
export function validateEmployeeConfigInput(raw: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const check = (field: 'personality' | 'instructions' | 'goal', max: number) => {
    const v = raw[field];
    if (v === undefined || v === null) return;
    if (typeof v !== 'string') errors.push(`${field} must be a string`);
    else if (v.length > max) errors.push(`${field} must be at most ${max} characters`);
  };
  check('personality', CONFIG_LIMITS.personality);
  check('instructions', CONFIG_LIMITS.instructions);
  check('goal', CONFIG_LIMITS.goal);
  if (raw.kpis !== undefined && raw.kpis !== null) {
    if (!Array.isArray(raw.kpis)) errors.push('kpis must be an array of strings');
    else if (raw.kpis.length > CONFIG_LIMITS.kpiCount) errors.push(`kpis must have at most ${CONFIG_LIMITS.kpiCount} entries`);
    else if (raw.kpis.some((k) => typeof k !== 'string' || k.length > CONFIG_LIMITS.kpiLength)) errors.push(`each KPI must be a string of at most ${CONFIG_LIMITS.kpiLength} characters`);
  }
  if (raw.schedule !== undefined && raw.schedule !== null && !parseSchedule(raw.schedule)) {
    errors.push('schedule must be { frequency: "daily"|"weekly", hour: 0-23, dayOfWeek?: 0-6 (required for weekly), taskType: string }');
  }
  return errors;
}
