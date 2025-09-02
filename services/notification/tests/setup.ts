import { beforeAll, afterAll } from 'vitest'

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'error'
})

afterAll(async () => {
  // Cleanup test environment
})