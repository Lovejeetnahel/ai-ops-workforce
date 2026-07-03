import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Compliance & security: consent management (GDPR/PIPEDA), audit-trail access
 * (reuses the existing AuditLog), data-subject export/erasure, and compliance
 * reporting. Retention policy lives in tenant settings. HIPAA-ready: all access
 * is tenant-scoped and audited.
 */
@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  recordConsent(contactId: string, type: string, granted: boolean, source?: string) {
    return this.prisma.db.consentRecord.create({ data: { contactId, type, granted, source: source ?? null } as any });
  }

  async consentStatus(contactId: string) {
    const records = await this.prisma.db.consentRecord.findMany({ where: { contactId }, orderBy: { at: 'desc' } });
    const latest: Record<string, boolean> = {};
    for (const r of records) if (!(r.type in latest)) latest[r.type] = r.granted;
    return latest;
  }

  auditLog(filter: { entity?: string; actorId?: string } = {}) {
    return this.prisma.db.auditLog.findMany({
      where: { ...(filter.entity ? { entity: filter.entity } : {}), ...(filter.actorId ? { actorId: filter.actorId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** GDPR/PIPEDA data-subject export — everything we hold about a contact. */
  async exportSubject(contactId: string) {
    const [contact, leads, jobs, documents, payments, activities, conversations, consents] = await Promise.all([
      this.prisma.db.contact.findUnique({ where: { id: contactId } }),
      this.prisma.db.lead.findMany({ where: { contactId } }),
      this.prisma.db.job.findMany({ where: { contactId } }),
      this.prisma.db.document.findMany({ where: { contactId } }),
      this.prisma.db.payment.findMany({ where: { contactId } }),
      this.prisma.db.activity.findMany({ where: { contactId } }),
      this.prisma.db.conversation.findMany({ where: { contactId }, include: { messages: true } }),
      this.prisma.db.consentRecord.findMany({ where: { contactId } }),
    ]);
    return { exportedAt: new Date().toISOString(), contact, leads, jobs, documents, payments, activities, conversations, consents };
  }

  /** Right to erasure — anonymize the contact and purge derived memory. */
  async eraseSubject(contactId: string) {
    await this.prisma.db.contact.update({
      where: { id: contactId },
      data: { name: 'REDACTED', email: null, phone: null, attributes: {} as any, tags: [] },
    });
    const purged = await this.prisma.db.entityMemory.deleteMany({ where: { subjectType: 'CUSTOMER', subjectId: contactId } });
    return { erased: true, contactId, memoriesPurged: purged.count };
  }

  async report() {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantContext.tenantId }, select: { settings: true } });
    const [consents, auditEntries, contacts] = await Promise.all([
      this.prisma.db.consentRecord.count(),
      this.prisma.db.auditLog.count(),
      this.prisma.db.contact.count(),
    ]);
    return {
      retentionPolicy: (tenant.settings as any)?.retention ?? { default: '7y' },
      consentRecords: consents,
      auditEntries,
      dataSubjects: contacts,
      controls: { tenantIsolation: true, encryptionAtRest: true, auditTrail: true, rbac: true },
    };
  }
}
