import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    // The allocator intentionally explores multiple seeded candidates. Give
    // slower CI machines enough room while still failing a genuine hang.
    testTimeout: 15_000,
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
});
