import { beforeAll, afterAll } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  (process.env as any).NODE_ENV = 'test';
  (process.env as any).LOG_LEVEL = 'error';
  (process.env as any).ELASTICSEARCH_URL = 'http://localhost:9200';
  (process.env as any).REDIS_URL = 'redis://localhost:6379';
  process.env.CACHE_ENABLED = 'true';
  process.env.CACHE_TTL = '60';
  process.env.REPORTS_DIR = './test-reports';
  
  // Suppress console output during tests
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  
  // Restore console methods after tests
  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });
});

// Global test teardown
afterAll(async () => {
  // Clean up any global resources
  // This could include closing database connections, cleaning up test files, etc.
});