import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain Vite + React. No extra plugins: keep the toolchain small and free.
export default defineConfig({
  plugins: [react()],
  // The build date, sent with bug reports so we know which version a problem came from.
  define: { __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
});
