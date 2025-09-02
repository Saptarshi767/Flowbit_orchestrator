import { PrismaClient, UserRole } from '@prisma/client'
import { 
  AccessContext, 
  AccessRequest, 
  AccessResult, 
  Permission, 
  PermissionMatrix, 
  DEFAULT_PERMISSIONS,
  PolicyRule,
  AccessLog,
  AuditEvent
} from '../types/rbac.types'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'

/**
 * Role-Based Access Control Service
 * Handles permission checking, policy evaluation, and access logging
 */
export class RBACService {
  private prisma: PrismaClient
  private redis: Redis
  private permissionCache: Map<string, Permission[]> = new Map()
  private policyCache: Map<string, PolicyRule[]> = new Map()

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma
    this.redis = redis
  }

  /**
   * Check if user has permission to perform action on resource
   */
  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    const startTime = Date.now()
    
    try {
      // Get user permissions
      const userPermissions = await this.getUserPermissions(request.context)
      
      // Check basic role-based permissions
      const roleBasedResult = this.checkRoleBasedPermission(
        request.context.role,
        request.resource,
        request.action
      )

      if (!roleBasedResult.allowed) {
        await this.logAccess(request, false, roleBasedResult.reason, Date.now() - startTime)
        return roleBasedResult
      }

      // Check custom permissions
      const customPermissionResult = this.checkCustomPermissions(
        userPermissions,
        request.resource,
        request.action
      )

      if (!customPermissionResult.allowed) {
        await this.logAccess(request, false, customPermissionResult.reason, Date.now() - startTime)
        return customPermissionResult
      }

      // Check organization-specific policies
      const policyResult = await this.checkPolicies(request)

      if (!policyResult.allowed) {
        await this.logAccess(request, false, policyResult.reason, Date.now() - startTime)
        return policyResult
      }

      // Check resource-specific conditions
      const conditionResult = await this.checkResourceConditions(request)

      if (!conditionResult.allowed) {
        await this.logAccess(request, false, conditionResult.reason, Date.now() - startTime)
        return conditionResult
      }

      // All checks passed
      await this.logAccess(request, true, 'Access granted', Date.now() - startTime)
      
      return {
        allowed: true,
        reason: 'Access granted'
      }
    } catch (error) {
      const errorMessage = `Access check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      await this.logAccess(request, false, errorMessage, Date.now() - startTime)
      
      return {
        allowed: false,
        reason: errorMessage
      }
    }
  }

  /**
   * Check role-based permissions using default permission matrix
   */
  private checkRoleBasedPermission(role: UserRole, resource: string, action: string): AccessResult {
    const rolePermissions = DEFAULT_PERMISSIONS[role]
    
    if (!rolePermissions) {
      return {
        allowed: false,
        reason: `Unknown role: ${role}`
      }
    }

    const resourcePermissions = rolePermissions[resource]
    
    if (!resourcePermissions) {
      return {
        allowed: false,
        reason: `No permissions defined for resource: ${resource}`
      }
    }

    if (!resourcePermissions.includes(action)) {
      return {
        allowed: false,
        reason: `Role ${role} does not have permission to ${action} on ${resource}`
      }
    }

    return {
      allowed: true,
      reason: `Role-based permission granted`
    }
  }

  /**
   * Check custom user permissions
   */
  private checkCustomPermissions(userPermissions: string[], resource: string, action: string): AccessResult {
    const requiredPermission = `${resource}:${action}`
    const wildcardPermission = `${resource}:*`
    const globalPermission = '*:*'

    if (userPermissions.includes(requiredPermission) || 
        userPermissions.includes(wildcardPermission) ||
        userPermissions.includes(globalPermission)) {
      return {
        allowed: true,
        reason: 'Custom permission granted'
      }
    }

    return {
      allowed: true, // Don't block based on custom permissions alone
      reason: 'No custom permissions blocking access'
    }
  }

  /**
   * Check organization-specific policies
   */
  private async checkPolicies(request: AccessRequest): Promise<AccessResult> {
    const policies = await this.getOrganizationPolicies(request.context.organizationId)
    
    // Sort policies by priority (higher priority first)
    const sortedPolicies = policies.sort((a, b) => b.priority - a.priority)
    
    for (const policy of sortedPolicies) {
      if (!policy.isActive) continue
      
      // Check if policy applies to this resource and action
      if (policy.resource !== request.resource && policy.resource !== '*') continue
      if (!policy.actions.includes(request.action) && !policy.actions.includes('*')) continue
      
      // Evaluate policy conditions
      const conditionResult = await this.evaluatePolicyConditions(policy, request)
      
      if (conditionResult) {
        if (policy.effect === 'deny') {
          return {
            allowed: false,
            reason: `Denied by policy: ${policy.name}`
          }
        }
        // Allow policies don't override other checks, they just don't block
      }
    }

    return {
      allowed: true,
      reason: 'No policies blocking access'
    }
  }

  /**
   * Check resource-specific conditions
   */
  private async checkResourceConditions(request: AccessRequest): Promise<AccessResult> {
    // Resource ownership check
    if (request.resourceId) {
      const isOwner = await this.checkResourceOwnership(
        request.context.userId,
        request.resource,
        request.resourceId
      )

      // Some actions require ownership
      const ownershipRequiredActions = ['delete', 'update', 'manage']
      if (ownershipRequiredActions.includes(request.action) && !isOwner) {
        // Check if user has admin/manager role which can override ownership
        if (![UserRole.ADMIN, UserRole.MANAGER].includes(request.context.role)) {
          return {
            allowed: false,
            reason: 'Resource ownership required for this action'
          }
        }
      }
    }

    // Organization membership check
    const isMember = await this.checkOrganizationMembership(
      request.context.userId,
      request.context.organizationId
    )

    if (!isMember) {
      return {
        allowed: false,
        reason: 'User is not a member of the organization'
      }
    }

    return {
      allowed: true,
      reason: 'Resource conditions satisfied'
    }
  }

  /**
   * Get user permissions including custom permissions
   */
  private async getUserPermissions(context: AccessContext): Promise<string[]> {
    const cacheKey = `user_permissions:${context.userId}`
    
    // Try cache first
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // Get from database
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: { permissions: true }
    })

    const permissions = user?.permissions as string[] || []
    
    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(permissions))
    
    return permissions
  }

  /**
   * Get organization policies
   */
  private async getOrganizationPolicies(organizationId: string): Promise<PolicyRule[]> {
    const cacheKey = `org_policies:${organizationId}`
    
    // Try cache first
    const cached = this.policyCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Get from database (this would be implemented when we have policy tables)
    // For now, return empty array
    const policies: PolicyRule[] = []
    
    // Cache for 10 minutes
    this.policyCache.set(cacheKey, policies)
    setTimeout(() => this.policyCache.delete(cacheKey), 600000)
    
    return policies
  }

  /**
   * Evaluate policy conditions
   */
  private async evaluatePolicyConditions(policy: PolicyRule, request: AccessRequest): Promise<boolean> {
    if (!policy.conditions || policy.conditions.length === 0) {
      return true // No conditions means policy applies
    }

    for (const condition of policy.conditions) {
      const result = await this.evaluateCondition(condition, request)
      if (!result) {
        return false // All conditions must be true
      }
    }

    return true
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(condition: any, request: AccessRequest): Promise<boolean> {
    // This would implement condition evaluation logic
    // For now, return true
    return true
  }

  /**
   * Check if user owns the resource
   */
  private async checkResourceOwnership(userId: string, resource: string, resourceId: string): Promise<boolean> {
    try {
      switch (resource) {
        case 'workflows':
          const workflow = await this.prisma.workflow.findUnique({
            where: { id: resourceId },
            select: { createdBy: true }
          })
          return workflow?.createdBy === userId
          
        case 'executions':
          const execution = await this.prisma.execution.findUnique({
            where: { id: resourceId },
            select: { userId: true }
          })
          return execution?.userId === userId
          
        default:
          return false
      }
    } catch (error) {
      return false
    }
  }

  /**
   * Check if user is member of organization
   */
  private async checkOrganizationMembership(userId: string, organizationId: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true }
      })
      
      return user?.organizationId === organizationId
    } catch (error) {
      return false
    }
  }

  /**
   * Log access attempt
   */
  private async logAccess(
    request: AccessRequest, 
    allowed: boolean, 
    reason: string, 
    duration: number
  ): Promise<void> {
    try {
      const logEntry: Omit<AccessLog, 'id'> = {
        userId: request.context.userId,
        organizationId: request.context.organizationId,
        resource: request.resource,
        action: request.action,
        resourceId: request.resourceId,
        allowed,
        reason,
        ipAddress: request.context.ipAddress || 'unknown',
        userAgent: request.context.userAgent || 'unknown',
        timestamp: new Date(),
        duration
      }

      // Store in Redis for real-time monitoring
      await this.redis.lpush('access_logs', JSON.stringify(logEntry))
      await this.redis.ltrim('access_logs', 0, 9999) // Keep last 10k entries

      // Store in database for long-term audit
      // This would be implemented when we have audit log tables
    } catch (error) {
      console.error('Failed to log access:', error)
    }
  }

  /**
   * Create audit event
   */
  async createAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        ...event,
        id: uuidv4(),
        timestamp: new Date()
      }

      // Store in Redis for real-time monitoring
      await this.redis.lpush('audit_events', JSON.stringify(auditEvent))
      await this.redis.ltrim('audit_events', 0, 9999) // Keep last 10k entries

      // Store in database for long-term audit
      // This would be implemented when we have audit log tables
    } catch (error) {
      console.error('Failed to create audit event:', error)
    }
  }

  /**
   * Get user's effective permissions
   */
  async getUserEffectivePermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { 
        role: true, 
        permissions: true,
        organizationId: true
      }
    })

    if (!user) {
      return []
    }

    // Get role-based permissions
    const rolePermissions = this.getRolePermissions(user.role)
    
    // Get custom permissions
    const customPermissions = user.permissions as string[] || []
    
    // Combine and deduplicate
    const allPermissions = [...rolePermissions, ...customPermissions]
    return [...new Set(allPermissions)]
  }

  /**
   * Get permissions for a role
   */
  private getRolePermissions(role: UserRole): string[] {
    const roleMatrix = DEFAULT_PERMISSIONS[role]
    if (!roleMatrix) return []

    const permissions: string[] = []
    
    for (const [resource, actions] of Object.entries(roleMatrix)) {
      for (const action of actions) {
        permissions.push(`${resource}:${action}`)
      }
    }
    
    return permissions
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { 
        role: true, 
        permissions: true,
        organizationId: true
      }
    })

    if (!user) return false

    const context: AccessContext = {
      userId,
      organizationId: user.organizationId,
      role: user.role,
      permissions: user.permissions as string[] || []
    }

    const request: AccessRequest = {
      context,
      resource,
      action
    }

    const result = await this.checkAccess(request)
    return result.allowed
  }

  /**
   * Invalidate user permission cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const cacheKey = `user_permissions:${userId}`
    await this.redis.del(cacheKey)
  }

  /**
   * Invalidate organization policy cache
   */
  async invalidateOrganizationCache(organizationId: string): Promise<void> {
    const cacheKey = `org_policies:${organizationId}`
    this.policyCache.delete(cacheKey)
  }
}