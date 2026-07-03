import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getModuleConfig } from '@aiow/config';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessBrainService } from '../brain/business-brain.service';
import { tenantContext } from '../common/tenancy/tenant-context';

/**
 * Seeds each demo tenant's Business Brain by running the REAL ingest pipeline
 * (chunk → embed → pgvector), so RAG works end-to-end immediately. Derives
 * services/pricing from the tenant's industry module config and adds a generic
 * profile + FAQ. Idempotency is left to the operator (re-running adds versions).
 *
 *   pnpm --filter @aiow/api seed:brain
 *
 * Requires: migrated DB with pgvector, and Redis up (full AppModule boots the
 * EventBus). Embeddings run in offline stub mode unless VOYAGE_API_KEY is set.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const prisma = app.get(PrismaService);
  const brain = app.get(BusinessBrainService);

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, industryModule: true } });

  for (const t of tenants) {
    const config = getModuleConfig(t.industryModule);
    await tenantContext.run({ tenantId: t.id }, async () => {
      await brain.ingest({
        type: 'PROFILE',
        title: `About ${t.name}`,
        visibility: 'PUBLIC',
        content:
          `${t.name} is a ${config.label} business. ${config.tagline} ` +
          `We serve customers via phone, SMS, and web chat, and book visits automatically.`,
      });

      await brain.ingest({
        type: 'SERVICE',
        title: 'Services offered',
        visibility: 'PUBLIC',
        content:
          'We offer: ' +
          config.intakeFields.find((f) => f.key === 'serviceType' || f.key === 'issueType')?.options?.join(', ') +
          '. Emergency service is available for urgent issues.',
      });

      await brain.ingest({
        type: 'PRICING',
        title: 'Pricing & quotes',
        visibility: 'PUBLIC',
        content:
          'Standard service call fee is $89, applied to the final bill if you proceed. ' +
          'Written quotes are provided before any major work and are valid for 30 days.',
      });

      await brain.ingest({
        type: 'FAQ',
        title: 'Common questions',
        visibility: 'PUBLIC',
        content:
          'Q: What are your hours? A: We answer calls 24/7 with same-day scheduling when available.\n\n' +
          'Q: Do you offer emergency service? A: Yes — emergencies are fast-tracked to the next available technician.\n\n' +
          'Q: How do I pay? A: We send a secure payment link by SMS or email after the work is complete.',
      });

      await brain.ingest({
        type: 'SOP',
        title: 'Booking SOP (internal)',
        visibility: 'INTERNAL',
        content:
          'Always capture name, callback number, and service address before booking. ' +
          'Flag anything described as flooding, gas, or no-heat as an EMERGENCY and dispatch immediately.',
      });
    });
    Logger.log(`Seeded Business Brain for ${t.name}`, 'SeedBrain');
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
