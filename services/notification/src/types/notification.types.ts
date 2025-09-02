export interface NotificationEvent {
  id: string
  type: NotificationEventType
  source: string
  timestamp: Date
  data: Record<string, any>
  userId?: string
  organizationId?: string
}

export enum NotificationEventType {
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_CANCELLED = 'workflow.cancelled',
  EXECUTION_TIMEOUT = 'execution.timeout',
  SYSTEM_ALERT = 'system.alert',
  USER_INVITED = 'user.invited',
  WORKFLOW_SHARED = 'workflow.shared',
  COMMENT_ADDED = 'comment.added',
  MARKETPLACE_PUBLISHED = 'marketplace.published'
}

export interface NotificationChannel {
  id: string
  type: NotificationChannelType
  name: string
  config: NotificationChannelConfig
  isActive: boolean
  organizationId?: string
  userId?: string
  createdAt: Date
  updatedAt: Date
}

export enum NotificationChannelType {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  TEAMS = 'teams'
}

export interface NotificationChannelConfig {
  email?: EmailConfig
  webhook?: WebhookConfig
  slack?: SlackConfig
  teams?: TeamsConfig
}

export interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPassword: string
  fromEmail: string
  fromName: string
}

export interface WebhookConfig {
  url: string
  method: 'POST' | 'PUT' | 'PATCH'
  headers?: Record<string, string>
  secret?: string
  retryAttempts: number
  retryDelay: number
  timeout: number
}

export interface SlackConfig {
  botToken: string
  channel: string
  username?: string
  iconEmoji?: string
}

export interface TeamsConfig {
  webhookUrl: string
  title?: string
  themeColor?: string
}

export interface NotificationRule {
  id: string
  name: string
  eventTypes: NotificationEventType[]
  channels: string[]
  conditions?: NotificationCondition[]
  template?: string
  isActive: boolean
  organizationId?: string
  userId?: string
  createdAt: Date
  updatedAt: Date
}

export interface NotificationCondition {
  field: string
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex'
  value: string
}

export interface NotificationTemplate {
  id: string
  name: string
  type: NotificationChannelType
  eventType: NotificationEventType
  subject?: string
  body: string
  variables: string[]
  organizationId?: string
  createdAt: Date
  updatedAt: Date
}

export interface NotificationDelivery {
  id: string
  eventId: string
  channelId: string
  ruleId: string
  status: NotificationDeliveryStatus
  attempts: number
  lastAttemptAt?: Date
  nextRetryAt?: Date
  error?: string
  deliveredAt?: Date
  createdAt: Date
}

export enum NotificationDeliveryStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled'
}

export interface WebhookEndpoint {
  id: string
  url: string
  secret: string
  eventTypes: NotificationEventType[]
  isActive: boolean
  organizationId: string
  userId: string
  lastPingAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  eventId: string
  url: string
  httpStatus?: number
  requestHeaders: Record<string, string>
  requestBody: string
  responseHeaders?: Record<string, string>
  responseBody?: string
  duration?: number
  attempts: number
  status: WebhookDeliveryStatus
  error?: string
  deliveredAt?: Date
  nextRetryAt?: Date
  createdAt: Date
}

export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled'
}