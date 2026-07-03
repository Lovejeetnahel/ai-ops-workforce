import { PrismaClient, IndustryModule } from '@prisma/client';
import { hash as bcryptHash } from 'bcryptjs';
import { getModuleConfig } from '@aiow/config';

/**
 * Seeds three demo tenants — one per industry module — each with an owner, two
 * staff, a couple of contacts/leads, and the module's automation presets. Run:
 *   pnpm --filter @aiow/api prisma db seed
 */
const prisma = new PrismaClient();
const hash = (pw: string) => bcryptHash(pw, 12);

const TENANTS: { name: string; slug: string; module: IndustryModule; staff: { name: string; skills: string[]; zones: string[] }[] }[] = [
  {
    name: 'Acme HVAC & Plumbing', slug: 'acme-hvac', module: 'FIELD_SERVICES',
    staff: [
      { name: 'Tina Tech', skills: ['Heating', 'Cooling'], zones: ['Downtown', 'Eastside'] },
      { name: 'Pablo Pipes', skills: ['Plumbing'], zones: ['Westside'] },
    ],
  },
  {
    name: 'Cornerstone Property Mgmt', slug: 'cornerstone-pm', module: 'PROPERTY_MANAGEMENT',
    staff: [
      { name: 'Carl Contractor', skills: ['Plumbing', 'Electrical'], zones: ['Maple Apartments'] },
      { name: 'Hana Handy', skills: ['HVAC', 'Appliance'], zones: ['Oak Towers'] },
    ],
  },
  {
    name: 'Bright Immigration Services', slug: 'bright-immigration', module: 'SERVICE_AGENCIES',
    staff: [
      { name: 'Cora Caseworker', skills: ['Immigration'], zones: [] },
      { name: 'Sam Staffing', skills: ['Staffing'], zones: [] },
    ],
  },
];

async function main() {
  for (const t of TENANTS) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: {},
      create: { name: t.name, slug: t.slug, industryModule: t.module },
    });

    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: `owner@${t.slug}.test` } },
      update: {},
      create: { tenantId: tenant.id, email: `owner@${t.slug}.test`, passwordHash: await hash('password123'), name: 'Owner', role: 'OWNER' },
    });

    for (const s of t.staff) {
      await prisma.user.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: `${s.name.split(' ')[0].toLowerCase()}@${t.slug}.test` } },
        update: {},
        create: {
          tenantId: tenant.id, email: `${s.name.split(' ')[0].toLowerCase()}@${t.slug}.test`,
          passwordHash: await hash('password123'), name: s.name, role: 'STAFF', skills: s.skills, serviceZones: s.zones,
        },
      });
    }

    // Seed automation presets for the module.
    const presets = getModuleConfig(t.module).automations;
    for (const p of presets) {
      const exists = await prisma.automationRule.findFirst({ where: { tenantId: tenant.id, presetKey: p.key } });
      if (exists) continue;
      await prisma.automationRule.create({
        data: {
          tenantId: tenant.id, name: p.name, triggerEvent: p.triggerEvent,
          conditions: p.conditions as any, actions: p.actions as any,
          enabled: p.enabledByDefault, presetKey: p.key,
        },
      });
    }

    // A couple of demo contacts + leads.
    const contact = await prisma.contact.create({
      data: { tenantId: tenant.id, name: 'Demo Customer', phone: '+15551230000', email: `demo@${t.slug}.test` },
    });
    await prisma.lead.create({
      data: {
        tenantId: tenant.id, contactId: contact.id, entityType: getModuleConfig(t.module).entities[0].key,
        stage: 'NEW', source: 'seed', serviceType: t.staff[0].skills[0] ?? 'General', urgency: 'NORMAL',
      },
    });

    console.log(`Seeded ${t.name} (${tenant.id}) — login owner@${t.slug}.test / password123`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
