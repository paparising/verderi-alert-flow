import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['dist/**/__tests__/**/*.spec.js'],
    exclude: ['**/node_modules/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*'],
    setupFiles: ['./dist/test/setup-vitest.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      include: ['dist/**/*.js'],
      exclude: ['dist/**/__tests__/**', 'dist/test/**'],
    },
  },
});
