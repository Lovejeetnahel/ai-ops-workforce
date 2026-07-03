import { Injectable } from '@nestjs/common';
import { BaseEmployeeAgent } from '../framework/base-employee.agent';
import { EmployeeKit } from '../framework/employee-kit.service';
import { AgentDefinition, EmployeeResult, ExecuteContext } from '../framework/employee.types';

/**
 * Recruiting AI — generates job postings, ranks candidates, and tracks a hiring
 * pipeline. Candidates are stored as CRM Contacts tagged "candidate" (reuse, not
 * a new table); postings are stored as INTERNAL Business Brain knowledge.
 */
@Injectable()
export class RecruitingEmployee extends BaseEmployeeAgent {
  readonly definition: AgentDefinition = {
    key: 'recruiting',
    name: 'Recruiting AI',
    department: 'People',
    description: 'Job postings, resume parsing, candidate ranking, hiring pipeline, onboarding.',
    defaultAuthority: 'APPROVE',
    tools: ['llm', 'ingest_knowledge', 'remember'],
    triggers: [],
  };

  constructor(kit: EmployeeKit) {
    super(kit);
  }

  protected execute(ctx: ExecuteContext): Promise<EmployeeResult> {
    switch (ctx.input.type) {
      case 'job_posting':
        return this.jobPosting(ctx);
      case 'rank_candidate':
        return this.rankCandidate(ctx);
      default:
        return Promise.resolve({ ok: false, summary: `Recruiting AI: unknown task ${ctx.input.type}` });
    }
  }

  private async jobPosting(ctx: ExecuteContext): Promise<EmployeeResult> {
    const role = String(ctx.input.params?.role ?? 'Field Technician');
    const posting = await this.think('You are a recruiter. Write a compelling, concise job posting (role, responsibilities, requirements, benefits).', `Create a job posting for: ${role}. ${ctx.input.params?.notes ?? ''}`);
    await this.kit.brain.ingest({ type: 'DOCUMENT', title: `Job posting — ${role}`, content: posting, visibility: 'INTERNAL', source: 'recruiting-ai' });
    await this.activity({ type: 'AI_ACTION', title: `Recruiting AI drafted a job posting: ${role}` });
    return { ok: true, summary: `Job posting created for ${role}`, output: { posting } };
  }

  private async rankCandidate(ctx: ExecuteContext): Promise<EmployeeResult> {
    const p = ctx.input.params ?? {};
    const role = String(p.role ?? 'the role');
    const resume = String(p.resumeText ?? '');
    const assessment = await this.think('You are a hiring assistant. Rate fit 0-100 and give 2 bullet strengths and 1 concern. Start with "Score: N".', `Role: ${role}\nResume:\n${resume.slice(0, 2000)}`);
    const score = Number(/Score:\s*(\d+)/i.exec(assessment)?.[1] ?? 50);

    const candidate = await this.kit.prisma.db.contact.create({
      data: { name: String(p.name ?? 'Candidate'), email: (p.email as string) ?? null, phone: (p.phone as string) ?? null, tags: ['candidate'], attributes: { role, score } } as any,
    });
    await this.remember(candidate.id, `Candidate for ${role}. ${assessment}`.slice(0, 500), undefined, 'candidate_assessment');
    await this.activity({ type: 'AI_ACTION', title: `Recruiting AI ranked candidate (${score}/100) for ${role}`, contactId: candidate.id });
    await this.logDecision(ctx.taskId, 'rank_candidate', { reason: assessment.slice(0, 200), confidence: score / 100, subjects: { contactId: candidate.id } });
    return { ok: true, summary: `Candidate ranked ${score}/100`, output: { contactId: candidate.id, score } };
  }
}
