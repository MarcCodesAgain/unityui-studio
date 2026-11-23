# UnityUI Studio

Describe a screen in plain words and Claude Haiku builds it live with the components of [UnityUI](https://www.npmjs.com/package/@marcllopis/unityui), my React design system. The result renders as it streams, is checked for structure and accessibility, and exports as React code that imports the real package.

The point of the project is the engineering around the model: the AI can only use components that exist, with props that exist, and every answer is validated and measured.

On the eval suite: **12 of 12 screens valid and free of accessibility warnings, a median of 6 seconds (10 at most) and under $0.001 per screen.**

## How it works

```
prompt ──► /api/generate ──► Claude Haiku 5.5 (catalog in a cached system prompt)
                                    │  JSON streams back
                                    ▼
             partial JSON parser ──► node-by-node validation (Zod)
                                    │
                                    ▼
              flat list ──► tree ──► UnityUI renderer ──► lint ──► JSX export
```

1. **The catalog is the contract.** [`src/shared/catalog.ts`](src/shared/catalog.ts) defines the 20 components and their props with Zod. [`signature.ts`](src/shared/signature.ts) prints them into the system prompt as compact type signatures, and the same schemas validate every node that comes back.
2. **A flat list instead of a tree.** A screen is a list of nodes that point to their parent by id. Parents come first, so the screen can be rendered while it streams, and a broken node can be dropped without losing its siblings.
3. **Validate, then render.** The browser parses the partial JSON as it arrives, validates each finished node and adds it to the tree. Rules the schema cannot express (unknown parents, children inside leaves, card sections outside cards, duplicate ids) are enforced in [`tree.ts`](src/shared/tree.ts); a broken node is dropped with its subtree instead of breaking the page.
4. **Lint the result.** [`lint.ts`](src/shared/lint.ts) checks heading order, labels, accessible names, one primary action per group, table shape and empty containers. The studio shows the warnings; the evals count them.
5. **Export.** [`exportJsx.ts`](src/shared/exportJsx.ts) turns the tree into a component that imports `@marcllopis/unityui`.
6. **Edit in place.** A change request sends the current screen with the instruction, and the model returns the updated screen keeping the ids that did not change.

### Why not structured outputs?

The first version sent the catalog to the API as a strict [structured output](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), so the API itself would guarantee valid JSON. The API compiles that schema into a grammar, and a union of 19 component types was rejected as too large (it accepted about 6). Cutting the catalog to fit would have made the tool worse, so the schema moved into the prompt and validation moved into code. The evals confirm the trade: every answer in the suite parses and validates.

## Cost and limits

The studio uses **Claude Haiku 5.5** with effort `low`, and caches the system prompt, which holds the whole catalog. A typical screen costs a fraction of a cent, and the studio shows the exact tokens and cost of each one.

A public demo needs guard rails:

- The examples load from static JSON, with no API call.
- Prompts are capped at 600 characters.
- Requests are limited per IP and globally per day (`STUDIO_LIMIT_PER_IP`, `STUDIO_LIMIT_GLOBAL`). The counters live in memory, so they are a first line of defence, not a guarantee.
- The real ceiling is the monthly spend limit set in the Anthropic Console.
- Without `ANTHROPIC_API_KEY` the API answers 503 and the studio keeps working with the examples.

## Evals

[`evals/cases.ts`](evals/cases.ts) holds 12 prompts in English, Spanish and Catalan, each with the components a good answer must use. `npm run eval` sends them all to the API and scores every answer:

- parses and validates against the catalog
- no nodes dropped by the tree rules
- no lint warnings
- uses the required components
- time and cost

```bash
npm run eval                      # effort "low", about $0.01 for the whole suite
npm run eval -- --effort medium   # compare another effort level
npm run eval -- --only login      # a single case
```

Reports, including every generated screen, are written to `evals/results/`. The prompt was tuned against them: the first run passed 8 of 12, with prices written as `display` headings (four `<h1>`s on one page) and skipped heading levels. Adding a `Stat` component for figures and tightening the heading rules brought it to 12 of 12. The runs also exposed a connection that stalled for minutes, which is why each generation now has a 45-second deadline and a single retry.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

The Vite dev server runs the same `/api/generate` handler that Vercel deploys, so there is nothing else to start. To work on the UI without an API key, set `STUDIO_FAKE_STREAM=1` in `.env.local` and the endpoint replays an example in small chunks.

| Command | What it does |
|---|---|
| `npm run dev` | Studio and API on one dev server |
| `npm test` | Unit tests: catalog, tree rules, lint, export, streaming parser, rate limiter |
| `npm run eval` | Model evals against the real API |
| `npm run lint` | oxlint |
| `npm run build` | Type-check and production build |

## Deploy

On Vercel, import the repository and add `ANTHROPIC_API_KEY` as an environment variable. `api/generate.ts` becomes a serverless function and everything else is static.

## Stack

React 19, TypeScript, Vite, styled-components, UnityUI, Zod, the Anthropic TypeScript SDK, partial-json, Vitest and Vercel Functions.

## Author

Built by Marc Llopis. More projects at [marcllopis-portfolio.vercel.app](https://marcllopis-portfolio.vercel.app).

## License

MIT
