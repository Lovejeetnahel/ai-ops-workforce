import { IndustryKey, IndustryModuleConfig } from './types';
import { INDUSTRY_MODULES } from './industries';

export * from './types';
export { INDUSTRY_MODULES } from './industries';
export * from './presets';

/** Resolve a tenant's module config. Throws on unknown key (fail loud). */
export function getModuleConfig(key: IndustryKey): IndustryModuleConfig {
  const config = INDUSTRY_MODULES[key];
  if (!config) throw new Error(`Unknown industry module: ${key}`);
  return config;
}

/** All modules, for onboarding pickers. */
export function listModules(): IndustryModuleConfig[] {
  return Object.values(INDUSTRY_MODULES);
}

/** Resolve the vertical vocabulary for a generic entity backing. */
export function entityLabel(
  config: IndustryModuleConfig,
  backing: 'lead' | 'job' | 'document',
  form: 'singular' | 'plural' = 'singular',
): string {
  const entity = config.entities.find((e) => e.backing === backing);
  if (!entity) return backing;
  return form === 'plural' ? entity.plural : entity.singular;
}
