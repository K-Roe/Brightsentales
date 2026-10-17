import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// This Vite config is used only with the isolated 5A-U test server. It serves
// the approved 5A-Q candidate bytes at the URLs the unchanged Playground asks
// for. The normal Vite config and every file in public/art stay untouched.
const frames = new Set([
  'max-0.png', 'max-side-0.png',
  'max-side-v3-1.png', 'max-side-v3-2.png',
  'max-side-v3-3.png', 'max-side-v3-4.png',
  'max-wave-1.png', 'max-wave-2.png', 'max-wave-3.png',
]);
const art = resolve(process.cwd(), 'proofs/milestone5a-q-recovery/frames');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'isolated-max-outfit-candidate',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const name = request.url?.split('?')[0].replace(/^\/art\//, '');
          if (!request.url?.startsWith('/art/') || !name || !frames.has(name)) return next();
          readFile(resolve(art, name)).then(bytes => {
            response.writeHead(200, {
              'Content-Type': 'image/png',
              'Content-Length': String(bytes.length),
              'Cache-Control': 'no-store',
              'X-BrightSen-Outfit-Proof': '5A-Q',
            });
            response.end(bytes);
          }).catch(next);
        });
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});
