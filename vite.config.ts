import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function offlineShellPlugin(): Plugin {
  return {
    name: 'buildchamp-offline-shell',
    generateBundle(_options, bundle) {
      const precacheEntries = Object.entries(bundle)
        .filter(
          ([fileName, output]) =>
            fileName === 'index.html' ||
            output.type === 'chunk' ||
            (output.type === 'asset' && fileName.endsWith('.css')),
        )
        .sort(([first], [second]) => first.localeCompare(second));
      const hash = createHash('sha256');

      for (const [fileName, output] of precacheEntries) {
        hash.update(fileName);
        hash.update('\0');
        hash.update(output.type === 'chunk' ? output.code : output.source);
        hash.update('\0');
      }

      const cacheName = `buildchamp-shell-${hash.digest('hex').slice(0, 12)}`;
      const precacheUrls = [
        '/',
        '/index.html',
        ...precacheEntries.map(([fileName]) => `/${fileName}`),
      ];
      const workerTemplate = readFileSync(resolve('scripts/service-worker-template.js'), 'utf8');
      const serviceWorker = workerTemplate
        .replace("'__BUILDCHAMP_CACHE_NAME__'", JSON.stringify(cacheName))
        .replace("'__PRECACHE_URLS__'", JSON.stringify(precacheUrls));

      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source: serviceWorker });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), offlineShellPlugin()],
  server: {
    host: '127.0.0.1',
  },
});
