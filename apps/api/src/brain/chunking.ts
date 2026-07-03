/**
 * Paragraph-aware text chunker for the Business Brain. Splits on blank lines,
 * then packs paragraphs into ~maxChars windows with a small overlap so retrieval
 * keeps local context. Deliberately dependency-free; swap for a token-accurate
 * splitter (tiktoken) later without changing callers.
 */
export function chunkText(text: string, maxChars = 900, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length <= maxChars) return clean ? [clean] : [];

  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
  };

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxChars && current) {
      push();
      // carry an overlap tail into the next window
      current = current.slice(-overlap) + '\n\n' + para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
    // a single oversized paragraph: hard-split it
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars - overlap);
    }
  }
  push();
  return chunks;
}

/** Rough token estimate (~4 chars/token) for storage/telemetry only. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
