// One call to Claude: describe a screen, stream back the JSON document.
// Shared by the HTTP endpoint and the eval runner so both measure the same thing.

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, userMessage } from '../src/shared/prompt.js';
import { estimateCost } from '../src/shared/pricing.js';
import type { Usage } from '../src/shared/pricing.js';

export const MODEL = 'claude-haiku-5-5';

export type Effort = 'low' | 'medium' | 'high';

export interface GenerateInput {
  prompt: string;
  /** The screen being edited, when this is a change request. */
  current: unknown | null;
  effort?: Effort;
  /** Hard limit for the whole generation, streaming included. */
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  usage: Usage;
  costUsd: number;
  stopReason: string | null;
  ms: number;
}

/** Raised for outcomes the user should see as a message rather than a crash. */
export class GenerationError extends Error {}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/**
 * Normal screens finish in 3 to 15 seconds. A stalled connection once took
 * several minutes in the evals, so every generation gets a deadline (Vercel
 * stops the function at 60 s anyway) and at most one retry.
 */
const DEFAULT_TIMEOUT_MS = 45_000;

export async function generate(input: GenerateInput, onText: (delta: string) => void): Promise<GenerateResult> {
  const started = Date.now();
  const signal = AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await run(input, onText, signal, started);
  } catch (error) {
    if (signal.aborted && !(error instanceof GenerationError)) {
      throw new GenerationError('Claude took too long to answer. Please try again.');
    }
    throw error;
  }
}

async function run(input: GenerateInput, onText: (delta: string) => void, signal: AbortSignal, started: number): Promise<GenerateResult> {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 16000,
    // The catalog and rules are the same for every request, so they are cached.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: input.effort ?? 'low' },
    messages: [{ role: 'user', content: userMessage(input.prompt, input.current) }],
  }, { signal, maxRetries: 1 });

  let text = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      text += event.delta.text;
      onText(event.delta.text);
    }
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    throw new GenerationError('Claude declined this request. Try describing a different screen.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new GenerationError('The screen was too large to finish. Try asking for something smaller.');
  }

  const usage: Usage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };

  return { text, usage, costUsd: estimateCost(usage), stopReason: message.stop_reason, ms: Date.now() - started };
}
