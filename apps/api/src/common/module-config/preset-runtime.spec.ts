import { CORE_ENGINES, INDUSTRY_PRESETS, getModuleConfig, listPresets } from '@aiow/config';

/**
 * Sprint 2 preset-runtime integrity. The industry preset is now the contract
 * that drives sidebar modules, dashboard widgets, terminology, pipeline
 * stages, KPI defaults, automation recipes and onboarding — so every preset
 * must carry a complete, internally consistent runtime schema, and must only
 * reference things that really exist (real engines, real automation keys,
 * real analytics metric keys, real pipeline stage values).
 */
const REAL_METRIC_KEYS = [
  'revenue', 'cost', 'net_value', 'jobs_completed', 'jobs_open', 'leads_new', 'leads_won',
  'pipeline_value', 'conversion_rate', 'avg_job_value', 'outstanding_invoices', 'active_staff', 'agent_tasks',
];
const LEAD_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'COMPLETED', 'LOST'];
const ROSTER_KEYS = [
  'collections', 'command_center', 'customer_success', 'executive', 'marketing',
  'operations_manager', 'receptionist', 'recruiting', 'sales',
];

describe('Sprint 2 preset runtime schema', () => {
  const presets = listPresets();

  it('exposes exactly the existing preset catalog (17 presets — no fake expansion)', () => {
    expect(presets.length).toBe(Object.keys(INDUSTRY_PRESETS).length);
    expect(presets.length).toBe(17);
  });

  it.each(presets.map((p) => [p.key, p] as const))('%s carries a complete runtime schema', (_key, p) => {
    expect(['FIELD_SERVICES', 'PROPERTY_MANAGEMENT', 'SERVICE_AGENCIES']).toContain(p.engine);
    // The preset's core must be a LIVE core backed by its own engine.
    expect(CORE_ENGINES[p.core]).toBe(p.engine);
    expect(p.modules.length).toBeGreaterThan(0);
    expect(p.dashboardWidgets.length).toBeGreaterThan(0);
    expect(Object.keys(p.terminology).length).toBeGreaterThan(0);
    expect(p.kpiDefaults.length).toBeGreaterThan(0);
    expect(p.aiEmployees.length).toBeGreaterThan(0);
    expect(p.onboarding.questions.length).toBeGreaterThan(0);
  });

  it.each(presets.map((p) => [p.key, p] as const))('%s only references real things', (_key, p) => {
    const engineAutomationKeys = getModuleConfig(p.engine).automations.map((a) => a.key);
    for (const t of p.automationTemplates) expect(engineAutomationKeys).toContain(t);
    for (const k of p.kpiDefaults) if (k.metricKey !== null) expect(REAL_METRIC_KEYS).toContain(k.metricKey);
    for (const e of p.aiEmployees) expect(ROSTER_KEYS).toContain(e);
    for (const s of p.pipelineStages ?? []) expect(LEAD_STAGES).toContain(s.value);
  });

  it('pipeline stage overlays keep every generic stage addressable (no data stranded)', () => {
    for (const p of presets) {
      if (!p.pipelineStages?.length) continue;
      expect(new Set(p.pipelineStages.map((s) => s.value)).size).toBe(LEAD_STAGES.length);
    }
  });

  it('APPOINTMENT and COMMERCE cores are declared but unclaimed (honesty)', () => {
    expect(CORE_ENGINES.APPOINTMENT).toBeUndefined();
    expect(CORE_ENGINES.COMMERCE).toBeUndefined();
    expect(presets.every((p) => !['APPOINTMENT', 'COMMERCE'].includes(p.core))).toBe(true);
  });
});
