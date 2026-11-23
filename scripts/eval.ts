// Runs every eval case against the real API and scores the answers.
//
//   npm run eval                     all cases, effort "low"
//   npm run eval -- --effort medium  compare another effort level
//   npm run eval -- --only login     a single case
//
// Each run calls Claude Haiku once per case, about $0.002 each, and writes a
// JSON report to evals/results/.

import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { CASES } from '../evals/cases.js';
import { generate } from '../server/generate.js';
import type { Effort } from '../server/generate.js';
import { UiDocument } from '../src/shared/catalog.js';
import { jsonBody } from '../src/shared/json.js';
import { lint } from '../src/shared/lint.js';
import { buildTree } from '../src/shared/tree.js';

const { values } = parseArgs({
  options: {
    effort: { type: 'string', default: 'low' },
    only: { type: 'string' },
  },
});

const effort = values.effort as Effort;
if (!['low', 'medium', 'high'].includes(effort)) throw new Error('--effort must be low, medium or high');
if (!process.env.ANTHROPIC_API_KEY) throw new Error('Set ANTHROPIC_API_KEY (for example in .env.local) before running the evals.');

const cases = values.only ? CASES.filter((c) => c.id === values.only) : CASES;

interface CaseResult {
  id: string;
  ok: boolean;
  valid: boolean;
  dropped: number;
  warnings: string[];
  missing: string[];
  nodes: number;
  ms: number;
  costUsd: number;
  outputTokens: number;
  error?: string;
  document?: unknown;
}

async function runCase(prompt: string, mustUse: string[], id: string): Promise<CaseResult> {
  const base = { id, ok: false, valid: false, dropped: 0, warnings: [], missing: [], nodes: 0, ms: 0, costUsd: 0, outputTokens: 0 };
  try {
    const result = await generate({ prompt, current: null, effort }, () => undefined);
    let json: unknown = null;
    try {
      json = JSON.parse(jsonBody(result.text, true));
    } catch {
      // Counted as invalid below.
    }
    const parsed = UiDocument.safeParse(json);
    const doc = parsed.success ? parsed.data : null;
    const tree = buildTree(doc?.nodes ?? []);
    // A checkbox or radio field inside a Form counts as using that control.
    const used = new Set<string>(tree.nodes.map((n) => n.component));
    for (const node of tree.nodes) {
      if (node.component !== 'Form') continue;
      for (const field of node.props.fields) {
        if (field.type === 'checkbox') used.add('Checkbox');
        if (field.type === 'radio') used.add('RadioGroup');
        if (field.type === 'input') used.add('Input');
        if (field.type === 'select') used.add('Select');
      }
    }
    const warnings = lint(tree.nodes, tree.roots).map((i) => i.message);
    const dropped = tree.issues.filter((i) => i.severity === 'error').length;
    const missing = mustUse.filter((c) => !used.has(c));
    return {
      ...base,
      valid: parsed.success,
      dropped,
      warnings,
      missing,
      nodes: tree.nodes.length,
      ms: result.ms,
      costUsd: result.costUsd,
      outputTokens: result.usage.outputTokens,
      document: doc ?? result.text,
      ok: parsed.success && dropped === 0 && warnings.length === 0 && missing.length === 0,
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }
}

const results: CaseResult[] = [];
for (const testCase of cases) {
  process.stdout.write(`${testCase.id.padEnd(14)} `);
  const result = await runCase(testCase.prompt, testCase.mustUse, testCase.id);
  results.push(result);
  const notes = [
    result.error,
    !result.valid && !result.error ? 'invalid document' : null,
    result.dropped ? `${result.dropped} dropped` : null,
    result.missing.length ? `missing ${result.missing.join(', ')}` : null,
    ...result.warnings,
  ].filter(Boolean);
  console.log(
    `${result.ok ? 'pass' : 'FAIL'}  ${String(result.nodes).padStart(3)} nodes  ${(result.ms / 1000).toFixed(1).padStart(5)} s  $${result.costUsd.toFixed(4)}  ${notes.join('; ')}`,
  );
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const sum = (pick: (r: CaseResult) => number) => results.reduce((total, r) => total + pick(r), 0);
const passed = results.filter((r) => r.ok).length;
const summary = {
  model: 'claude-haiku-5-5',
  effort,
  date: new Date().toISOString(),
  cases: results.length,
  passed,
  validJson: results.filter((r) => r.valid).length,
  withoutDroppedNodes: results.filter((r) => r.valid && r.dropped === 0).length,
  withoutWarnings: results.filter((r) => r.valid && r.warnings.length === 0).length,
  usedRequiredComponents: results.filter((r) => r.valid && r.missing.length === 0).length,
  avgSeconds: Number((sum((r) => r.ms) / results.length / 1000).toFixed(2)),
  medianSeconds: Number((median(results.map((r) => r.ms)) / 1000).toFixed(2)),
  maxSeconds: Number((Math.max(...results.map((r) => r.ms)) / 1000).toFixed(2)),
  avgCostUsd: Number((sum((r) => r.costUsd) / results.length).toFixed(5)),
  totalCostUsd: Number(sum((r) => r.costUsd).toFixed(4)),
};

console.log(
  `\n${passed}/${results.length} passed. Per screen: median ${summary.medianSeconds} s (max ${summary.maxSeconds} s), average $${summary.avgCostUsd}. Total $${summary.totalCostUsd}.`,
);

await mkdir('evals/results', { recursive: true });
const file = `evals/results/${summary.date.slice(0, 16).replace(/[:T]/g, '-')}-${effort}.json`;
await writeFile(file, `${JSON.stringify({ summary, results }, null, 2)}\n`);
console.log(`Report written to ${file}`);
