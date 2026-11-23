// POST /api/generate
//
// Body: { prompt: string, current?: UiDocument | null }
// Response: newline-delimited JSON events, so the browser can render the
// screen while it is still being written:
//   { "type": "text", "text": "..." }        a chunk of the JSON document
//   { "type": "done", "usage": {...}, ... }  final token usage and cost
//   { "type": "error", "message": "..." }    something the user should read

import { z } from 'zod';
import { LIMITS, UiDocument } from '../src/shared/catalog.js';
import { MODEL, GenerationError, generate } from './generate.js';
import { RateLimiter } from './rateLimit.js';

const Body = z.object({
  prompt: z.string().trim().min(3).max(LIMITS.promptChars),
  current: UiDocument.nullable().optional(),
});

// Per instance and in memory: a cheap first line of defence for a public demo.
// The hard ceiling is the monthly spend limit set in the Anthropic Console.
const limiter = new RateLimiter({
  perIpPerDay: Number(process.env.STUDIO_LIMIT_PER_IP ?? 15),
  globalPerDay: Number(process.env.STUDIO_LIMIT_GLOBAL ?? 400),
});

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; model: string; usage: import('../src/shared/pricing.js').Usage; costUsd: number; ms: number }
  | { type: 'error'; message: string };

function json(status: number, message: string): Response {
  return Response.json({ type: 'error', message } satisfies StreamEvent, { status });
}

export async function handleGenerate(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, 'Use POST.');
  if (process.env.STUDIO_FAKE_STREAM === '1') return fakeStream();
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(503, 'Live generation is switched off on this deployment. The examples still work.');
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return json(400, `Describe the screen in 3 to ${LIMITS.promptChars} characters.`);
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const verdict = limiter.take(ip);
  if (!verdict.ok) return json(429, verdict.message);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const result = await generate({ prompt: body.prompt, current: body.current ?? null }, (text) => send({ type: 'text', text }));
        send({ type: 'done', model: MODEL, usage: result.usage, costUsd: result.costUsd, ms: result.ms });
      } catch (error) {
        const message =
          error instanceof GenerationError ? error.message : 'Generation failed. Please try again in a moment.';
        if (!(error instanceof GenerationError)) console.error(error);
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/**
 * Development aid: replays an example screen in small chunks, so the streaming
 * UI can be worked on without an API key or any cost. Enable it with
 * STUDIO_FAKE_STREAM=1 in .env.local.
 */
async function fakeStream(): Promise<Response> {
  const { EXAMPLES } = await import('../src/examples/index.js');
  const text = JSON.stringify(EXAMPLES[1].document);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      for (let i = 0; i < text.length; i += 40) {
        send({ type: 'text', text: text.slice(i, i + 40) });
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      send({ type: 'done', model: 'fake-stream', usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0, ms: 0 });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } });
}
