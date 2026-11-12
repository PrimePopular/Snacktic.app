import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain Vite + React. No extra plugins: keep the toolchain small and free.
export default defineConfig({
  plugins: [react()],
});
