export enum EngineType {
  LANGFLOW = 'langflow',
  N8N = 'n8n',
  LANGSMITH = 'langsmith'
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    config?: Record<string, any>
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  type?: string
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export interface Workflow {
  id: string
  name: string
  description: string
  engineType: EngineType
  definition: WorkflowDefinition
  version: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
  tags: string[]
  isPublic: boolean
  organizationId: string
}

export interface Execution {
  id: string
  workflowId: string
  workflowName: string
  status: ExecutionStatus
  startTime: Date
  endTime?: Date
  duration?: number
  engineType: EngineType
  triggeredBy: string
  logs?: string[]
  error?: string
}

export interface ExecutionMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageDuration: number
  executionsToday: number
}