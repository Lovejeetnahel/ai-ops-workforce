import { Injectable } from '@nestjs/common';
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
}
