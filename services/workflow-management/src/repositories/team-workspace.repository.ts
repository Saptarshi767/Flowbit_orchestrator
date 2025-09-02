import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import {
  TeamWorkspace,
  WorkspaceMember,
  WorkspaceRole,
  CreateWorkspaceRequest,
  AddWorkspaceMemberRequest
} from '../types/workflow.types'

export interface ITeamWorkspaceRepository {
  create(userId: string, organizationId: string, request: CreateWorkspaceRequest): Promise<TeamWorkspace>
  update(workspaceId: string, userId: string, request: Partial<CreateWorkspaceRequest>): Promise<TeamWorkspace>
  delete(workspaceId: string, userId: string): Promise<void>
  findById(workspaceId: string): Promise<TeamWorkspace | null>
  findByOrganization(organizationId: string): Promise<TeamWorkspace[]>
  findByUser(userId: string): Promise<TeamWorkspace[]>
  addMember(workspaceId: string, userId: string, request: AddWorkspaceMemberRequest): Promise<WorkspaceMember>
  removeMember(workspaceId: string, memberUserId: string, userId: string): Promise<void>
  updateMemberRole(workspaceId: string, memberUserId: string, role: WorkspaceRole, userId: string): Promise<WorkspaceMember>
  getMembers(workspaceId: string): Promise<WorkspaceMember[]>
  canAccess(workspaceId: string, userId: string): Promise<boolean>
  canManage(workspaceId: string, userId: string): Promise<boolean>
}

export class TeamWorkspaceRepository implements ITeamWorkspaceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(userId: string, organizationId: string, request: CreateWorkspaceRequest): Promise<TeamWorkspace> {
    const workspaceId = uuidv4()

    const workspace = await this.prisma.$transaction(async (tx) => {
      // Create the workspace
      const newWorkspace = await tx.teamWorkspace.create({
        data: {
          id: workspaceId,
          name: request.name,
          description: request.description,
          organizationId,
          createdBy: userId
        }
      })

      // Add creator as admin member
      await tx.workspaceMember.create({
        data: {
          id: uuidv4(),
          workspaceId,
          userId,
          role: WorkspaceRole.ADMIN
        }
      })

      return newWorkspace
    })

    return this.findById(workspaceId) as Promise<TeamWorkspace>
  }

  async update(workspaceId: string, userId: string, request: Partial<CreateWorkspaceRequest>): Promise<TeamWorkspace> {
    // Check if user can manage the workspace
    const canManage = await this.canManage(workspaceId, userId)
    if (!canManage) {
      throw new Error('Not authorized to update this workspace')
    }

    await this.prisma.teamWorkspace.update({
      where: { id: workspaceId },
      data: {
        name: request.name,
        description: request.description,
        updatedAt: new Date()
      }
    })

    return this.findById(workspaceId) as Promise<TeamWorkspace>
  }

  async delete(workspaceId: string, userId: string): Promise<void> {
    // Check if user can manage the workspace
    const canManage = await this.canManage(workspaceId, userId)
    if (!canManage) {
      throw new Error('Not authorized to delete this workspace')
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete all members first
      await tx.workspaceMember.deleteMany({
        where: { workspaceId }
      })

      // Delete the workspace
      await tx.teamWorkspace.delete({
        where: { id: workspaceId }
      })
    })
  }

  async findById(workspaceId: string): Promise<TeamWorkspace | null> {
    const workspace = await this.prisma.teamWorkspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
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
      }
    })

    return workspace ? this.mapToTeamWorkspace(workspace) : null
  }

  async findByOrganization(organizationId: string): Promise<TeamWorkspace[]> {
    const workspaces = await this.prisma.teamWorkspace.findMany({
      where: { organizationId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return workspaces.map(workspace => this.mapToTeamWorkspace(workspace))
  }

  async findByUser(userId: string): Promise<TeamWorkspace[]> {
    const workspaces = await this.prisma.teamWorkspace.findMany({
      where: {
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return workspaces.map(workspace => this.mapToTeamWorkspace(workspace))
  }

  async addMember(workspaceId: string, userId: string, request: AddWorkspaceMemberRequest): Promise<WorkspaceMember> {
    // Check if user can manage the workspace
    const canManage = await this.canManage(workspaceId, userId)
    if (!canManage) {
      throw new Error('Not authorized to add members to this workspace')
    }

    // Check if user is already a member
    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: request.userId
        }
      }
    })

    if (existingMember) {
      throw new Error('User is already a member of this workspace')
    }

    // Verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: request.userId }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const member = await this.prisma.workspaceMember.create({
      data: {
        id: uuidv4(),
        workspaceId,
        userId: request.userId,
        role: request.role
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

    return this.mapToWorkspaceMember(member)
  }

  async removeMember(workspaceId: string, memberUserId: string, userId: string): Promise<void> {
    // Check if user can manage the workspace
    const canManage = await this.canManage(workspaceId, userId)
    if (!canManage) {
      throw new Error('Not authorized to remove members from this workspace')
    }

    // Don't allow removing the workspace creator if they're the only admin
    const workspace = await this.prisma.teamWorkspace.findUnique({
      where: { id: workspaceId },
      select: { createdBy: true }
    })

    if (workspace?.createdBy === memberUserId) {
      const adminCount = await this.prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: WorkspaceRole.ADMIN
        }
      })

      if (adminCount <= 1) {
        throw new Error('Cannot remove the last admin from the workspace')
      }
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId
        }
      }
    })

    if (!member) {
      throw new Error('Member not found')
    }

    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId
        }
      }
    })
  }

  async updateMemberRole(workspaceId: string, memberUserId: string, role: WorkspaceRole, userId: string): Promise<WorkspaceMember> {
    // Check if user can manage the workspace
    const canManage = await this.canManage(workspaceId, userId)
    if (!canManage) {
      throw new Error('Not authorized to update member roles in this workspace')
    }

    const member = await this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId
        }
      },
      data: { role },
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

    return this.mapToWorkspaceMember(member)
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
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

    return members.map(member => this.mapToWorkspaceMember(member))
  }

  async canAccess(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      }
    })

    return member !== null
  }

  async canManage(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      },
      select: { role: true }
    })

    return member?.role === WorkspaceRole.ADMIN
  }

  private mapToTeamWorkspace(prismaWorkspace: any): TeamWorkspace {
    return {
      id: prismaWorkspace.id,
      name: prismaWorkspace.name,
      description: prismaWorkspace.description,
      organizationId: prismaWorkspace.organizationId,
      createdBy: prismaWorkspace.createdBy,
      members: prismaWorkspace.members?.map((member: any) => this.mapToWorkspaceMember(member)) || [],
      createdAt: prismaWorkspace.createdAt,
      updatedAt: prismaWorkspace.updatedAt
    }
  }

  private mapToWorkspaceMember(prismaMember: any): WorkspaceMember {
    return {
      id: prismaMember.id,
      workspaceId: prismaMember.workspaceId,
      userId: prismaMember.userId,
      role: prismaMember.role as WorkspaceRole,
      createdAt: prismaMember.createdAt,
      user: prismaMember.user ? {
        id: prismaMember.user.id,
        name: prismaMember.user.name,
        email: prismaMember.user.email
      } : undefined
    }
  }
}