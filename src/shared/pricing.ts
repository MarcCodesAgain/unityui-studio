// Claude Haiku 5.5 list prices in USD per million tokens, for prompts up to
// 100K tokens (every request here is far below that). Cache reads cost 10% of
// the input price and 5-minute cache writes 125%.

export const PRICE_PER_MTOK = {
  input: 0.1,
  output: 0.5,
  cacheRead: 0.01,
  cacheWrite: 0.125,
} as const;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function estimateCost(usage: Usage): number {
  return (
    (usage.inputTokens * PRICE_PER_MTOK.input +
      usage.outputTokens * PRICE_PER_MTOK.output +
      usage.cacheReadTokens * PRICE_PER_MTOK.cacheRead +
      usage.cacheWriteTokens * PRICE_PER_MTOK.cacheWrite) /
    1_000_000
  );
}
