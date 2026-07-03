import { Logger } from '@nestjs/common';
import { LlmPort } from '../ports';

/**
 * Anthropic adapter (LlmPort) — the reasoning brain shared by the Voice, Chat,
 * CRM and Document agents for NLU, lead qualification, summarization, and
 * tool-calling. Defaults to the latest Opus model. Falls back to a deterministic
 * stub when no API key is configured so the scaffold runs offline.
 */
export class AnthropicAdapter implements LlmPort {
  private readonly logger = new Logger(AnthropicAdapter.name);
  private readonly model = process.env.LLM_MODEL ?? 'claude-opus-4-8';

  constructor(private readonly apiKey?: string) {}

  async complete(input: {
    system: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    tools?: { name: string; description: string; input_schema: object }[];
    maxTokens?: number;
  }) {
    if (!this.apiKey) {
      this.logger.warn('[stub] LLM call — returning echo (set ANTHROPIC_API_KEY)');
      const last = input.messages.at(-1)?.content ?? '';
      return { text: `», noted: "${last.slice(0, 120)}". A teammate will follow up shortly.` };
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: input.maxTokens ?? 1024,
        system: input.system,
        messages: input.messages,
        tools: input.tools,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

    const data: any = await res.json();
    const text = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') ?? '';
    const toolCalls = data.content
      ?.filter((b: any) => b.type === 'tool_use')
      .map((b: any) => ({ name: b.name, input: b.input }));
    return { text, toolCalls };
  }
}
