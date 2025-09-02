import { vi } from 'vitest'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.SESSION_SECRET = 'test-session-secret'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}