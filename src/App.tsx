import { Alert, Badge, Button, Spinner, Typography } from '@marcllopis/unityui';
import { useEffect, useMemo, useState } from 'react';
import { EXAMPLES } from './examples';
import { LIMITS } from './shared/catalog';
import type { UiDocument } from './shared/catalog';
import { exportJsx } from './shared/exportJsx';
import { lint } from './shared/lint';
import { buildTree } from './shared/tree';
import type { Issue } from './shared/tree';
import { Renderer } from './studio/Renderer';
import { useGeneration } from './studio/useGeneration';
import type { GenerationStats } from './studio/useGeneration';

type Tab = 'preview' | 'code' | 'json';

const REPO_URL = 'https://github.com/MarcCodesAgain/unityui-studio';
const UNITYUI_URL = 'https://www.npmjs.com/package/@marcllopis/unityui';

function formatCost(usd: number): string {
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`;
}

function Stats({ stats, fromExample }: { stats: GenerationStats | null; fromExample: boolean }) {
  if (fromExample) {
    return <p className="stats-note">Example screen, loaded without calling the API.</p>;
  }
  if (!stats) return null;
  const { usage } = stats;
  const input = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  return (
    <dl className="stats">
      <div>
        <dt>Model</dt>
        <dd>{stats.model}</dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{(stats.ms / 1000).toFixed(1)} s</dd>
      </div>
      <div>
        <dt>Tokens in / out</dt>
        <dd>
          {input.toLocaleString('en')} / {usage.outputTokens.toLocaleString('en')}
          {usage.cacheReadTokens > 0 && <span className="muted"> ({usage.cacheReadTokens.toLocaleString('en')} cached)</span>}
        </dd>
      </div>
      <div>
        <dt>Cost</dt>
        <dd>{formatCost(stats.costUsd)}</dd>
      </div>
    </dl>
  );
}

function Checks({ issues, count, final }: { issues: Issue[]; count: number; final: boolean }) {
  if (!final) return null;
  if (issues.length === 0) {
    return (
      <p className="check-ok">
        All checks passed: {count} components, valid structure, no accessibility warnings.
      </p>
    );
  }
  return (
    <ul className="issues" aria-label="Checks">
      {issues.map((issue, i) => (
        <li key={i} className={issue.severity}>
          <span className="issue-kind">{issue.severity === 'error' ? 'Dropped' : 'Warning'}</span>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const generation = useGeneration();
  const [prompt, setPrompt] = useState('');
  const [editCurrent, setEditCurrent] = useState(true);
  const [tab, setTab] = useState<Tab>('preview');
  const [exampleIndex, setExampleIndex] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const { load } = generation;

  useEffect(() => {
    load(EXAMPLES[0].document);
  }, [load]);

  const tree = useMemo(() => buildTree(generation.nodes), [generation.nodes]);
  const final = generation.status === 'done';
  const issues = useMemo(
    () => (final ? [...tree.issues, ...lint(tree.nodes, tree.roots)] : tree.issues),
    [final, tree],
  );
  const document: UiDocument | null = tree.nodes.length ? { title: generation.title || 'Screen', nodes: tree.nodes } : null;
  const code = useMemo(() => exportJsx(generation.title || 'Generated screen', tree.roots), [generation.title, tree.roots]);
  const streaming = generation.status === 'streaming';
  const editing = Boolean(document) && editCurrent;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (prompt.trim().length < 3 || streaming) return;
    setExampleIndex(null);
    setTab('preview');
    void generation.generate(prompt.trim(), editing ? document : null);
  };

  const pickExample = (index: number) => {
    setExampleIndex(index);
    setEditCurrent(true);
    load(EXAMPLES[index].document);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(tab === 'json' ? JSON.stringify(document, null, 2) : code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="studio">
      <aside className="panel">
        <header className="panel-header">
          <Typography variant="h4" noHighlight>
            UnityUI Studio
          </Typography>
          <Typography variant="bodySm" color="secondary">
            Describe a screen and Claude Haiku builds it from the components of the UnityUI design system, and nothing else.
          </Typography>
        </header>

        <form className="prompt" onSubmit={submit}>
          <label htmlFor="prompt" className="field-label">
            {editing ? 'What should change?' : 'Describe a screen'}
          </label>
          <textarea
            id="prompt"
            value={prompt}
            maxLength={LIMITS.promptChars}
            rows={5}
            placeholder={editing ? 'Add a phone field and make the button full width' : 'A checkout page with an order summary and card details'}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
            }}
          />
          <div className="prompt-meta">
            {document ? (
              <label className="toggle">
                <input type="checkbox" checked={editCurrent} onChange={(e) => setEditCurrent(e.target.checked)} />
                Change the current screen
              </label>
            ) : (
              <span />
            )}
            <span className="muted">
              {prompt.length}/{LIMITS.promptChars}
            </span>
          </div>
          <Button type="submit" variant="primary" fullWidth loading={streaming} disabled={prompt.trim().length < 3 || streaming}>
            {editing ? 'Update screen' : 'Generate screen'}
          </Button>
        </form>

        {generation.error && (
          <Alert variant="error" title="No screen this time">
            {generation.error}
          </Alert>
        )}

        <section className="block" aria-labelledby="examples-title">
          <h2 id="examples-title" className="block-title">
            Examples
          </h2>
          <ul className="examples">
            {EXAMPLES.map((example, i) => (
              <li key={example.document.title}>
                <button type="button" className={i === exampleIndex ? 'example active' : 'example'} onClick={() => pickExample(i)}>
                  <span className="example-name">{example.document.title}</span>
                  <span className="example-prompt">{example.prompt}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="block" aria-labelledby="result-title">
          <h2 id="result-title" className="block-title">
            This screen
          </h2>
          <Stats stats={generation.stats} fromExample={exampleIndex !== null} />
          <Checks issues={issues} count={tree.nodes.length} final={final} />
        </section>

        <section className="block" aria-labelledby="how-title">
          <h2 id="how-title" className="block-title">
            How it works
          </h2>
          <ol className="how">
            <li>The component catalog is written into the prompt as type signatures, and the same schema validates every answer, so an invented component or prop never reaches the screen.</li>
            <li>The answer streams as a flat list of nodes. Each one is validated before it renders, so the screen builds up live.</li>
            <li>Structure, accessibility and design rules are checked after every generation, and an eval suite measures them across many prompts.</li>
          </ol>
          <p className="links">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source code
            </a>
            <a href={UNITYUI_URL} target="_blank" rel="noreferrer">
              UnityUI on npm
            </a>
          </p>
        </section>
      </aside>

      <main className="stage">
        <div className="toolbar">
          <div className="toolbar-title">
            <Typography variant="label" noHighlight>
              {generation.title || 'Untitled screen'}
            </Typography>
            {streaming && (
              <span className="live">
                <Spinner size="sm" label="Generating" />
                {tree.nodes.length ? `${tree.nodes.length} components so far` : 'Planning the layout'}
              </span>
            )}
            {exampleIndex !== null && <Badge label="Example" variant="outline" />}
          </div>
          <div className="toolbar-actions">
            <div className="tabs" role="tablist" aria-label="View">
              {(['preview', 'code', 'json'] as const).map((value) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value} className="tab" onClick={() => setTab(value)}>
                  {value === 'preview' ? 'Preview' : value === 'code' ? 'React' : 'JSON'}
                </button>
              ))}
            </div>
            {tab !== 'preview' && (
              <Button variant="secondary" size="sm" onClick={copy} disabled={!document}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </div>
        </div>

        <div className="canvas" aria-busy={streaming}>
          {tab === 'preview' && (tree.roots.length ? <Renderer roots={tree.roots} /> : <p className="muted">The screen will appear here as it is written.</p>)}
          {tab === 'code' && <pre className="code">{code}</pre>}
          {tab === 'json' && <pre className="code">{JSON.stringify(document, null, 2)}</pre>}
        </div>
      </main>
    </div>
  );
}
