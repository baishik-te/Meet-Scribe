import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest configuration for the frontend test suite.
// Uses the jsdom environment so React Testing Library can render components,
// enables global test APIs (describe/it/expect) and loads the shared setup file
// (created by task 1.3) which wires up jest-dom matchers and media/LiveKit/Socket.IO/api mocks.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
