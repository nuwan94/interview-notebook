import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' keeps asset URLs relative, so the build works from any GitHub Pages path
// (https://user.github.io/<repo>/) without configuration. Routing uses the URL hash for the same reason.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
