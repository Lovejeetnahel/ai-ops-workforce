import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactSubmissionStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SubmitContactInput {
  name: string;
  email: string;
  company?: string;
  topic?: string;
  message: string;
  ip?: string;
}

const VALID_TOPICS = new Set(['general', 'sales', 'support', 'security']);
const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

/**
 * Public Contact form storage. `PublicContactSubmission` is a global
 * (tenant-agnostic) model — a prospect submitting this form has no tenant —
 * so this uses the BASE Prisma client directly (`this.prisma.publicContactSubmission`),
 * the same convention the codebase already uses for Tenant/Message/Organization.
 * Never touches tenant-scoped data; exposes nothing back to the caller beyond
 * a bare success acknowledgement.
 */
@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(input: SubmitContactInput): Promise<{ ok: true }> {
    const topic = VALID_TOPICS.has(input.topic ?? '') ? input.topic! : 'general';
    const ipHash = input.ip ? createHash('sha256').update(input.ip).digest('hex') : undefined;

    await this.prisma.publicContactSubmission.create({
      data: {
        name: input.name.trim().slice(0, 200),
        email: input.email.trim().slice(0, 320),
        company: input.company?.trim().slice(0, 200) || undefined,
        topic,
        message: input.message.trim().slice(0, 5000),
        ipHash,
      },
    });

    return { ok: true };
  }

  /**
   * Paginated triage list for the admin-token-gated retrieval endpoint.
   * Returns only what an operator needs to triage an inquiry — never the
   * IP hash (spam-abuse metadata, not operationally useful here).
   */
  async list(page = 1, pageSize = PAGE_SIZE_DEFAULT) {
    const take = Math.max(1, Math.min(PAGE_SIZE_MAX, pageSize));
    const skip = Math.max(0, (Math.max(1, page) - 1) * take);

    const [total, rows] = await Promise.all([
      this.prisma.publicContactSubmission.count(),
      this.prisma.publicContactSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          createdAt: true,
          name: true,
          email: true,
          company: true,
          topic: true,
          status: true,
          message: true,
        },
      }),
    ]);

    return { total, page: Math.max(1, page), pageSize: take, submissions: rows };
  }

  async updateStatus(id: string, status: ContactSubmissionStatus) {
    const existing = await this.prisma.publicContactSubmission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Submission not found');
    return this.prisma.publicContactSubmission.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }
}
