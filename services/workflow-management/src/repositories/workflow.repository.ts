import { PrismaClient } from '@prisma/client'
import {
  Workflow,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowSearchOptions,
  WorkflowSearchResult,
  WorkflowStats,
  EngineType,
  WorkflowVisibility,
  ExecutionStatus
} from '../types/workflow.types'
import { IWorkflowRepository } from './interfaces/workflow.repository.interface'

export class WorkflowRepository implements IWorkflowRepository {
  constructor(private prisma: PrismaClient) {}

  async create(
    request: CreateWorkflowRequest,
    userId: string,
    organizationId: string
  ): Promise<Workflow> {
    const workflow = await this.prisma.workflow.create({
      data: {
        name: request.name,
        description: request.description,
        engineType: request.engineType,
        definition: request.definition,
        visibility: request.visibility || WorkflowVisibility.PRIVATE,
        tags: request.tags || [],
        createdBy: userId,
        organizationId,
        version: 1
      }
    })

    // Create initial version
    await this.prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        version: 1,
        definition: request.definition,
        changeLog: 'Initial version',
        createdBy: userId
      }
    })

    return this.mapToWorkflow(workflow)
  }

  async findById(id: string): Promise<Workflow | null> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id }
    })

    return workflow ? this.mapToWorkflow(workflow) : null
  }

  async findByIdWithVersions(id: string): Promise<Workflow & { versions: any[] } | null> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' }
        }
      }
    })

    if (!workflow) return null

    return {
      ...this.mapToWorkflow(workflow),
      versions: workflow.versions
    }
  }

  async update(
    id: string,
    request: UpdateWorkflowRequest,
    userId: string
  ): Promise<Workflow> {
    // Check if definition changed to create new version
    const currentWorkflow = await this.prisma.workflow.findUnique({
      where: { id }
    })

    if (!currentWorkflow) {
      throw new Error('Workflow not found')
    }

    const definitionChanged = request.definition && 
      JSON.stringify(request.definition) !== JSON.stringify(currentWorkflow.definition)

    let newVersion = currentWorkflow.version
    if (definitionChanged) {
      newVersion = currentWorkflow.version + 1
      
      // Create new version
      await this.prisma.workflowVersion.create({
        data: {
          workflowId: id,
          version: newVersion,
          definition: request.definition!,
          changeLog: `Updated by ${userId}`,
          createdBy: userId
        }
      })
    }

    const updatedWorkflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...(request.name && { name: request.name }),
        ...(request.description !== undefined && { description: request.description }),
        ...(request.definition && { definition: request.definition, version: newVersion }),
        ...(request.visibility && { visibility: request.visibility }),
        ...(request.tags && { tags: request.tags }),
        updatedAt: new Date()
      }
    })

    return this.mapToWorkflow(updatedWorkflow)
  }

  async delete(id: string, userId: string): Promise<void> {
    // Check ownership or admin permissions
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      select: { createdBy: true }
    })

    if (!workflow) {
      throw new Error('Workflow not found')
    }

    if (workflow.createdBy !== userId) {
      throw new Error('Insufficient permissions to delete workflow')
    }

    await this.prisma.workflow.delete({
      where: { id }
    })
  }

  async search(options: WorkflowSearchOptions): Promise<WorkflowSearchResult> {
    const {
      query,
      engineType,
      visibility,
      tags,
      createdBy,
      organizationId,
      limit = 20,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = options

    const where: any = {}

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ]
    }

    if (engineType) {
      where.engineType = engineType
    }

    if (visibility) {
      where.visibility = visibility
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      }
    }

    if (createdBy) {
      where.createdBy = createdBy
    }

    if (organizationId) {
      where.organizationId = organizationId
    }

    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset
      }),
      this.prisma.workflow.count({ where })
    ])

    return {
      workflows: workflows.map(w => this.mapToWorkflow(w)),
      total,
      hasMore: offset + limit < total
    }
  }

  async findByOrganization(
    organizationId: string,
    limit = 20,
    offset = 0
  ): Promise<Workflow[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset
    })

    return workflows.map(w => this.mapToWorkflow(w))
  }

  async findByUser(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<Workflow[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { collaborators: { some: { userId } } }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset
    })

    return workflows.map(w => this.mapToWorkflow(w))
  }

  async findByTags(
    tags: string[],
    organizationId?: string
  ): Promise<Workflow[]> {
    const where: any = {
      tags: { hasSome: tags }
    }

    if (organizationId) {
      where.organizationId = organizationId
    }

    const workflows = await this.prisma.workflow.findMany({
      where,
      orderBy: { updatedAt: 'desc' }
    })

    return workflows.map(w => this.mapToWorkflow(w))
  }

  async getStats(organizationId?: string): Promise<WorkflowStats> {
    const where = organizationId ? { organizationId } : {}

    const [
      totalWorkflows,
      workflowsByEngine,
      workflowsByVisibility,
      totalExecutions,
      executionsByStatus,
      avgExecutionTime
    ] = await Promise.all([
      this.prisma.workflow.count({ where }),
      this.prisma.workflow.groupBy({
        by: ['engineType'],
        where,
        _count: { engineType: true }
      }),
      this.prisma.workflow.groupBy({
        by: ['visibility'],
        where,
        _count: { visibility: true }
      }),
      this.prisma.execution.count({
        where: organizationId ? { organizationId } : {}
      }),
      this.prisma.execution.groupBy({
        by: ['status'],
        where: organizationId ? { organizationId } : {},
        _count: { status: true }
      }),
      this.prisma.execution.aggregate({
        where: {
          ...(organizationId && { organizationId }),
          endTime: { not: null },
          status: ExecutionStatus.COMPLETED
        },
        _avg: {
          // This would need a computed field for duration
          // For now, we'll calculate it differently
        }
      })
    ])

    // Convert grouped results to record format
    const workflowsByEngineRecord = Object.values(EngineType).reduce((acc, engine) => {
      acc[engine] = workflowsByEngine.find(w => w.engineType === engine)?._count.engineType || 0
      return acc
    }, {} as Record<EngineType, number>)

    const workflowsByVisibilityRecord = Object.values(WorkflowVisibility).reduce((acc, visibility) => {
      acc[visibility] = workflowsByVisibility.find(w => w.visibility === visibility)?._count.visibility || 0
      return acc
    }, {} as Record<WorkflowVisibility, number>)

    const executionsByStatusRecord = Object.values(ExecutionStatus).reduce((acc, status) => {
      acc[status] = executionsByStatus.find(e => e.status === status)?._count.status || 0
      return acc
    }, {} as Record<ExecutionStatus, number>)

    // Calculate average execution time
    const completedExecutions = await this.prisma.execution.findMany({
      where: {
        ...(organizationId && { organizationId }),
        status: ExecutionStatus.COMPLETED,
        endTime: { not: null }
      },
      select: {
        startTime: true,
        endTime: true
      }
    })

    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, exec) => {
          const duration = exec.endTime!.getTime() - exec.startTime.getTime()
          return sum + duration
        }, 0) / completedExecutions.length
      : 0

    return {
      totalWorkflows,
      workflowsByEngine: workflowsByEngineRecord,
      workflowsByVisibility: workflowsByVisibilityRecord,
      totalExecutions,
      executionsByStatus: executionsByStatusRecord,
      averageExecutionTime
    }
  }

  async getWorkflowCount(organizationId?: string): Promise<number> {
    const where = organizationId ? { organizationId } : {}
    return this.prisma.workflow.count({ where })
  }

  async hasAccess(
    workflowId: string,
    userId: string,
    permission: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        collaborators: {
          where: { userId }
        }
      }
    })

    if (!workflow) return false

    // Owner has all permissions
    if (workflow.createdBy === userId) return true

    // Check collaborator permissions
    const collaborator = workflow.collaborators[0]
    if (!collaborator) return false

    switch (permission) {
      case 'read':
        return ['owner', 'editor', 'viewer'].includes(collaborator.role)
      case 'write':
        return ['owner', 'editor'].includes(collaborator.role)
      case 'delete':
        return collaborator.role === 'owner'
      default:
        return false
    }
  }

  async isOwner(workflowId: string, userId: string): Promise<boolean> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { createdBy: true }
    })

    return workflow?.createdBy === userId || false
  }

  private mapToWorkflow(prismaWorkflow: any): Workflow {
    return {
      id: prismaWorkflow.id,
      name: prismaWorkflow.name,
      description: prismaWorkflow.description,
      engineType: prismaWorkflow.engineType,
      definition: prismaWorkflow.definition,
      version: prismaWorkflow.version,
      visibility: prismaWorkflow.visibility,
      tags: prismaWorkflow.tags,
      createdBy: prismaWorkflow.createdBy,
      organizationId: prismaWorkflow.organizationId,
      createdAt: prismaWorkflow.createdAt,
      updatedAt: prismaWorkflow.updatedAt
    }
  }
}