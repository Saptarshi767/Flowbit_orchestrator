import { PrismaClient } from '@prisma/client'
import {
  WorkflowCollaborator,
  ShareWorkflowRequest,
  CollaboratorRole
} from '../types/workflow.types'
import { IWorkflowCollaboratorRepository } from './interfaces/workflow.repository.interface'

export class WorkflowCollaboratorRepository implements IWorkflowCollaboratorRepository {
  constructor(private prisma: PrismaClient) {}

  async addCollaborator(
    workflowId: string,
    request: ShareWorkflowRequest
  ): Promise<WorkflowCollaborator> {
    // Check if user is already a collaborator
    const existing = await this.prisma.workflowCollaborator.findUnique({
      where: {
        workflowId_userId: {
          workflowId,
          userId: request.userId
        }
      }
    })

    if (existing) {
      throw new Error('User is already a collaborator on this workflow')
    }

    // Verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: request.userId }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Verify the workflow exists
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId }
    })

    if (!workflow) {
      throw new Error('Workflow not found')
    }

    const collaborator = await this.prisma.workflowCollaborator.create({
      data: {
        workflowId,
        userId: request.userId,
        role: request.role
      }
    })

    return this.mapToWorkflowCollaborator(collaborator)
  }

  async removeCollaborator(workflowId: string, userId: string): Promise<void> {
    const collaborator = await this.prisma.workflowCollaborator.findUnique({
      where: {
        workflowId_userId: {
          workflowId,
          userId
        }
      }
    })

    if (!collaborator) {
      throw new Error('Collaborator not found')
    }

    await this.prisma.workflowCollaborator.delete({
      where: {
        workflowId_userId: {
          workflowId,
          userId
        }
      }
    })
  }

  async updateCollaboratorRole(
    workflowId: string,
    userId: string,
    role: string
  ): Promise<WorkflowCollaborator> {
    // Validate role
    if (!Object.values(CollaboratorRole).includes(role as CollaboratorRole)) {
      throw new Error(`Invalid role: ${role}`)
    }

    const collaborator = await this.prisma.workflowCollaborator.update({
      where: {
        workflowId_userId: {
          workflowId,
          userId
        }
      },
      data: { role }
    })

    return this.mapToWorkflowCollaborator(collaborator)
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowCollaborator[]> {
    const collaborators = await this.prisma.workflowCollaborator.findMany({
      where: { workflowId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return collaborators.map(c => ({
      ...this.mapToWorkflowCollaborator(c),
      user: c.user
    }))
  }

  async findByUserId(userId: string): Promise<WorkflowCollaborator[]> {
    const collaborators = await this.prisma.workflowCollaborator.findMany({
      where: { userId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            description: true,
            engineType: true,
            visibility: true
          }
        }
      }
    })

    return collaborators.map(c => ({
      ...this.mapToWorkflowCollaborator(c),
      workflow: c.workflow
    }))
  }

  async getCollaboratorRole(
    workflowId: string,
    userId: string
  ): Promise<string | null> {
    const collaborator = await this.prisma.workflowCollaborator.findUnique({
      where: {
        workflowId_userId: {
          workflowId,
          userId
        }
      },
      select: { role: true }
    })

    return collaborator?.role || null
  }

  async canRead(workflowId: string, userId: string): Promise<boolean> {
    // Check if user is the owner
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { createdBy: true, visibility: true }
    })

    if (!workflow) return false

    // Owner can always read
    if (workflow.createdBy === userId) return true

    // Public workflows can be read by anyone
    if (workflow.visibility === 'PUBLIC') return true

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

  async canWrite(workflowId: string, userId: string): Promise<boolean> {
    // Check if user is the owner
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { createdBy: true }
    })

    if (!workflow) return false

    // Owner can always write
    if (workflow.createdBy === userId) return true

    // Check collaborator permissions
    const collaborator = await this.prisma.workflowCollaborator.findUnique({
      where: {
        workflowId_userId: {
          workflowId,
          userId
        }
      },
      select: { role: true }
    })

    return collaborator?.role === CollaboratorRole.OWNER || 
           collaborator?.role === CollaboratorRole.EDITOR
  }

  async canDelete(workflowId: string, userId: string): Promise<boolean> {
    // Check if user is the owner
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { createdBy: true }
    })

    if (!workflow) return false

    // Only owner can delete (or collaborators with owner role)
    if (workflow.createdBy === userId) return true

    const collaborator = await this.prisma.workflowCollaborator.findUnique({
      where: {
        workflowId_userId: {
          workflowId,
          userId
        }
      },
      select: { role: true }
    })

    return collaborator?.role === CollaboratorRole.OWNER
  }

  private mapToWorkflowCollaborator(prismaCollaborator: any): WorkflowCollaborator {
    return {
      id: prismaCollaborator.id,
      workflowId: prismaCollaborator.workflowId,
      userId: prismaCollaborator.userId,
      role: prismaCollaborator.role as CollaboratorRole,
      createdAt: prismaCollaborator.createdAt
    }
  }
}