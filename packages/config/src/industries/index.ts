import { IndustryKey, IndustryModuleConfig } from '../types';
import { fieldServices } from './field-services';
import { propertyManagement } from './property-management';
import { serviceAgencies } from './service-agencies';

/** Registry of every industry module, keyed by Prisma `IndustryModule`. */
export const INDUSTRY_MODULES: Record<IndustryKey, IndustryModuleConfig> = {
  FIELD_SERVICES: fieldServices,
  PROPERTY_MANAGEMENT: propertyManagement,
  SERVICE_AGENCIES: serviceAgencies,
};

export { fieldServices, propertyManagement, serviceAgencies };
