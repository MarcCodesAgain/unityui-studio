// Vercel serverless function. All the logic lives in server/http.ts so the
// Vite dev server can run exactly the same code locally.

import { handleGenerate } from '../server/http.js';

export function POST(request: Request): Promise<Response> {
  return handleGenerate(request);
}
