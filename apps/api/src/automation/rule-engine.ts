import { AutomationCondition } from '@aiow/config';

/** Read a dot-path ("lead.urgency") out of an arbitrary payload. */
export function resolvePath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/** Evaluate a single condition against the event payload. */
export function evalCondition(cond: AutomationCondition, payload: any): boolean {
  const actual = resolvePath(payload, cond.path);
  switch (cond.op) {
    case 'eq':
      return actual === cond.value;
    case 'neq':
      return actual !== cond.value;
    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(actual as never);
    case 'gt':
      return typeof actual === 'number' && actual > (cond.value as number);
    case 'lt':
      return typeof actual === 'number' && actual < (cond.value as number);
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'contains':
      return typeof actual === 'string' && actual.includes(String(cond.value));
    default:
      return false;
  }
}

/** A rule fires only when ALL of its conditions pass (logical AND). */
export function matches(conditions: AutomationCondition[], payload: any): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evalCondition(c, payload));
}

/**
 * Resolve `{{token}}` references in action params against the event payload.
 * Lightweight on purpose — the Document agent uses a fuller Handlebars renderer.
 */
export function interpolate(template: string, payload: any): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path) => {
    const v = resolvePath(payload, path);
    return v == null ? '' : String(v);
  });
}
