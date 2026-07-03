import { Logger } from '@nestjs/common';
import { VisionPort } from '../ports';

/**
 * Vision/OCR adapter for field media. Reference implementation targets a
 * multimodal endpoint; when no VISION_API_KEY is set it returns a safe,
 * deterministic result derived from the URL/hint so field flows (attachment
 * tagging, OCR capture) work offline without fabricating data.
 */
export class VisionAdapter implements VisionPort {
  private readonly logger = new Logger(VisionAdapter.name);

  constructor(private readonly apiKey?: string) {}

  async analyze(input: { url: string; hint?: string }) {
    if (!this.apiKey) {
      // Offline: derive coarse labels from the filename/hint — no invented OCR.
      const name = decodeURIComponent(input.url.split('/').pop() ?? '').toLowerCase();
      const labels = ['before', 'after', 'damage', 'invoice', 'meter', 'panel', 'roof', 'leak']
        .filter((l) => name.includes(l) || input.hint?.toLowerCase().includes(l));
      return { labels, summary: undefined, ocrText: undefined };
    }

    const res = await fetch('https://api.vision.example/v1/analyze', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: input.url, features: ['ocr', 'labels', 'caption'], hint: input.hint }),
    });
    if (!res.ok) throw new Error(`Vision ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return { ocrText: data.ocrText, labels: data.labels ?? [], summary: data.caption };
  }
}
