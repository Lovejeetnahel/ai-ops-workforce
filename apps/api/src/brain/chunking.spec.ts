import { chunkText, estimateTokens } from './chunking';

describe('Business Brain chunker', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('hello world')).toEqual(['hello world']);
  });

  it('returns nothing for empty/whitespace input', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('splits long text into multiple bounded chunks', () => {
    const para = 'A'.repeat(500);
    const text = [para, para, para, para].join('\n\n'); // ~2000 chars
    const chunks = chunkText(text, 900, 150);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(900);
  });

  it('estimates tokens at ~4 chars/token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
});
