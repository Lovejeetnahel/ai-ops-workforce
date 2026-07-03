import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
  tenantId: string;
  userId?: string;
  role?: string;
  /** Set for customer-portal tokens — the CRM Contact this session may access. */
  contactId?: string;
  /** Set for public-API-key sessions — the granted scopes. */
  scopes?: string[];
  /** Set for public-API-key sessions — the key's id and its configured rate limit. */
  apiKeyId?: string;
  rateLimitPerMin?: number;
}

/**
 * Request-scoped tenant context backed by AsyncLocalStorage. Set once per HTTP
 * request (TenantMiddleware) or per queued job (worker), then read anywhere —
 * including deep inside the Prisma client extension — without threading a
 * `tenantId` argument through every function. This is the spine of tenant
 * isolation.
 */
class TenantContext {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  get(): TenantStore | undefined {
    return this.als.getStore();
  }

  get tenantId(): string {
    const store = this.als.getStore();
    if (!store) {
      throw new Error('No tenant context — request escaped TenantMiddleware');
    }
    return store.tenantId;
  }

  get tenantIdOrNull(): string | null {
    return this.als.getStore()?.tenantId ?? null;
  }
}

export const tenantContext = new TenantContext();
