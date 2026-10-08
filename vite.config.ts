import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set to "/Plan/" for the GitHub Pages build; the Android
// build loads files from the app bundle, so it uses relative paths.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
});
