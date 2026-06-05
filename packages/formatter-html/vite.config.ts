import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The app is a self-contained React SPA bundled into a single HTML file (JS + CSS
// inlined, no external assets). `format(result)` reads the built dist/app/index.html
// at runtime and injects the result JSON into the `#__SCORECARD_DATA__` island.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: 'dist/app',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000_000,
  },
});
