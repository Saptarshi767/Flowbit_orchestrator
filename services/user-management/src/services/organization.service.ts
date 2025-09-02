import { PrismaClient, SubscriptionPlan, UserRole } from '@prisma/client'
import { 
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationResponse,
  OrganizationListResponse,
  OrganizationFilters,
  OrganizationStats,
  OrganizationMember,
  TransferOwnershipRequest,
  OrganizationUsage,
  BillingInfo
} from '../types/organization.types'
import { RBACService } from './rbac.service'
import { UserService } from './user.service'
import { hashPassword } from '../utils/password.utils'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'

/**
 * Organization Management Service
 * Handles organization CRUD operations, membership, and multi-tenancy
 */
export class OrganizationService {
  private prisma: PrismaClient
  private redis: Redis
  private rbacService: RBACService

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    rbacService: RBACService
  ) {
    this.prisma = prisma
    this.redis = redis
    this.rbacService = rbacService
  }

  /**
   * Create a new organization with admin user
   */
  async createOrganization(request: CreateOrganizationRequest): Promise<OrganizationResponse> {
    try {
      // Generate slug if not provided
      const slug = request.slug || this.generateSlug(request.name)

      // Check slug uniqueness
      const existingOrg = await this.prisma.organization.findUnique({
        where: { slug }
      })

      if (existingOrg) {
        throw new Error('Organization slug already exists')
      }

      // Check if admin user email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: request.adminUser.email.toLowerCase() }
      })

      if (existingUser) {
        throw new Error('Admin user email already exists')
      }

      // Create organization and admin user in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create organization
        const organization = await tx.organization.create({
          data: {
            name: request.name,
            slug,
            plan: request.plan,
            settings: request.settings || this.getDefaultSettings(request.plan),
            isActive: true
          }
        })

        // Hash admin password
        const hashedPassword = await hashPassword(request.adminUser.password)

        // Create admin user
        const adminUser = await tx.user.create({
          data: {
            name: request.adminUser.name,
            email: request.adminUser.email.toLowerCase(),
            password: hashedPassword,
            role: UserRole.ADMIN,
            organizationId: organization.id,
            emailVerified: new Date(),
            preferences: {
              theme: 'light',
              notifications: { email: true, inApp: true },
              defaultEngine: 'LANGFLOW'
            }
          }
        })

        return { organization, adminUser }
      })

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: result.adminUser.id,
        organizationId: result.organization.id,
        action: 'organization.create',
        resource: 'organizations',
        resourceId: result.organization.id,
        details: {
          organizationName: result.organization.name,
          plan: result.organization.plan,
          adminEmail: result.adminUser.email
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: true
      })

      return this.mapOrganizationToResponse(result.organization)
    } catch (error) {
      throw new Error(`Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(organizationId: string, requesterId: string): Promise<OrganizationResponse | null> {
    try {
      // Check permissions
      const canView = await this.rbacService.hasPermission(requesterId, 'organizations', 'read')
      if (!canView) {
        throw new Error('Insufficient permissions to view organization')
      }

      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId }
      })

      if (!organization) {
        return null
      }

      return this.mapOrganizationToResponse(organization)
    } catch (error) {
      throw new Error(`Failed to get organization: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(
    organizationId: string, 
    request: UpdateOrganizationRequest, 
    updatedBy: string
  ): Promise<OrganizationResponse> {
    try {
      // Check permissions
      const canUpdate = await this.rbacService.hasPermission(updatedBy, 'organizations', 'update')
      if (!canUpdate) {
        throw new Error('Insufficient permissions to update organization')
      }

      // Check if organization exists
      const existingOrg = await this.prisma.organization.findUnique({
        where: { id: organizationId }
      })

      if (!existingOrg) {
        throw new Error('Organization not found')
      }

      // Check slug uniqueness if slug is being changed
      if (request.slug && request.slug !== existingOrg.slug) {
        const slugExists = await this.prisma.organization.findUnique({
          where: { slug: request.slug }
        })

        if (slugExists) {
          throw new Error('Slug already in use')
        }
      }

      // Update organization
      const updatedOrg = await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          ...(request.name && { name: request.name }),
          ...(request.slug && { slug: request.slug }),
          ...(request.plan && { plan: request.plan }),
          ...(request.settings && { settings: request.settings }),
          ...(request.isActive !== undefined && { isActive: request.isActive }),
          updatedAt: new Date()
        }
      })

      // Invalidate organization cache
      await this.rbacService.invalidateOrganizationCache(organizationId)

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: updatedBy,
        organizationId,
        action: 'organization.update',
        resource: 'organizations',
        resourceId: organizationId,
        details: {
          changes: request
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: true
      })

      return this.mapOrganizationToResponse(updatedOrg)
    } catch (error) {
      throw new Error(`Failed to update organization: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * List organizations with filtering and pagination
   */
  async listOrganizations(
    filters: OrganizationFilters,
    page: number = 1,
    limit: number = 20,
    requesterId: string
  ): Promise<OrganizationListResponse> {
    try {
      // Check permissions (only system admins can list all organizations)
      const requester = await this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { role: true, organizationId: true }
      })

      if (!requester) {
        throw new Error('Requester not found')
      }

      // Build where clause
      const where: any = {}

      // Non-system admins can only see their own organization
      if (requester.role !== UserRole.ADMIN) {
        where.id = requester.organizationId
      }

      if (filters.plan) {
        where.plan = filters.plan
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { slug: { contains: filters.search, mode: 'insensitive' } }
        ]
      }

      if (filters.createdAfter) {
        where.createdAt = { gte: filters.createdAfter }
      }

      if (filters.createdBefore) {
        where.createdAt = { ...where.createdAt, lte: filters.createdBefore }
      }

      // Get total count
      const total = await this.prisma.organization.count({ where })

      // Get organizations
      const organizations = await this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })

      return {
        organizations: organizations.map(org => this.mapOrganizationToResponse(org)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      throw new Error(`Failed to list organizations: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(organizationId: string, requesterId: string): Promise<OrganizationMember[]> {
    try {
      // Check permissions
      const canView = await this.rbacService.hasPermission(requesterId, 'users', 'read')
      if (!canView) {
        throw new Error('Insufficient permissions to view organization members')
      }

      const members = await this.prisma.user.findMany({
        where: { 
          organizationId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          permissions: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true
        },
        orderBy: { createdAt: 'asc' }
      })

      return members.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        permissions: member.permissions as string[],
        isActive: member.isActive,
        joinedAt: member.createdAt,
        lastLoginAt: member.lastLoginAt
      }))
    } catch (error) {
      throw new Error(`Failed to get organization members: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(organizationId: string, requesterId: string): Promise<OrganizationStats> {
    try {
      // Check permissions
      const canView = await this.rbacService.hasPermission(requesterId, 'organizations', 'read')
      if (!canView) {
        throw new Error('Insufficient permissions to view organization statistics')
      }

      const [
        totalMembers,
        activeMembers,
        membersByRole,
        totalWorkflows,
        totalExecutions,
        executionsThisMonth
      ] = await Promise.all([
        this.prisma.user.count({
          where: { organizationId }
        }),
        this.prisma.user.count({
          where: { organizationId, isActive: true }
        }),
        this.prisma.user.groupBy({
          by: ['role'],
          where: { organizationId },
          _count: { role: true }
        }),
        this.prisma.workflow.count({
          where: { organizationId }
        }),
        this.prisma.execution.count({
          where: { organizationId }
        }),
        this.prisma.execution.count({
          where: {
            organizationId,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        })
      ])

      const roleStats = membersByRole.reduce((acc, stat) => {
        acc[stat.role] = stat._count.role
        return acc
      }, {} as Record<UserRole, number>)

      return {
        totalMembers,
        activeMembers,
        membersByRole: roleStats,
        totalWorkflows,
        totalExecutions,
        executionsThisMonth,
        storageUsed: 0, // This would be calculated from actual storage usage
        apiCallsThisMonth: 0 // This would be calculated from API usage logs
      }
    } catch (error) {
      throw new Error(`Failed to get organization stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Transfer organization ownership
   */
  async transferOwnership(
    organizationId: string,
    request: TransferOwnershipRequest,
    currentOwnerId: string
  ): Promise<void> {
    try {
      // Verify current owner
      const currentOwner = await this.prisma.user.findUnique({
        where: { id: currentOwnerId },
        select: { role: true, organizationId: true }
      })

      if (!currentOwner || currentOwner.organizationId !== organizationId || currentOwner.role !== UserRole.ADMIN) {
        throw new Error('Only organization admin can transfer ownership')
      }

      // Verify new owner exists and is in the same organization
      const newOwner = await this.prisma.user.findUnique({
        where: { id: request.newOwnerId },
        select: { organizationId: true, isActive: true }
      })

      if (!newOwner || newOwner.organizationId !== organizationId || !newOwner.isActive) {
        throw new Error('New owner must be an active member of the organization')
      }

      // Verify confirmation code (in real implementation, this would be sent via email)
      if (request.confirmationCode !== 'CONFIRM_TRANSFER') {
        throw new Error('Invalid confirmation code')
      }

      // Transfer ownership in transaction
      await this.prisma.$transaction(async (tx) => {
        // Demote current owner to manager
        await tx.user.update({
          where: { id: currentOwnerId },
          data: { role: UserRole.MANAGER }
        })

        // Promote new owner to admin
        await tx.user.update({
          where: { id: request.newOwnerId },
          data: { role: UserRole.ADMIN }
        })
      })

      // Invalidate caches
      await this.rbacService.invalidateUserCache(currentOwnerId)
      await this.rbacService.invalidateUserCache(request.newOwnerId)

      // Create audit event
      await this.rbacService.createAuditEvent({
        userId: currentOwnerId,
        organizationId,
        action: 'organization.transfer_ownership',
        resource: 'organizations',
        resourceId: organizationId,
        details: {
          previousOwner: currentOwnerId,
          newOwner: request.newOwnerId
        },
        ipAddress: 'system',
        userAgent: 'system',
        success: true
      })
    } catch (error) {
      throw new Error(`Failed to transfer ownership: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get organization usage statistics
   */
  async getOrganizationUsage(organizationId: string, requesterId: string): Promise<OrganizationUsage> {
    try {
      // Check permissions
      const canView = await this.rbacService.hasPermission(requesterId, 'organizations', 'read')
      if (!canView) {
        throw new Error('Insufficient permissions to view organization usage')
      }

      const currentMonth = new Date()
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

      // Get execution statistics
      const executions = await this.prisma.execution.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        select: {
          status: true,
          workflow: {
            select: { engineType: true }
          }
        }
      })

      const executionStats = executions.reduce((acc, exec) => {
        acc.total++
        if (exec.status === 'COMPLETED') acc.successful++
        if (exec.status === 'FAILED') acc.failed++
        
        const engine = exec.workflow.engineType
        acc.byEngine[engine] = (acc.byEngine[engine] || 0) + 1
        
        return acc
      }, {
        total: 0,
        successful: 0,
        failed: 0,
        byEngine: {} as Record<string, number>
      })

      return {
        period: {
          start: startOfMonth,
          end: endOfMonth
        },
        executions: executionStats,
        storage: {
          workflows: 0, // Would calculate actual storage usage
          logs: 0,
          artifacts: 0,
          total: 0
        },
        apiCalls: {
          total: 0, // Would get from API usage logs
          byEndpoint: {}
        },
        costs: {
          compute: 0, // Would calculate based on execution time and resources
          storage: 0,
          api: 0,
          total: 0
        }
      }
    } catch (error) {
      throw new Error(`Failed to get organization usage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get organization billing information
   */
  async getBillingInfo(organizationId: string, requesterId: string): Promise<BillingInfo> {
    try {
      // Check permissions
      const canView = await this.rbacService.hasPermission(requesterId, 'organizations', 'manage_billing')
      if (!canView) {
        throw new Error('Insufficient permissions to view billing information')
      }

      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { plan: true }
      })

      if (!organization) {
        throw new Error('Organization not found')
      }

      // This would integrate with actual billing system (Stripe, etc.)
      const currentPeriodStart = new Date()
      currentPeriodStart.setDate(1) // First day of current month
      
      const currentPeriodEnd = new Date(currentPeriodStart)
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)
      currentPeriodEnd.setDate(0) // Last day of current month

      const nextBillingDate = new Date(currentPeriodEnd)
      nextBillingDate.setDate(nextBillingDate.getDate() + 1)

      return {
        plan: organization.plan,
        status: 'active',
        currentPeriodStart,
        currentPeriodEnd,
        nextBillingDate,
        amount: this.getPlanAmount(organization.plan),
        currency: 'USD'
      }
    } catch (error) {
      throw new Error(`Failed to get billing info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Map database organization to response format
   */
  private mapOrganizationToResponse(org: any): OrganizationResponse {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      settings: org.settings,
      isActive: org.isActive,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      memberCount: 0, // Would be populated with actual count
      workflowCount: 0, // Would be populated with actual count
      executionCount: 0, // Would be populated with actual count
      usage: {
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        executionsUsed: 0,
        executionsLimit: this.getPlanExecutionLimit(org.plan),
        storageUsed: 0,
        storageLimit: this.getPlanStorageLimit(org.plan)
      }
    }
  }

  /**
   * Generate organization slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      + '-' + Math.random().toString(36).substr(2, 6)
  }

  /**
   * Get default settings for organization plan
   */
  private getDefaultSettings(plan: SubscriptionPlan) {
    const baseSettings = {
      allowPublicWorkflows: false,
      requireEmailVerification: true,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      }
    }

    switch (plan) {
      case SubscriptionPlan.FREE:
        return {
          ...baseSettings,
          maxConcurrentExecutions: 2,
          retentionDays: 7,
          features: {
            marketplace: false,
            collaboration: false,
            analytics: false,
            apiAccess: false
          }
        }
      case SubscriptionPlan.PROFESSIONAL:
        return {
          ...baseSettings,
          maxConcurrentExecutions: 10,
          retentionDays: 30,
          features: {
            marketplace: true,
            collaboration: true,
            analytics: true,
            apiAccess: true
          }
        }
      case SubscriptionPlan.ENTERPRISE:
        return {
          ...baseSettings,
          allowPublicWorkflows: true,
          maxConcurrentExecutions: 50,
          retentionDays: 90,
          ssoEnabled: true,
          features: {
            marketplace: true,
            collaboration: true,
            analytics: true,
            apiAccess: true
          }
        }
      default:
        return baseSettings
    }
  }

  /**
   * Get plan execution limit
   */
  private getPlanExecutionLimit(plan: SubscriptionPlan): number {
    switch (plan) {
      case SubscriptionPlan.FREE: return 100
      case SubscriptionPlan.PROFESSIONAL: return 1000
      case SubscriptionPlan.ENTERPRISE: return 10000
      default: return 100
    }
  }

  /**
   * Get plan storage limit (in bytes)
   */
  private getPlanStorageLimit(plan: SubscriptionPlan): number {
    switch (plan) {
      case SubscriptionPlan.FREE: return 1024 * 1024 * 1024 // 1GB
      case SubscriptionPlan.PROFESSIONAL: return 10 * 1024 * 1024 * 1024 // 10GB
      case SubscriptionPlan.ENTERPRISE: return 100 * 1024 * 1024 * 1024 // 100GB
      default: return 1024 * 1024 * 1024
    }
  }

  /**
   * Get plan monthly amount
   */
  private getPlanAmount(plan: SubscriptionPlan): number {
    switch (plan) {
      case SubscriptionPlan.FREE: return 0
      case SubscriptionPlan.PROFESSIONAL: return 29
      case SubscriptionPlan.ENTERPRISE: return 99
      default: return 0
    }
  }
}