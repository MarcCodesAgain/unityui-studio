import react from '@vitejs/plugin-react';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Serves /api/generate during `npm run dev` with the same handler Vercel runs,
 * loaded through Vite so edits to the server code apply without a restart.
 */
function apiDevServer(): Plugin {
  return {
    name: 'studio-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/generate', async (req: IncomingMessage, res: ServerResponse) => {
        const { handleGenerate } = (await server.ssrLoadModule('/server/http.ts')) as typeof import('./server/http.js');
        const body = req.method === 'POST' ? (Readable.toWeb(req) as ReadableStream) : undefined;
        const request = new Request(`http://localhost${req.url ?? ''}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body,
          // Required by Node when the body is a stream.
          duplex: 'half',
        } as RequestInit);

        const response = await handleGenerate(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        if (!response.body) return res.end();
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
        res.end();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make ANTHROPIC_API_KEY and the STUDIO_* limits from .env.local visible to the dev API.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), apiDevServer()] };
});
