export enum EngineType {
  LANGFLOW = 'LANGFLOW',
  N8N = 'N8N',
  LANGSMITH = 'LANGSMITH'
}

export enum WorkflowVisibility {
  PRIVATE = 'PRIVATE',
  ORGANIZATION = 'ORGANIZATION',
  PUBLIC = 'PUBLIC'
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum CollaboratorRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer'
}

// Core workflow definition interface
export interface WorkflowDefinition {
  nodes?: any[]
  edges?: any[]
  variables?: Record<string, any>
  settings?: Record<string, any>
  metadata?: Record<string, any>
}

// Workflow parameters for execution
export interface WorkflowParameters {
  inputs?: Record<string, any>
  environment?: Record<string, any>
  settings?: Record<string, any>
}

// Main Workflow model
export interface Workflow {
  id: string
  name: string
  description?: string
  engineType: EngineType
  definition: WorkflowDefinition
  version: number
  visibility: WorkflowVisibility
  tags: string[]
  createdBy: string
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

// Workflow creation request
export interface CreateWorkflowRequest {
  name: string
  description?: string
  engineType: EngineType
  definition: WorkflowDefinition
  visibility?: WorkflowVisibility
  tags?: string[]
}

// Workflow update request
export interface UpdateWorkflowRequest {
  name?: string
  description?: string
  definition?: WorkflowDefinition
  visibility?: WorkflowVisibility
  tags?: string[]
}

// Workflow version model
export interface WorkflowVersion {
  id: string
  workflowId: string
  version: number
  definition: WorkflowDefinition
  changeLog?: string
  createdBy: string
  createdAt: Date
}

// Workflow version creation request
export interface CreateWorkflowVersionRequest {
  definition: WorkflowDefinition
  changeLog?: string
}

// Workflow collaborator model
export interface WorkflowCollaborator {
  id: string
  workflowId: string
  userId: string
  role: CollaboratorRole
  createdAt: Date
}

// Workflow sharing request
export interface ShareWorkflowRequest {
  userId: string
  role: CollaboratorRole
}

// Workflow execution model
export interface Execution {
  id: string
  workflowId: string
  workflowVersion: number
  status: ExecutionStatus
  parameters?: WorkflowParameters
  result?: any
  logs?: any
  metrics?: ExecutionMetrics
  startTime: Date
  endTime?: Date
  executorId?: string
  userId: string
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

// Execution metrics
export interface ExecutionMetrics {
  duration?: number
  nodesExecuted?: number
  memoryUsage?: number
  cpuUsage?: number
  errors?: number
  warnings?: number
}

// Workflow validation result
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  path?: string
  severity: 'error'
}

export interface ValidationWarning {
  code: string
  message: string
  path?: string
  severity: 'warning'
}

// Workflow import/export
export interface WorkflowImportRequest {
  source: any
  engineType: EngineType
  name?: string
  description?: string
}

export interface WorkflowExportOptions {
  includeVersions?: boolean
  format?: 'json' | 'yaml'
}

// Workflow search and filtering
export interface WorkflowSearchOptions {
  query?: string
  engineType?: EngineType
  visibility?: WorkflowVisibility
  tags?: string[]
  createdBy?: string
  organizationId?: string
  limit?: number
  offset?: number
  sortBy?: 'name' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface WorkflowSearchResult {
  workflows: Workflow[]
  total: number
  hasMore: boolean
}

// Workflow statistics
export interface WorkflowStats {
  totalWorkflows: number
  workflowsByEngine: Record<EngineType, number>
  workflowsByVisibility: Record<WorkflowVisibility, number>
  totalExecutions: number
  executionsByStatus: Record<ExecutionStatus, number>
  averageExecutionTime: number
}

// Collaboration features
export interface WorkflowComment {
  id: string
  workflowId: string
  userId: string
  content: string
  parentId?: string // For threaded discussions
  createdAt: Date
  updatedAt: Date
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface CreateCommentRequest {
  content: string
  parentId?: string
}

export interface UpdateCommentRequest {
  content: string
}

export interface WorkflowFork {
  id: string
  originalWorkflowId: string
  forkedWorkflowId: string
  userId: string
  createdAt: Date
}

export interface ForkWorkflowRequest {
  name: string
  description?: string
}

export interface MergeRequest {
  id: string
  sourceWorkflowId: string
  targetWorkflowId: string
  title: string
  description?: string
  status: MergeRequestStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export enum MergeRequestStatus {
  OPEN = 'OPEN',
  MERGED = 'MERGED',
  CLOSED = 'CLOSED',
  DRAFT = 'DRAFT'
}

export interface CreateMergeRequest {
  targetWorkflowId: string
  title: string
  description?: string
}

export interface TeamWorkspace {
  id: string
  name: string
  description?: string
  organizationId: string
  createdBy: string
  members: WorkspaceMember[]
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  createdAt: Date
  user?: {
    id: string
    name: string
    email: string
  }
}

export enum WorkspaceRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER'
}

export interface CreateWorkspaceRequest {
  name: string
  description?: string
}

export interface AddWorkspaceMemberRequest {
  userId: string
  role: WorkspaceRole
}

// Real-time collaboration
export interface CollaborationSession {
  id: string
  workflowId: string
  userId: string
  socketId: string
  cursor?: CursorPosition
  selection?: SelectionRange
  lastActivity: Date
}

export interface CursorPosition {
  nodeId?: string
  x: number
  y: number
}

export interface SelectionRange {
  nodeIds: string[]
  edgeIds: string[]
}

export interface CollaborativeOperation {
  id: string
  workflowId: string
  userId: string
  operation: OperationType
  data: any
  timestamp: Date
  applied: boolean
}

export enum OperationType {
  NODE_ADD = 'NODE_ADD',
  NODE_UPDATE = 'NODE_UPDATE',
  NODE_DELETE = 'NODE_DELETE',
  EDGE_ADD = 'EDGE_ADD',
  EDGE_UPDATE = 'EDGE_UPDATE',
  EDGE_DELETE = 'EDGE_DELETE',
  WORKFLOW_UPDATE = 'WORKFLOW_UPDATE'
}

// WebSocket events
export interface WebSocketEvent {
  type: string
  data: any
  userId: string
  timestamp: Date
}

export interface UserJoinedEvent extends WebSocketEvent {
  type: 'USER_JOINED'
  data: {
    userId: string
    userName: string
    cursor?: CursorPosition
  }
}

export interface UserLeftEvent extends WebSocketEvent {
  type: 'USER_LEFT'
  data: {
    userId: string
  }
}

export interface CursorUpdateEvent extends WebSocketEvent {
  type: 'CURSOR_UPDATE'
  data: {
    userId: string
    cursor: CursorPosition
  }
}

export interface OperationEvent extends WebSocketEvent {
  type: 'OPERATION'
  data: CollaborativeOperation
}