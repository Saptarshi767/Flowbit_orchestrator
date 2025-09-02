import { PrismaClient } from '@prisma/client'
import { beforeEach, afterAll } from 'vitest'

// Create test database client
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/flowbit_test'
    }
  }
})

beforeEach(async () => {
  // Clean up database before each test
  await testPrisma.workflowRating.deleteMany()
  await testPrisma.marketplaceItem.deleteMany()
  await testPrisma.workflowCollaborator.deleteMany()
  await testPrisma.execution.deleteMany()
  await testPrisma.workflowVersion.deleteMany()
  await testPrisma.workflow.deleteMany()
  await testPrisma.user.deleteMany()
  await testPrisma.organization.deleteMany()
})

afterAll(async () => {
  await testPrisma.$disconnect()
})