import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { tenantContext } from '../tenancy/tenant-context';

/**
 * Tenant-scoped Prisma client.
 *
 * The `$extends` query hook injects the current `tenantId` (from
 * AsyncLocalStorage) into every read/write on tenant-scoped models. This makes
 * cross-tenant data leaks structurally impossible from application code.
 *
 * Models WITHOUT a direct tenantId column are listed in GLOBAL_MODELS and
 * bypass the hook entirely (`Message` has no tenantId of its own, only via its
 * parent Conversation; `Tenant`/`Organization`/`MarketplaceListing` are
 * deliberately cross-tenant/global and already accessed via the base client
 * elsewhere in the codebase).
 *
 * ARCHITECTURE — FAIL CLOSED, NOT FAIL OPEN (rewritten after two real,
 * reproduced security regressions caused by the opposite design):
 *
 * Earlier versions of this file used an "if it's not one of these recognized
 * cases, just run the query unmodified" structure. Twice, that silently
 * leaked or allowed cross-tenant access the moment an operation wasn't
 * explicitly recognized:
 *   1. A version that recognized only `findUnique`+`findUniqueOrThrow` as a
 *      pair, but didn't pre-check `update`/`delete`/`upsert` at all — a second
 *      tenant's owner successfully PATCHed a different tenant's job (HTTP 200,
 *      genuine cross-tenant write).
 *   2. After fixing #1, a "cleanup" assumed Prisma always reports
 *      `.findUniqueOrThrow()` calls to the hook as plain `'findUnique'` and
 *      removed the separate branch as dead code. That assumption was WRONG —
 *      Prisma's own `Operation` type (runtime/library.d.ts) lists
 *      `findUniqueOrThrow` and `findFirstOrThrow` as their OWN distinct
 *      operation names — and removing the branch let findUniqueOrThrow calls
 *      fall through to the raw, unprotected `query(a)`, genuinely returning a
 *      different tenant's full document over the API.
 *
 * So this version switches on Prisma's COMPLETE, documented `Operation` union
 * (every string runtime/library.d.ts says `$allOperations` can receive) and
 * throws for anything not explicitly classified, instead of defaulting to
 * "run it unmodified". A future Prisma upgrade that adds a new operation name
 * will throw loudly here, not leak data silently.
 *
 * Two `where` shapes exist and are handled differently:
 *   - Free-form `WhereInput` (findFirst[OrThrow], findMany, updateMany,
 *     deleteMany, count, aggregate, groupBy): merging `tenantId` into `where`
 *     is always valid — done directly.
 *   - Strict `WhereUniqueInput` (findUnique[OrThrow], update, delete, upsert):
 *     Prisma rejects an arbitrary extra field merged into this shape, AND the
 *     `query()` callback always re-invokes the SAME operation (no redirecting
 *     findUnique→findFirst from inside the hook). So:
 *       - findUnique/findUniqueOrThrow: `where` stays untouched; the RESULT is
 *         checked against the ambient tenantId afterward.
 *       - update/delete/upsert: `where` stays untouched, but a PRE-CHECK runs
 *         first via the UNEXTENDED base client's `findFirst` (free-form where,
 *         tenantId mergeable) against a copy of the same `where`. If no row
 *         matches for the current tenant, throw before the real op runs.
 */
const GLOBAL_MODELS = new Set<string>(['Tenant', 'Message', 'Organization', 'MarketplaceListing', 'PublicContactSubmission']);

/** Free-form WhereInput — safe to merge tenantId directly into `where`. */
const FILTERABLE_OPS = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy']);
/** Strict WhereUniqueInput, single-row read — verify tenant on the RESULT. */
const UNIQUE_READ_OPS = new Set(['findUnique', 'findUniqueOrThrow']);
/** Strict WhereUniqueInput, single-row write — verify tenant BEFORE running. */
const UNIQUE_WRITE_OPS = new Set(['update', 'delete', 'upsert']);
/** Inserts — stamp tenantId into the data being written. */
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);
/** Top-level, not model-scoped (model is undefined for these) — never reached
 *  with a model below, kept here only so the exhaustiveness check accounts
 *  for every name Prisma's Operation type defines. */
const RAW_OPS = new Set(['$queryRaw', '$executeRaw', '$queryRawUnsafe', '$executeRawUnsafe', 'findRaw', 'aggregateRaw', '$runCommandRaw']);

function notFoundError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('No record found', { code: 'P2025', clientVersion: Prisma.prismaVersion.client });
}

/** Prisma client delegate property name for a model: "DecisionRecord" -> "decisionRecord". */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Tenant-scoped accessor — use this in services. */
  readonly db = this.$extends({
    query: {
      $allModels: {
        $allOperations: async ({ model, operation, args, query }) => {
          if (model && GLOBAL_MODELS.has(model)) return query(args);

          const tenantId = tenantContext.tenantIdOrNull;
          if (!tenantId) return query(args); // unauthenticated/global routes

          const a: any = args ?? {};

          if (FILTERABLE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), tenantId };
            return query(a);
          }

          if (UNIQUE_READ_OPS.has(operation)) {
            const result = await query(a);
            if (result && (result as any).tenantId !== tenantId) {
              if (operation === 'findUniqueOrThrow') throw notFoundError();
              return null;
            }
            return result;
          }

          if (UNIQUE_WRITE_OPS.has(operation)) {
            if (!model) throw notFoundError(); // defensive: should never happen
            if (a.where) {
              // a.where is already a valid WhereUniqueInput for this exact
              // operation (that's what makes it a UNIQUE_WRITE_OP) — including
              // when it's a COMPOUND unique selector like
              // `{ tenantId_agentKey: { tenantId, agentKey } }`. Found via load
              // testing: the previous version spread that shape into a
              // findFirst's WhereInput (`{ ...a.where, tenantId }`), which
              // rejects compound-unique keys as an unknown argument — a
              // deterministic crash on every upsert/update/delete against any
              // model whose unique lookup is a compound key (AgentInstallation,
              // MarketplaceInstall, etc.), not just a concurrency edge case.
              // Using findUnique with the SAME where shape on the unextended
              // base delegate, then verifying ownership on the RESULT (not the
              // query), works for both simple and compound unique keys alike.
              const baseDelegate = (this as any)[delegateName(model)];
              const owned = await baseDelegate.findUnique({ where: a.where, select: { id: true, tenantId: true } });
              if (owned && (owned as any).tenantId !== tenantId) throw notFoundError(); // exists, but belongs to another tenant
              // update/delete require an existing, tenant-owned row. upsert's
              // create branch legitimately has no existing row yet — that's
              // not a violation, it falls through to the create below.
              if (!owned && operation !== 'upsert') throw notFoundError();
            }
            if (operation === 'upsert') a.create = { ...(a.create ?? {}), tenantId };
            return query(a);
          }

          if (CREATE_OPS.has(operation)) {
            if (operation === 'create') {
              a.data = { ...(a.data ?? {}), tenantId };
            } else {
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              a.data = rows.map((r: any) => ({ ...r, tenantId }));
            }
            return query(a);
          }

          if (RAW_OPS.has(operation)) return query(a); // not model-scoped; never reached with `model` set

          // Fail CLOSED: an operation Prisma can dispatch that this extension
          // does not explicitly classify must not silently run unprotected.
          throw new Error(`PrismaService: unhandled tenant-scoped operation "${operation}" on model "${model}" — classify it in prisma.service.ts before use.`);
        },
      },
    },
  });

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export type Tx = Prisma.TransactionClient;
