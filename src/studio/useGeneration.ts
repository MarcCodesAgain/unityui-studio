import { Allow, parse } from 'partial-json';
import { useCallback, useRef, useState } from 'react';
import type { UiDocument } from '../shared/catalog';
import { jsonBody } from '../shared/json';
import type { Usage } from '../shared/pricing';

export interface GenerationStats {
  model: string;
  usage: Usage;
  costUsd: number;
  ms: number;
}

export type Status = 'idle' | 'streaming' | 'done' | 'error';

interface State {
  status: Status;
  /** Title and nodes parsed so far. While streaming, the last node may still be incomplete. */
  title: string;
  nodes: unknown[];
  stats: GenerationStats | null;
  error: string | null;
}

const INITIAL: State = { status: 'idle', title: '', nodes: [], stats: null, error: null };

type ServerEvent =
  | { type: 'text'; text: string }
  | ({ type: 'done' } & GenerationStats)
  | { type: 'error'; message: string };

/**
 * Reads the partial JSON as it streams. Every complete node except the last is
 * stable; the last one is held back until the next node starts or the stream
 * ends, so half-written props never reach the renderer.
 */
export function readPartial(json: string, final: boolean): Pick<State, 'title' | 'nodes'> {
  try {
    const doc = parse(jsonBody(json, final), Allow.ALL) as Partial<{ title: unknown; nodes: unknown }> | undefined;
    const nodes = Array.isArray(doc?.nodes) ? doc.nodes : [];
    return {
      title: typeof doc?.title === 'string' ? doc.title : '',
      nodes: final ? nodes : nodes.slice(0, -1),
    };
  } catch {
    return { title: '', nodes: [] };
  }
}

export function useGeneration() {
  const [state, setState] = useState<State>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback((doc: UiDocument) => {
    abortRef.current?.abort();
    setState({ status: 'done', title: doc.title, nodes: doc.nodes, stats: null, error: null });
  }, []);

  const generate = useCallback(async (prompt: string, current: UiDocument | null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...INITIAL, status: 'streaming', title: current ? prev.title : '', nodes: current ? prev.nodes : [] }));

    let json = '';
    let pending = '';
    let finished = false;
    const fail = (message: string) =>
      setState((prev) => ({ ...prev, status: 'error', error: message }));

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, current }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        return fail(body?.message ?? `The server answered ${response.status}.`);
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += value;
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ServerEvent;
          if (event.type === 'text') {
            json += event.text;
            const partial = readPartial(json, false);
            // During an edit, keep showing the old screen until the new one has content.
            if (partial.nodes.length > 0) setState((prev) => ({ ...prev, ...partial }));
          } else if (event.type === 'done') {
            const { type: _type, ...stats } = event;
            finished = true;
            setState((prev) => ({ ...prev, ...readPartial(json, true), status: 'done', stats }));
          } else {
            return fail(event.message);
          }
        }
      }
      if (!finished) fail('The connection closed before the screen was finished. Please try again.');
    } catch (error) {
      if (controller.signal.aborted) return;
      fail(error instanceof Error ? `Connection lost: ${error.message}` : 'Connection lost.');
    }
  }, []);

  return { ...state, generate, load };
}
