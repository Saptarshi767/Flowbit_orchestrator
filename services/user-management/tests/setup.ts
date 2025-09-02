import { beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'

// Test database and Redis instances
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/orchestrator_test'
    }
  }
})

export const testRedis = new Redis({
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
  db: 1 // Use different database for tests
})

// Global test setup
beforeAll(async () => {
  // Connect to test database
  await testPrisma.$connect()
  
  // Connect to test Redis
  await testRedis.ping()
  
  console.log('Test environment setup complete')
})

// Clean up after each test
beforeEach(async () => {
  // Clean up database
  await testPrisma.workflowRating.deleteMany()
  await testPrisma.marketplaceItem.deleteMany()
  await testPrisma.workflowCollaborator.deleteMany()
  await testPrisma.execution.deleteMany()
  await testPrisma.workflowVersion.deleteMany()
  await testPrisma.workflow.deleteMany()
  await testPrisma.notification.deleteMany()
  await testPrisma.auditLog.deleteMany()
  await testPrisma.systemMetric.deleteMany()
  await testPrisma.session.deleteMany()
  await testPrisma.account.deleteMany()
  await testPrisma.user.deleteMany()
  await testPrisma.organization.deleteMany()
  
  // Clean up Redis
  await testRedis.flushdb()
})

// Global test teardown
afterAll(async () => {
  await testPrisma.$disconnect()
  await testRedis.quit()
  console.log('Test environment cleanup complete')
})