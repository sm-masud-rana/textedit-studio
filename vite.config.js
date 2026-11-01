import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' makes every asset path relative, so it works under any GitHub Pages repo name.
export default defineConfig({ base: './', plugins: [react()] });
