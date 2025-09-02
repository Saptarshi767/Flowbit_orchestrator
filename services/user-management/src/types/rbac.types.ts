import { UserRole } from '@prisma/client'

export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: string
  conditions?: PermissionCondition[]
}

export interface PermissionCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with'
  value: any
}

export interface Role {
  id: string
  name: UserRole
  description: string
  permissions: Permission[]
  isSystemRole: boolean
  organizationId?: string
}

export interface CustomRole {
  id: string
  name: string
  description: string
  permissions: string[]
  organizationId: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface RoleAssignment {
  userId: string
  roleId: string
  assignedBy: string
  assignedAt: Date
  expiresAt?: Date
}

export interface ResourcePermission {
  resource: string
  resourceId?: string
  permissions: string[]
  conditions?: Record<string, any>
}

export interface AccessContext {
  userId: string
  organizationId: string
  role: UserRole
  permissions: string[]
  customRoles?: string[]
  sessionId?: string
  ipAddress?: string
  userAgent?: string
}

export interface AccessRequest {
  context: AccessContext
  resource: string
  action: string
  resourceId?: string
  data?: any
}

export interface AccessResult {
  allowed: boolean
  reason?: string
  conditions?: Record<string, any>
  ttl?: number
}

export interface PolicyRule {
  id: string
  name: string
  description: string
  resource: string
  actions: string[]
  effect: 'allow' | 'deny'
  conditions?: PolicyCondition[]
  priority: number
  isActive: boolean
}

export interface PolicyCondition {
  field: string
  operator: string
  value: any
  type: 'user' | 'resource' | 'context' | 'time'
}

export interface AccessLog {
  id: string
  userId: string
  organizationId: string
  resource: string
  action: string
  resourceId?: string
  allowed: boolean
  reason?: string
  ipAddress: string
  userAgent: string
  timestamp: Date
  duration: number
}

export interface PermissionMatrix {
  [role: string]: {
    [resource: string]: string[]
  }
}

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  [UserRole.ADMIN]: {
    users: ['create', 'read', 'update', 'delete', 'invite', 'manage_roles'],
    organizations: ['read', 'update', 'manage_settings', 'manage_billing'],
    workflows: ['create', 'read', 'update', 'delete', 'execute', 'publish', 'share'],
    executions: ['read', 'cancel', 'retry', 'delete'],
    marketplace: ['read', 'publish', 'manage'],
    analytics: ['read', 'export'],
    system: ['read', 'manage']
  },
  [UserRole.MANAGER]: {
    users: ['read', 'invite', 'update_basic'],
    organizations: ['read'],
    workflows: ['create', 'read', 'update', 'delete', 'execute', 'share'],
    executions: ['read', 'cancel', 'retry'],
    marketplace: ['read', 'publish'],
    analytics: ['read']
  },
  [UserRole.DEVELOPER]: {
    users: ['read_basic'],
    organizations: ['read_basic'],
    workflows: ['create', 'read', 'update', 'execute', 'share'],
    executions: ['read', 'cancel'],
    marketplace: ['read']
  },
  [UserRole.VIEWER]: {
    users: ['read_basic'],
    organizations: ['read_basic'],
    workflows: ['read'],
    executions: ['read'],
    marketplace: ['read']
  }
}

export interface AuditEvent {
  id: string
  userId: string
  organizationId: string
  action: string
  resource: string
  resourceId?: string
  details: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: Date
  success: boolean
  error?: string
}

export interface SecurityPolicy {
  id: string
  organizationId: string
  name: string
  description: string
  rules: PolicyRule[]
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}