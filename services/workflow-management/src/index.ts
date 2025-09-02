// Export types
export * from './types/workflow.types'

// Export repositories
export * from './repositories/interfaces/workflow.repository.interface'
export { WorkflowRepository } from './repositories/workflow.repository'
export { WorkflowVersionRepository } from './repositories/workflow-version.repository'
export { WorkflowCollaboratorRepository } from './repositories/workflow-collaborator.repository'
export { ExecutionRepository } from './repositories/execution.repository'
export { RepositoryFactory } from './repositories/repository.factory'

// Export services
export { WorkflowService } from './services/workflow.service'

// Export utilities
export * from './utils/validation.utils'

// Main service factory function
import { PrismaClient } from '@prisma/client'
import { RepositoryFactory } from './repositories/repository.factory'
import { WorkflowService } from './services/workflow.service'

export function createWorkflowService(prisma: PrismaClient): WorkflowService {
  const repositoryFactory = RepositoryFactory.getInstance(prisma)
  
  return new WorkflowService(
    repositoryFactory.getWorkflowRepository(),
    repositoryFactory.getWorkflowVersionRepository(),
    repositoryFactory.getWorkflowCollaboratorRepository()
  )
}