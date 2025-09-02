import { PrismaClient, UserRole, User } from '@prisma/client'
import { 
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
  UserListResponse,
  UserFilters,
  UserStats,
  BulkUserOperation,
  BulkOperationResult,
  CreateInvitationRequest,
  AcceptInvitationRequest,
  UserInvitation
} from '../types/user.types'
import { RBACService } from './rbac.service'
import { NotificationService } from './notification.service'
import { hashPassword, validatePassword, generateVerificationToken } from '../utils/password.utils'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'

/**
 * User Management Service
 * Handles user CRUD operations, invitations, and profile management
 */
export class UserService {
  private prisma: PrismaClient
  private redis: Redis
  private rbacService: RBACService
  private notificationService: NotificationService

  constructor(
    prisma: PrismaClient, 
    redis: Redis, 
    rbacService: RBACService,
    notificationService: NotificationService
  ) {
    this.prisma = prisma
    this.redis = redis
    this.rbacService = rbacService
    this.notificationService = notificationService
  }

  /**
   * Create a new user
   */
  async createUser(request: CreateUserRequest, createdBy: string): Promise<UserResponse> {
    try {
      // Validate email uniqueness
      const existingUser = await this.prisma.user.findUnique({
        where: { email: request.email.toLowerCase() }
      })

      if (existingUser) {
        throw new Error('User with this email already exists')
      }

      // Validate organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: request.organizationId }
      })

      if (!organization) {
        throw new Error('Organization not found')
      }

      // Generate temporary password if sending invitation
      let hashedPassword: string | null = null
      let tempPassword: string | null = null

      if (request.sendInvitation) {
        tempPassword = this.generateTempPassword()
        hashedPassword = await hashPassword(tempPassword)
      }

      // Create user
      const user = await this.prisma.user.create({
        data: {
          name: request.name,
          email: request.email.toLowerCase(),
          password: hashedPassword,
          role: request.role,
          organizationId: request.organizationId,
          permissions: request.permissions || [],
          emailVerified: request.sendInvitation ? null : new Date(),
          preferences: {
            theme: 'light',
            notifications: { email: true, inApp: true },
            defaultEngine: 'LANGFLOW'
          }
        },
        include: {
          organization: true
        }
      })

      // Send invitation email if requested
      if (request.sendInvitation && tempPassword) {
        await this.sendUserInvitation(user, tempPassword, createdBy)
      }

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: createdBy,
        organizationId: request.organizationId,
        action: 'user.create',
        resource: 'users',
        resourceId: user.id,
        details: {
          userEmail: user.email,
          userRole: user.role,
          sendInvitation: request.sendInvitation
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: true
      })

      return this.mapUserToResponse(user)
    } catch (error) {
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string, requesterId: string): Promise<UserResponse | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: true
        }
      })

      if (!user) {
        return null
      }

      // Check if requester can view this user
      const canView = await this.rbacService.hasPermission(requesterId, 'users', 'read')
      if (!canView && requesterId !== userId) {
        throw new Error('Insufficient permissions to view user')
      }

      return this.mapUserToResponse(user)
    } catch (error) {
      throw new Error(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, request: UpdateUserRequest, updatedBy: string): Promise<UserResponse> {
    try {
      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId }
      })

      if (!existingUser) {
        throw new Error('User not found')
      }

      // Check permissions
      const canUpdate = await this.rbacService.hasPermission(updatedBy, 'users', 'update')
      if (!canUpdate && updatedBy !== userId) {
        throw new Error('Insufficient permissions to update user')
      }

      // Validate email uniqueness if email is being changed
      if (request.email && request.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findUnique({
          where: { email: request.email.toLowerCase() }
        })

        if (emailExists) {
          throw new Error('Email already in use')
        }
      }

      // Update user
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(request.name && { name: request.name }),
          ...(request.email && { email: request.email.toLowerCase() }),
          ...(request.role && { role: request.role }),
          ...(request.permissions && { permissions: request.permissions }),
          ...(request.isActive !== undefined && { isActive: request.isActive }),
          ...(request.preferences && { preferences: request.preferences }),
          updatedAt: new Date()
        },
        include: {
          organization: true
        }
      })

      // Invalidate user cache
      await this.rbacService.invalidateUserCache(userId)

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: updatedBy,
        organizationId: updatedUser.organizationId,
        action: 'user.update',
        resource: 'users',
        resourceId: userId,
        details: {
          changes: request,
          targetUser: updatedUser.email
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: true
      })

      return this.mapUserToResponse(updatedUser)
    } catch (error) {
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string, deletedBy: string): Promise<void> {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Check permissions
      const canDelete = await this.rbacService.hasPermission(deletedBy, 'users', 'delete')
      if (!canDelete) {
        throw new Error('Insufficient permissions to delete user')
      }

      // Prevent self-deletion
      if (userId === deletedBy) {
        throw new Error('Cannot delete your own account')
      }

      // Soft delete by deactivating
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          email: `deleted_${Date.now()}_${user.email}`, // Prevent email conflicts
          updatedAt: new Date()
        }
      })

      // Invalidate user cache
      await this.rbacService.invalidateUserCache(userId)

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: deletedBy,
        organizationId: user.organizationId,
        action: 'user.delete',
        resource: 'users',
        resourceId: userId,
        details: {
          deletedUserEmail: user.email
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: true
      })
    } catch (error) {
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * List users with filtering and pagination
   */
  async listUsers(
    filters: UserFilters,
    page: number = 1,
    limit: number = 20,
    requesterId: string
  ): Promise<UserListResponse> {
    try {
      // Check permissions
      const canList = await this.rbacService.hasPermission(requesterId, 'users', 'read')
      if (!canList) {
        throw new Error('Insufficient permissions to list users')
      }

      // Build where clause
      const where: any = {
        isActive: true
      }

      if (filters.role) {
        where.role = filters.role
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      if (filters.organizationId) {
        where.organizationId = filters.organizationId
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } }
        ]
      }

      if (filters.createdAfter) {
        where.createdAt = { gte: filters.createdAfter }
      }

      if (filters.createdBefore) {
        where.createdAt = { ...where.createdAt, lte: filters.createdBefore }
      }

      // Get total count
      const total = await this.prisma.user.count({ where })

      // Get users
      const users = await this.prisma.user.findMany({
        where,
        include: {
          organization: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })

      return {
        users: users.map(user => this.mapUserToResponse(user)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      throw new Error(`Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(organizationId?: string, requesterId?: string): Promise<UserStats> {
    try {
      if (requesterId) {
        const canView = await this.rbacService.hasPermission(requesterId, 'users', 'read')
        if (!canView) {
          throw new Error('Insufficient permissions to view user statistics')
        }
      }

      const where: any = {}
      if (organizationId) {
        where.organizationId = organizationId
      }

      const [total, active, roleStats, recentLogins, pendingInvitations] = await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.count({ where: { ...where, isActive: true } }),
        this.prisma.user.groupBy({
          by: ['role'],
          where,
          _count: { role: true }
        }),
        this.prisma.user.count({
          where: {
            ...where,
            lastLoginAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),
        0 // This would count pending invitations from invitation table
      ])

      const byRole = roleStats.reduce((acc, stat) => {
        acc[stat.role] = stat._count.role
        return acc
      }, {} as Record<UserRole, number>)

      return {
        total,
        active,
        byRole,
        recentLogins,
        pendingInvitations
      }
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Bulk user operations
   */
  async bulkOperation(operation: BulkUserOperation, operatorId: string): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processed: 0,
      failed: 0,
      errors: []
    }

    try {
      // Check permissions
      const canPerformOperation = await this.rbacService.hasPermission(operatorId, 'users', operation.operation)
      if (!canPerformOperation) {
        throw new Error('Insufficient permissions for bulk operation')
      }

      for (const userId of operation.userIds) {
        try {
          switch (operation.operation) {
            case 'activate':
              await this.prisma.user.update({
                where: { id: userId },
                data: { isActive: true }
              })
              break

            case 'deactivate':
              await this.prisma.user.update({
                where: { id: userId },
                data: { isActive: false }
              })
              break

            case 'delete':
              await this.deleteUser(userId, operatorId)
              break

            case 'updateRole':
              if (operation.data?.role) {
                await this.prisma.user.update({
                  where: { id: userId },
                  data: { 
                    role: operation.data.role,
                    permissions: operation.data.permissions || []
                  }
                })
              }
              break
          }

          // Invalidate user cache
          await this.rbacService.invalidateUserCache(userId)
          result.processed++
        } catch (error) {
          result.failed++
          result.errors.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: operatorId,
        organizationId: 'system',
        action: `user.bulk_${operation.operation}`,
        resource: 'users',
        details: {
          operation: operation.operation,
          userIds: operation.userIds,
          data: operation.data,
          result
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: result.failed === 0
      })

      result.success = result.failed === 0
      return result
    } catch (error) {
      result.success = false
      result.errors.push({
        userId: 'bulk',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return result
    }
  }

  /**
   * Create user invitation
   */
  async createInvitation(request: CreateInvitationRequest, invitedBy: string): Promise<UserInvitation> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: request.email.toLowerCase() }
      })

      if (existingUser) {
        throw new Error('User with this email already exists')
      }

      // Get inviter's organization
      const inviter = await this.prisma.user.findUnique({
        where: { id: invitedBy },
        select: { organizationId: true }
      })

      if (!inviter) {
        throw new Error('Inviter not found')
      }

      // Generate invitation token
      const token = generateVerificationToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      // Store invitation in Redis
      const invitationData = {
        id: uuidv4(),
        email: request.email.toLowerCase(),
        role: request.role,
        organizationId: inviter.organizationId,
        invitedBy,
        token,
        expiresAt,
        acceptedAt: null,
        createdAt: new Date(),
        permissions: request.permissions || []
      }

      await this.redis.setex(
        `invitation:${token}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify(invitationData)
      )

      // Send invitation email
      await this.notificationService.sendInvitationEmail(
        request.email,
        inviter.organizationId,
        token,
        request.message
      )

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: invitedBy,
        organizationId: inviter.organizationId,
        action: 'user.invite',
        resource: 'users',
        details: {
          invitedEmail: request.email,
          role: request.role,
          permissions: request.permissions
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: true
      })

      return invitationData
    } catch (error) {
      throw new Error(`Failed to create invitation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Accept user invitation
   */
  async acceptInvitation(request: AcceptInvitationRequest): Promise<UserResponse> {
    try {
      // Get invitation data
      const invitationData = await this.redis.get(`invitation:${request.token}`)
      if (!invitationData) {
        throw new Error('Invalid or expired invitation token')
      }

      const invitation = JSON.parse(invitationData)

      // Validate password
      const passwordValidation = validatePassword(request.password)
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`)
      }

      // Hash password
      const hashedPassword = await hashPassword(request.password)

      // Create user
      const user = await this.prisma.user.create({
        data: {
          name: request.name,
          email: invitation.email,
          password: hashedPassword,
          role: invitation.role,
          organizationId: invitation.organizationId,
          permissions: invitation.permissions,
          emailVerified: new Date(),
          preferences: {
            theme: 'light',
            notifications: { email: true, inApp: true },
            defaultEngine: 'LANGFLOW'
          }
        },
        include: {
          organization: true
        }
      })

      // Mark invitation as accepted
      invitation.acceptedAt = new Date()
      await this.redis.setex(
        `invitation:${request.token}`,
        24 * 60 * 60, // Keep for 1 day for audit
        JSON.stringify(invitation)
      )

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: user.id,
        organizationId: user.organizationId,
        action: 'user.accept_invitation',
        resource: 'users',
        resourceId: user.id,
        details: {
          invitationToken: request.token,
          invitedBy: invitation.invitedBy
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: true
      })

      return this.mapUserToResponse(user)
    } catch (error) {
      throw new Error(`Failed to accept invitation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update user profile (self-service)
   */
  async updateProfile(userId: string, updates: Partial<UpdateUserRequest>): Promise<UserResponse> {
    try {
      // Users can only update their own profile
      const allowedFields = ['name', 'preferences']
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key as keyof UpdateUserRequest]
          return obj
        }, {} as any)

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...filteredUpdates,
          updatedAt: new Date()
        },
        include: {
          organization: true
        }
      })

      return this.mapUserToResponse(updatedUser)
    } catch (error) {
      throw new Error(`Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Map database user to response format
   */
  private mapUserToResponse(user: User & { organization: any }): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      permissions: user.permissions as string[],
      isActive: user.isActive,
      emailVerified: !!user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      preferences: user.preferences as any,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        plan: user.organization.plan
      }
    }
  }

  /**
   * Generate temporary password
   */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  /**
   * Send user invitation email
   */
  private async sendUserInvitation(user: User, tempPassword: string, invitedBy: string): Promise<void> {
    try {
      await this.notificationService.sendWelcomeEmail(
        user.email,
        user.name || 'User',
        tempPassword,
        user.organizationId
      )
    } catch (error) {
      console.error('Failed to send invitation email:', error)
      // Don't throw error as user creation was successful
    }
  }
}