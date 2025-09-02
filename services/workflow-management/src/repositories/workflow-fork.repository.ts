import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import {
  WorkflowFork,
  ForkWorkflowRequest,
  MergeRequest,
  CreateMergeRequest,
  MergeRequestStatus,
  Workflow,
  EngineType,
  WorkflowVisibility
} from '../types/workflow.types'

export interface IWorkflowForkRepository {
  forkWorkflow(originalWorkflowId: string, userId: string, request: ForkWorkflowRequest): Promise<{ fork: WorkflowFork; workflow: Workflow }>
  createMergeRequest(sourceWorkflowId: string, userId: string, request: CreateMergeRequest): Promise<MergeRequest>
  updateMergeRequestStatus(mergeRequestId: string, status: MergeRequestStatus, userId: string): Promise<MergeRequest>
  findForksByOriginalWorkflow(originalWorkflowId: string): Promise<WorkflowFork[]>
  findForksByUser(userId: string): Promise<WorkflowFork[]>
  findMergeRequestsByWorkflow(workflowId: string): Promise<MergeRequest[]>
  findMergeRequestById(mergeRequestId: string): Promise<MergeRequest | null>
  mergeBranch(mergeRequestId: string, userId: string): Promise<void>
}

export class WorkflowForkRepository implements IWorkflowForkRepository {
  constructor(private prisma: PrismaClient) {}

  async forkWorkflow(
    originalWorkflowId: string, 
    userId: string, 
    request: ForkWorkflowRequest
  ): Promise<{ fork: WorkflowFork; workflow: Workflow }> {
    // Get the original workflow
    const originalWorkflow = await this.prisma.workflow.findUnique({
      where: { id: originalWorkflowId }
    })

    if (!originalWorkflow) {
      throw new Error('Original workflow not found')
    }

    // Check if user has read access to the original workflow
    const canRead = await this.canReadWorkflow(originalWorkflowId, userId)
    if (!canRead) {
      throw new Error('Not authorized to fork this workflow')
    }

    // Create the forked workflow
    const forkedWorkflowId = uuidv4()
    const forkId = uuidv4()

    const forkedWorkflow = await this.prisma.workflow.create({
      data: {
        id: forkedWorkflowId,
        name: request.name,
        description: request.description || `Fork of ${originalWorkflow.name}`,
        engineType: originalWorkflow.engineType,
        definition: originalWorkflow.definition,
        version: 1,
        visibility: WorkflowVisibility.PRIVATE, // Forks are private by default
        tags: originalWorkflow.tags,
        createdBy: userId,
        organizationId: originalWorkflow.organizationId
      }
    })

    // Create the fork record
    const fork = await this.prisma.workflowFork.create({
      data: {
        id: forkId,
        originalWorkflowId,
        forkedWorkflowId,
        userId
      }
    })

    return {
      fork: this.mapToWorkflowFork(fork),
      workflow: this.mapToWorkflow(forkedWorkflow)
    }
  }

  async createMergeRequest(
    sourceWorkflowId: string, 
    userId: string, 
    request: CreateMergeRequest
  ): Promise<MergeRequest> {
    // Verify source workflow exists and user owns it
    const sourceWorkflow = await this.prisma.workflow.findUnique({
      where: { id: sourceWorkflowId }
    })

    if (!sourceWorkflow) {
      throw new Error('Source workflow not found')
    }

    if (sourceWorkflow.createdBy !== userId) {
      throw new Error('Not authorized to create merge request from this workflow')
    }

    // Verify target workflow exists
    const targetWorkflow = await this.prisma.workflow.findUnique({
      where: { id: request.targetWorkflowId }
    })

    if (!targetWorkflow) {
      throw new Error('Target workflow not found')
    }

    // Check if there's already an open merge request
    const existingMergeRequest = await this.prisma.mergeRequest.findFirst({
      where: {
        sourceWorkflowId,
        targetWorkflowId: request.targetWorkflowId,
        status: MergeRequestStatus.OPEN
      }
    })

    if (existingMergeRequest) {
      throw new Error('There is already an open merge request between these workflows')
    }

    const mergeRequest = await this.prisma.mergeRequest.create({
      data: {
        id: uuidv4(),
        sourceWorkflowId,
        targetWorkflowId: request.targetWorkflowId,
        title: request.title,
        description: request.description,
        status: MergeRequestStatus.OPEN,
        createdBy: userId
      }
    })

    return this.mapToMergeRequest(mergeRequest)
  }

  async updateMergeRequestStatus(
    mergeRequestId: string, 
    status: MergeRequestStatus, 
    userId: string
  ): Promise<MergeRequest> {
    const mergeRequest = await this.prisma.mergeRequest.findUnique({
      where: { id: mergeRequestId }
    })

    if (!mergeRequest) {
      throw new Error('Merge request not found')
    }

    // Check authorization - only creator or target workflow owner can update status
    const targetWorkflow = await this.prisma.workflow.findUnique({
      where: { id: mergeRequest.targetWorkflowId }
    })

    if (!targetWorkflow) {
      throw new Error('Target workflow not found')
    }

    const canUpdate = mergeRequest.createdBy === userId || targetWorkflow.createdBy === userId
    if (!canUpdate) {
      throw new Error('Not authorized to update this merge request')
    }

    const updatedMergeRequest = await this.prisma.mergeRequest.update({
      where: { id: mergeRequestId },
      data: {
        status,
        updatedAt: new Date()
      }
    })

    return this.mapToMergeRequest(updatedMergeRequest)
  }

  async findForksByOriginalWorkflow(originalWorkflowId: string): Promise<WorkflowFork[]> {
    const forks = await this.prisma.workflowFork.findMany({
      where: { originalWorkflowId },
      include: {
        forkedWorkflow: {
          select: {
            id: true,
            name: true,
            description: true,
            createdBy: true,
            createdAt: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return forks.map(fork => ({
      ...this.mapToWorkflowFork(fork),
      forkedWorkflow: fork.forkedWorkflow,
      user: fork.user
    }))
  }

  async findForksByUser(userId: string): Promise<WorkflowFork[]> {
    const forks = await this.prisma.workflowFork.findMany({
      where: { userId },
      include: {
        originalWorkflow: {
          select: {
            id: true,
            name: true,
            description: true,
            createdBy: true
          }
        },
        forkedWorkflow: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return forks.map(fork => ({
      ...this.mapToWorkflowFork(fork),
      originalWorkflow: fork.originalWorkflow,
      forkedWorkflow: fork.forkedWorkflow
    }))
  }

  async findMergeRequestsByWorkflow(workflowId: string): Promise<MergeRequest[]> {
    const mergeRequests = await this.prisma.mergeRequest.findMany({
      where: {
        OR: [
          { sourceWorkflowId: workflowId },
          { targetWorkflowId: workflowId }
        ]
      },
      include: {
        sourceWorkflow: {
          select: {
            id: true,
            name: true,
            createdBy: true
          }
        },
        targetWorkflow: {
          select: {
            id: true,
            name: true,
            createdBy: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return mergeRequests.map(mr => ({
      ...this.mapToMergeRequest(mr),
      sourceWorkflow: mr.sourceWorkflow,
      targetWorkflow: mr.targetWorkflow,
      creator: mr.creator
    }))
  }

  async findMergeRequestById(mergeRequestId: string): Promise<MergeRequest | null> {
    const mergeRequest = await this.prisma.mergeRequest.findUnique({
      where: { id: mergeRequestId },
      include: {
        sourceWorkflow: true,
        targetWorkflow: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return mergeRequest ? {
      ...this.mapToMergeRequest(mergeRequest),
      sourceWorkflow: this.mapToWorkflow(mergeRequest.sourceWorkflow),
      targetWorkflow: this.mapToWorkflow(mergeRequest.targetWorkflow),
      creator: mergeRequest.creator
    } : null
  }

  async mergeBranch(mergeRequestId: string, userId: string): Promise<void> {
    const mergeRequest = await this.prisma.mergeRequest.findUnique({
      where: { id: mergeRequestId },
      include: {
        sourceWorkflow: true,
        targetWorkflow: true
      }
    })

    if (!mergeRequest) {
      throw new Error('Merge request not found')
    }

    if (mergeRequest.status !== MergeRequestStatus.OPEN) {
      throw new Error('Merge request is not open')
    }

    // Check authorization - only target workflow owner can merge
    if (mergeRequest.targetWorkflow.createdBy !== userId) {
      throw new Error('Not authorized to merge this request')
    }

    // Perform the merge by updating the target workflow
    await this.prisma.$transaction(async (tx) => {
      // Update target workflow with source workflow definition
      await tx.workflow.update({
        where: { id: mergeRequest.targetWorkflowId },
        data: {
          definition: mergeRequest.sourceWorkflow.definition,
          version: { increment: 1 },
          updatedAt: new Date()
        }
      })

      // Create a new version record
      await tx.workflowVersion.create({
        data: {
          id: uuidv4(),
          workflowId: mergeRequest.targetWorkflowId,
          version: mergeRequest.targetWorkflow.version + 1,
          definition: mergeRequest.sourceWorkflow.definition,
          changeLog: `Merged from ${mergeRequest.sourceWorkflow.name}`,
          createdBy: userId
        }
      })

      // Update merge request status
      await tx.mergeRequest.update({
        where: { id: mergeRequestId },
        data: {
          status: MergeRequestStatus.MERGED,
          updatedAt: new Date()
        }
      })
    })
  }

  private async canReadWorkflow(workflowId: string, userId: string): Promise<boolean> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { createdBy: true, visibility: true }
    })

    if (!workflow) return false

    // Owner can always read
    if (workflow.createdBy === userId) return true

    // Public workflows can be read by anyone
    if (workflow.visibility === WorkflowVisibility.PUBLIC) return true

    // Check collaborator permissions
    const collaborator = await this.prisma.workflowCollaborator.findUnique({
      where: {
        workflowId_userId: {
          workflowId,
          userId
        }
      }
    })

    return collaborator !== null
  }

  private mapToWorkflowFork(prismaFork: any): WorkflowFork {
    return {
      id: prismaFork.id,
      originalWorkflowId: prismaFork.originalWorkflowId,
      forkedWorkflowId: prismaFork.forkedWorkflowId,
      userId: prismaFork.userId,
      createdAt: prismaFork.createdAt
    }
  }

  private mapToMergeRequest(prismaMergeRequest: any): MergeRequest {
    return {
      id: prismaMergeRequest.id,
      sourceWorkflowId: prismaMergeRequest.sourceWorkflowId,
      targetWorkflowId: prismaMergeRequest.targetWorkflowId,
      title: prismaMergeRequest.title,
      description: prismaMergeRequest.description,
      status: prismaMergeRequest.status as MergeRequestStatus,
      createdBy: prismaMergeRequest.createdBy,
      createdAt: prismaMergeRequest.createdAt,
      updatedAt: prismaMergeRequest.updatedAt
    }
  }

  private mapToWorkflow(prismaWorkflow: any): Workflow {
    return {
      id: prismaWorkflow.id,
      name: prismaWorkflow.name,
      description: prismaWorkflow.description,
      engineType: prismaWorkflow.engineType as EngineType,
      definition: prismaWorkflow.definition,
      version: prismaWorkflow.version,
      visibility: prismaWorkflow.visibility as WorkflowVisibility,
      tags: prismaWorkflow.tags,
      createdBy: prismaWorkflow.createdBy,
      organizationId: prismaWorkflow.organizationId,
      createdAt: prismaWorkflow.createdAt,
      updatedAt: prismaWorkflow.updatedAt
    }
  }
}