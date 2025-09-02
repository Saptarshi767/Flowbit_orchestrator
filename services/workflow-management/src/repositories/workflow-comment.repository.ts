import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import {
  WorkflowComment,
  CreateCommentRequest,
  UpdateCommentRequest
} from '../types/workflow.types'

export interface IWorkflowCommentRepository {
  create(workflowId: string, userId: string, request: CreateCommentRequest): Promise<WorkflowComment>
  update(commentId: string, userId: string, request: UpdateCommentRequest): Promise<WorkflowComment>
  delete(commentId: string, userId: string): Promise<void>
  findById(commentId: string): Promise<WorkflowComment | null>
  findByWorkflowId(workflowId: string): Promise<WorkflowComment[]>
  findReplies(parentId: string): Promise<WorkflowComment[]>
}

export class WorkflowCommentRepository implements IWorkflowCommentRepository {
  constructor(private prisma: PrismaClient) {}

  async create(workflowId: string, userId: string, request: CreateCommentRequest): Promise<WorkflowComment> {
    // Verify workflow exists
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId }
    })

    if (!workflow) {
      throw new Error('Workflow not found')
    }

    // If parentId is provided, verify parent comment exists
    if (request.parentId) {
      const parentComment = await this.prisma.workflowComment.findUnique({
        where: { id: request.parentId }
      })

      if (!parentComment || parentComment.workflowId !== workflowId) {
        throw new Error('Parent comment not found or belongs to different workflow')
      }
    }

    const comment = await this.prisma.workflowComment.create({
      data: {
        id: uuidv4(),
        workflowId,
        userId,
        content: request.content,
        parentId: request.parentId || null
      },
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

    return this.mapToWorkflowComment(comment)
  }

  async update(commentId: string, userId: string, request: UpdateCommentRequest): Promise<WorkflowComment> {
    // Verify comment exists and user owns it
    const existingComment = await this.prisma.workflowComment.findUnique({
      where: { id: commentId }
    })

    if (!existingComment) {
      throw new Error('Comment not found')
    }

    if (existingComment.userId !== userId) {
      throw new Error('Not authorized to update this comment')
    }

    const comment = await this.prisma.workflowComment.update({
      where: { id: commentId },
      data: {
        content: request.content,
        updatedAt: new Date()
      },
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

    return this.mapToWorkflowComment(comment)
  }

  async delete(commentId: string, userId: string): Promise<void> {
    // Verify comment exists and user owns it
    const existingComment = await this.prisma.workflowComment.findUnique({
      where: { id: commentId }
    })

    if (!existingComment) {
      throw new Error('Comment not found')
    }

    if (existingComment.userId !== userId) {
      throw new Error('Not authorized to delete this comment')
    }

    // Delete all replies first
    await this.prisma.workflowComment.deleteMany({
      where: { parentId: commentId }
    })

    // Delete the comment
    await this.prisma.workflowComment.delete({
      where: { id: commentId }
    })
  }

  async findById(commentId: string): Promise<WorkflowComment | null> {
    const comment = await this.prisma.workflowComment.findUnique({
      where: { id: commentId },
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

    return comment ? this.mapToWorkflowComment(comment) : null
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowComment[]> {
    const comments = await this.prisma.workflowComment.findMany({
      where: { 
        workflowId,
        parentId: null // Only get top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return comments.map(comment => ({
      ...this.mapToWorkflowComment(comment),
      replies: comment.replies?.map(reply => this.mapToWorkflowComment(reply))
    }))
  }

  async findReplies(parentId: string): Promise<WorkflowComment[]> {
    const replies = await this.prisma.workflowComment.findMany({
      where: { parentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return replies.map(reply => this.mapToWorkflowComment(reply))
  }

  private mapToWorkflowComment(prismaComment: any): WorkflowComment {
    return {
      id: prismaComment.id,
      workflowId: prismaComment.workflowId,
      userId: prismaComment.userId,
      content: prismaComment.content,
      parentId: prismaComment.parentId,
      createdAt: prismaComment.createdAt,
      updatedAt: prismaComment.updatedAt,
      user: prismaComment.user ? {
        id: prismaComment.user.id,
        name: prismaComment.user.name,
        email: prismaComment.user.email
      } : undefined
    }
  }
}