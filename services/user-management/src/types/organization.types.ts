import { SubscriptionPlan, UserRole } from '@prisma/client'

export interface CreateOrganizationRequest {
  name: string
  slug?: string
  plan: SubscriptionPlan
  settings?: OrganizationSettings
  adminUser: {
    name: string
    email: string
    password: string
  }
}

export interface UpdateOrganizationRequest {
  name?: string
  slug?: string
  plan?: SubscriptionPlan
  settings?: OrganizationSettings
  isActive?: boolean
}

export interface OrganizationSettings {
  allowPublicWorkflows: boolean
  maxConcurrentExecutions: number
  retentionDays: number
  allowedDomains?: string[]
  ssoEnabled?: boolean
  ssoProvider?: string
  requireEmailVerification: boolean
  passwordPolicy?: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSpecialChars: boolean
    maxAge?: number
  }
  features?: {
    marketplace: boolean
    collaboration: boolean
    analytics: boolean
    apiAccess: boolean
  }
}

export interface OrganizationResponse {
  id: string
  name: string
  slug: string
  plan: SubscriptionPlan
  settings: OrganizationSettings
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  memberCount: number
  workflowCount: number
  executionCount: number
  usage: {
    currentPeriodStart: Date
    currentPeriodEnd: Date
    executionsUsed: number
    executionsLimit: number
    storageUsed: number
    storageLimit: number
  }
}

export interface OrganizationMember {
  id: string
  name: string | null
  email: string
  role: UserRole
  permissions: string[]
  isActive: boolean
  joinedAt: Date
  lastLoginAt: Date | null
}

export interface OrganizationStats {
  totalMembers: number
  activeMembers: number
  membersByRole: Record<UserRole, number>
  totalWorkflows: number
  totalExecutions: number
  executionsThisMonth: number
  storageUsed: number
  apiCallsThisMonth: number
}

export interface OrganizationInvitation {
  id: string
  organizationId: string
  email: string
  role: UserRole
  invitedBy: string
  token: string
  expiresAt: Date
  acceptedAt: Date | null
  createdAt: Date
}

export interface OrganizationFilters {
  plan?: SubscriptionPlan
  isActive?: boolean
  search?: string
  createdAfter?: Date
  createdBefore?: Date
}

export interface OrganizationListResponse {
  organizations: OrganizationResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface TransferOwnershipRequest {
  newOwnerId: string
  confirmationCode: string
}

export interface OrganizationUsage {
  period: {
    start: Date
    end: Date
  }
  executions: {
    total: number
    successful: number
    failed: number
    byEngine: Record<string, number>
  }
  storage: {
    workflows: number
    logs: number
    artifacts: number
    total: number
  }
  apiCalls: {
    total: number
    byEndpoint: Record<string, number>
  }
  costs: {
    compute: number
    storage: number
    api: number
    total: number
  }
}

export interface BillingInfo {
  plan: SubscriptionPlan
  status: 'active' | 'past_due' | 'canceled' | 'trialing'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  nextBillingDate: Date
  amount: number
  currency: string
  paymentMethod?: {
    type: 'card' | 'bank'
    last4: string
    brand?: string
  }
}