import { defineConfig } from 'vite';
import { readdir } from 'node:fs/promises';

export default defineConfig({
  base: './',
  build: { rollupOptions: { input: { index: 'index.html', viewer: 'viewer.html' } } },
  plugins: [{
    name: 'local-game-manifest',
    configureServer(server) {
      server.middlewares.use('/__local_assets', async (_req, res) => {
        try {
          const entries = await readdir(new URL('./game/', import.meta.url), { withFileTypes: true });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(entries.filter(e => e.isFile() && !e.name.startsWith('.')).map(e => e.name).sort()));
        } catch { res.statusCode = 404; res.end('Local game folder unavailable'); }
      });
    },
  }],
});
