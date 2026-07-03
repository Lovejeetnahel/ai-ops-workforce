import { Injectable } from '@nestjs/common';
import { Agent, AgentContext, AgentResult } from '../agent.interface';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { ModuleConfigService } from '../../common/module-config/module-config.service';

/**
 * VOICE AGENT — the AI receptionist. It does not run the audio itself (that's the
 * Vapi/Retell/Bland assistant configured with this tenant's persona + intake
 * fields); instead it owns the BUSINESS LOGIC around a call: it consumes the
 * normalized VoicePort webhook events, turns a completed call's collected fields
 * into a lead (via the CRM agent), and flags missed calls so automations can
 * text the caller back. The provider webhook is ingested by VoiceController.
 */
@Injectable()
export class VoiceAgent implements Agent {
  readonly name = 'voice';

  constructor(
    private readonly bus: EventBus,
    private readonly moduleConfig: ModuleConfigService,
  ) {}

  /**
   * Build the assistant configuration (persona + intake schema) we hand to the
   * voice provider when registering the tenant's phone number. This is how one
   * codebase yields an HVAC receptionist vs. an immigration intake coordinator.
   */
  async buildAssistantConfig(tenantId: string) {
    const config = await this.moduleConfig.forTenant(tenantId);
    return {
      systemPrompt: config.agentPersona,
      intake: config.intakeFields.map((f) => ({ key: f.key, prompt: f.prompt, required: f.required })),
      // Tool the assistant calls to hand structured data back to us.
      tools: [
        {
          name: 'submit_intake',
          description: 'Submit the collected caller details to book the appointment.',
          parameters: Object.fromEntries(config.intakeFields.map((f) => [f.key, { type: 'string' }])),
        },
      ],
    };
  }

  async run(ctx: AgentContext): Promise<AgentResult> {
    const event = ctx.event!;
    const data = event.payload as any;

    if (event.name === DomainEvents.CALL_MISSED) {
      // The missed-call automation preset handles the text-back; nothing else.
      return { agent: this.name, ok: true, summary: 'missed call flagged' };
    }

    // Completed call with structured intake → hand to CRM to create the lead.
    await this.bus.emit({
      name: DomainEvents.CALL_COMPLETED,
      tenantId: event.tenantId,
      payload: { collected: data.collected ?? {}, source: 'voice' },
    });
    return { agent: this.name, ok: true, summary: 'call processed → CRM', emitted: [DomainEvents.CALL_COMPLETED] };
  }
}
