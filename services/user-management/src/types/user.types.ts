import { UserRole, SubscriptionPlan } from '@prisma/client'

export interface CreateUserRequest {
  name: string
  email: string
  role: UserRole
  organizationId: string
  permissions?: string[]
  sendInvitation?: boolean
}

export interface UpdateUserRequest {
  name?: string
  email?: string
  role?: UserRole
  permissions?: string[]
  isActive?: boolean
  preferences?: UserPreferences
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  notifications: {
    email: boolean
    inApp: boolean
    slack?: boolean
  }
  defaultEngine: 'LANGFLOW' | 'N8N' | 'LANGSMITH'
  timezone?: string
  language?: string
}

export interface UserResponse {
  id: string
  name: string | null
  email: string
  role: UserRole
  organizationId: string
  permissions: string[]
  isActive: boolean
  emailVerified: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
  preferences: UserPreferences
  organization: {
    id: string
    name: string
    slug: string
    plan: SubscriptionPlan
  }
}

export interface UserListResponse {
  users: UserResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UserInvitation {
  id: string
  email: string
  role: UserRole
  organizationId: string
  invitedBy: string
  token: string
  expiresAt: Date
  acceptedAt: Date | null
  createdAt: Date
}

export interface CreateInvitationRequest {
  email: string
  role: UserRole
  permissions?: string[]
  message?: string
}

export interface AcceptInvitationRequest {
  token: string
  name: string
  password: string
}

export interface UserFilters {
  role?: UserRole
  isActive?: boolean
  organizationId?: string
  search?: string
  createdAfter?: Date
  createdBefore?: Date
}

export interface UserStats {
  total: number
  active: number
  byRole: Record<UserRole, number>
  recentLogins: number
  pendingInvitations: number
}

export interface PermissionCheck {
  userId: string
  permission: string
  resource?: string
  resourceId?: string
}

export interface PermissionResult {
  allowed: boolean
  reason?: string
}

export interface BulkUserOperation {
  userIds: string[]
  operation: 'activate' | 'deactivate' | 'delete' | 'updateRole'
  data?: {
    role?: UserRole
    permissions?: string[]
  }
}

export interface BulkOperationResult {
  success: boolean
  processed: number
  failed: number
  errors: Array<{
    userId: string
    error: string
  }>
}

export interface ValidationResult {
  isValid: boolean
  user?: {
    id: string
    email: string
    name: string | null
    role: UserRole
    organizationId: string
    permissions: string[]
    emailVerified: boolean
  }
  error?: string
}