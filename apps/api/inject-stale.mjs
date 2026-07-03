import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const tenant = await p.tenant.findFirst();
if (!tenant) { console.log('ERROR: no tenant'); process.exit(1); }

// Create a minimal draft invoice (lineItems go in data JSON field)
const doc = await p.document.create({
  data: {
    tenantId: tenant.id,
    type: 'INVOICE',
    status: 'DRAFT',
    title: 'PhaseC Sweep Test Invoice',
    amount: 77,
    data: { lineItems: [{ description: 'Test item', unitPrice: 77, quantity: 1 }] },
  }
});

// Create a PENDING manual payment — simulates a crashed settle()
const pay = await p.payment.create({
  data: {
    tenantId: tenant.id,
    contactId: null,
    documentId: doc.id,
    amount: 77,
    currency: 'usd',
    status: 'PENDING',
    provider: 'STRIPE',
    externalRef: 'manual',
  }
});

// Backdate createdAt to 10 minutes ago (past the 5-min sweep threshold)
const stale = new Date(Date.now() - 10 * 60 * 1000);
await p.$executeRawUnsafe('UPDATE "Payment" SET "createdAt" = $1 WHERE id = $2', stale, pay.id);

console.log('STALE_PAYMENT_ID=' + pay.id);
console.log('DOC_ID=' + doc.id);
console.log('TENANT_ID=' + tenant.id);

const check = await p.payment.findUnique({ where: { id: pay.id }, select: { id: true, status: true, createdAt: true } });
console.log('Confirmed status=' + check.status + ' createdAt=' + check.createdAt.toISOString());

await p.$disconnect();
