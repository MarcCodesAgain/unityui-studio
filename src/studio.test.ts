import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { readPartial } from './studio/useGeneration';
import { RateLimiter } from '../server/rateLimit';
import { UiDocument } from './shared/catalog';
import { exportJsx } from './shared/exportJsx';
import { jsonBody } from './shared/json';
import { lint } from './shared/lint';
import { estimateCost } from './shared/pricing';
import { SYSTEM_PROMPT } from './shared/prompt';
import { buildTree } from './shared/tree';

const stack = (id: string, parent: string | null) => ({
  id,
  parent,
  component: 'Stack',
  props: { direction: 'vertical', gap: 'md', align: 'stretch', justify: 'start', wrap: false },
});
const text = (id: string, parent: string | null, variant = 'body', value = 'Hello') => ({
  id,
  parent,
  component: 'Typography',
  props: { variant, color: 'primary', text: value },
});
const button = (id: string, parent: string, variant = 'primary') => ({
  id,
  parent,
  component: 'Button',
  props: { variant, size: 'md', fullWidth: false, text: 'Save' },
});

describe('examples', () => {
  it.each(EXAMPLES.map((e) => [e.document.title, e.document] as const))('%s is valid, complete and lint-free', (_title, doc) => {
    expect(UiDocument.safeParse(doc).success).toBe(true);
    const tree = buildTree(doc.nodes);
    expect(tree.issues).toEqual([]);
    expect(tree.nodes).toHaveLength(doc.nodes.length);
    expect(lint(tree.nodes, tree.roots)).toEqual([]);
  });
});

describe('system prompt', () => {
  it('lists every component with its props as a type signature', () => {
    expect(SYSTEM_PROMPT).toContain('- Button: ');
    expect(SYSTEM_PROMPT).toContain('props: { variant: "primary" | "secondary" | "ghost"; size: "sm" | "md" | "lg"; fullWidth: boolean; text: string }');
    expect(SYSTEM_PROMPT).toContain('hint: string | null');
    expect(SYSTEM_PROMPT).toContain('options: { value: string; label: string }[]');
    for (const name of ['Stack', 'Grid', 'CardFooter', 'DataTable', 'Form', 'RadioGroup']) {
      expect(SYSTEM_PROMPT).toContain(`- ${name}: `);
    }
  });
});

describe('jsonBody', () => {
  it('ignores code fences and prose around the JSON', () => {
    expect(jsonBody('```json\n{"a":1}\n```', true)).toBe('{"a":1}');
    expect(jsonBody('Here you go: {"a":', false)).toBe('{"a":');
    expect(jsonBody('no json', false)).toBe('');
  });
});

describe('buildTree', () => {
  it('nests children under their parents in order', () => {
    const tree = buildTree([stack('page', null), text('a', 'page'), text('b', 'page')]);
    expect(tree.issues).toEqual([]);
    expect(tree.roots[0].children.map((c) => c.node.id)).toEqual(['a', 'b']);
  });

  it('drops nodes with unknown components or invalid props', () => {
    const tree = buildTree([stack('page', null), { id: 'x', parent: 'page', component: 'Carousel', props: {} }, { ...text('t', 'page'), props: { variant: 'huge', color: 'primary', text: 'Hi' } }]);
    expect(tree.nodes.map((n) => n.id)).toEqual(['page']);
    expect(tree.issues.filter((i) => i.severity === 'error')).toHaveLength(2);
  });

  it('drops children of missing parents, later parents and leaves', () => {
    const tree = buildTree([text('early', 'page'), stack('page', null), text('label', 'page'), text('inside-text', 'label')]);
    expect(tree.nodes.map((n) => n.id)).toEqual(['page', 'label']);
    expect(tree.issues.map((i) => i.nodeId)).toEqual(['early', 'inside-text']);
  });

  it('only allows card sections directly inside a card', () => {
    const tree = buildTree([stack('page', null), { id: 'body', parent: 'page', component: 'CardBody', props: {} }]);
    expect(tree.issues[0].message).toContain('must sit directly inside a Card');
  });

  it('wraps loose card content in a CardBody', () => {
    const tree = buildTree([{ id: 'card', parent: null, component: 'Card', props: { variant: 'default' } }, text('a', 'card'), text('b', 'card')]);
    const [body] = tree.roots[0].children;
    expect(body.node.component).toBe('CardBody');
    expect(body.children.map((c) => c.node.id)).toEqual(['a', 'b']);
    expect(tree.issues).toHaveLength(1);
  });

  it('rejects duplicate ids', () => {
    const tree = buildTree([stack('page', null), text('a', 'page'), text('a', 'page')]);
    expect(tree.nodes).toHaveLength(2);
    expect(tree.issues[0].message).toContain('Duplicate');
  });
});

describe('lint', () => {
  const run = (nodes: unknown[]) => {
    const tree = buildTree(nodes);
    return lint(tree.nodes, tree.roots).map((i) => i.message);
  };

  it('flags skipped heading levels and several h1s', () => {
    const messages = run([stack('page', null), text('h1', 'page', 'h1'), text('h3', 'page', 'h3'), text('h1b', 'page', 'h1')]);
    expect(messages.some((m) => m.includes('from level 1 to 3'))).toBe(true);
    expect(messages.some((m) => m.includes('2 top-level headings'))).toBe(true);
  });

  it('flags two primary buttons in the same group', () => {
    expect(run([stack('page', null), button('a', 'page'), button('b', 'page')])).toContain('More than one primary button side by side; keep one main action.');
    expect(run([stack('page', null), button('a', 'page'), button('b', 'page', 'secondary')])).toEqual([]);
  });

  it('flags empty containers and mismatched table rows', () => {
    const messages = run([
      stack('page', null),
      stack('empty', 'page'),
      {
        id: 't',
        parent: 'page',
        component: 'DataTable',
        props: { columns: [{ key: 'a', header: 'A', align: 'left' }, { key: 'b', header: 'B', align: 'left' }], rows: [{ cells: ['1'] }], striped: false, dense: false },
      },
    ]);
    expect(messages).toContain('Empty Stack.');
    expect(messages).toContain('Row 1 has 1 cells for 2 columns.');
  });
});

describe('exportJsx', () => {
  it('produces a component that imports only what it uses', () => {
    const tree = buildTree([stack('page', null), text('title', 'page', 'h1', 'Welcome <back>'), button('go', 'page')]);
    const code = exportJsx('Sign-up form', tree.roots);
    expect(code).toContain("import { Button, Typography } from '@marcllopis/unityui';");
    expect(code).toContain('export function SignupForm()');
    expect(code).toContain('<Typography variant="h1">{"Welcome <back>"}</Typography>');
    expect(code).toContain("style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'stretch', justifyContent: 'flex-start' }}");
  });

  it('ships a local Stat helper built from real UnityUI exports', () => {
    const tree = buildTree([{ id: 's', parent: null, component: 'Stat', props: { value: 19, decimals: '0', prefix: '€', suffix: ' / month', label: 'Pro', delta: null, trend: null } }]);
    const code = exportJsx('Price', tree.roots);
    expect(code).toContain("import { CountUp, StatDelta, StatLabel, StatValue } from '@marcllopis/unityui';");
    expect(code).toContain('function Stat(');
    expect(code).toContain('<Stat value={19} prefix="€" suffix=" / month" label="Pro" />');
  });

  it('keeps attribute strings with quotes valid', () => {
    const tree = buildTree([{ id: 'in', parent: null, component: 'Input', props: { label: 'Say "hi"', inputType: 'text', placeholder: null, hint: null, required: false } }]);
    expect(exportJsx('x', tree.roots)).toContain(`label={'Say "hi"'}`);
  });

  it('exports every example without leftovers', () => {
    for (const { document } of EXAMPLES) {
      const code = exportJsx(document.title, buildTree(document.nodes).roots);
      expect(code).not.toMatch(/undefined|null|\[object Object\]/);
    }
  });
});

describe('readPartial', () => {
  const json = JSON.stringify({ title: 'Form', nodes: [stack('page', null), text('a', 'page'), text('b', 'page')] });

  it('holds back the last node until the stream is finished', () => {
    const cut = json.slice(0, json.lastIndexOf('"Hello"') + 4);
    expect(readPartial(cut, false).nodes).toHaveLength(2);
    expect(readPartial(json, false).nodes).toHaveLength(2);
    expect(readPartial(json, true).nodes).toHaveLength(3);
  });

  it('survives garbage', () => {
    expect(readPartial('{"nodes": [}', false)).toEqual({ title: '', nodes: [] });
  });
});

describe('RateLimiter', () => {
  it('limits per IP and globally, and resets the next day', () => {
    let now = 0;
    const limiter = new RateLimiter({ perIpPerDay: 2, globalPerDay: 3, now: () => now });
    expect(limiter.take('a').ok).toBe(true);
    expect(limiter.take('a').ok).toBe(true);
    expect(limiter.take('a').ok).toBe(false);
    expect(limiter.take('b').ok).toBe(true);
    expect(limiter.take('c').ok).toBe(false);
    now += 24 * 60 * 60 * 1000;
    expect(limiter.take('a').ok).toBe(true);
  });
});

describe('estimateCost', () => {
  it('prices Claude Haiku 5.5 tokens', () => {
    expect(estimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeCloseTo(0.6);
    expect(estimateCost({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 })).toBeCloseTo(0.01);
  });
});
