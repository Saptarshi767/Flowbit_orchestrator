import { PrismaClient } from '@prisma/client'
import { WorkflowRepository } from './workflow.repository'
import { WorkflowVersionRepository } from './workflow-version.repository'
import { WorkflowCollaboratorRepository } from './workflow-collaborator.repository'
import { ExecutionRepository } from './execution.repository'
import {
  IWorkflowRepository,
  IWorkflowVersionRepository,
  IWorkflowCollaboratorRepository,
  IExecutionRepository
} from './interfaces/workflow.repository.interface'

export class RepositoryFactory {
  private static instance: RepositoryFactory
  private prisma: PrismaClient
  private workflowRepository?: IWorkflowRepository
  private workflowVersionRepository?: IWorkflowVersionRepository
  private workflowCollaboratorRepository?: IWorkflowCollaboratorRepository
  private executionRepository?: IExecutionRepository

  private constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  public static getInstance(prisma?: PrismaClient): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      if (!prisma) {
        throw new Error('PrismaClient must be provided when creating the first instance')
      }
      RepositoryFactory.instance = new RepositoryFactory(prisma)
    }
    return RepositoryFactory.instance
  }

  public getWorkflowRepository(): IWorkflowRepository {
    if (!this.workflowRepository) {
      this.workflowRepository = new WorkflowRepository(this.prisma)
    }
    return this.workflowRepository
  }

  public getWorkflowVersionRepository(): IWorkflowVersionRepository {
    if (!this.workflowVersionRepository) {
      this.workflowVersionRepository = new WorkflowVersionRepository(this.prisma)
    }
    return this.workflowVersionRepository
  }

  public getWorkflowCollaboratorRepository(): IWorkflowCollaboratorRepository {
    if (!this.workflowCollaboratorRepository) {
      this.workflowCollaboratorRepository = new WorkflowCollaboratorRepository(this.prisma)
    }
    return this.workflowCollaboratorRepository
  }

  public getExecutionRepository(): IExecutionRepository {
    if (!this.executionRepository) {
      this.executionRepository = new ExecutionRepository(this.prisma)
    }
    return this.executionRepository
  }

  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }
}