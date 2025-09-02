// Local types for testing to avoid shared package import issues

export enum EngineType {
  LANGFLOW = 'langflow',
  N8N = 'n8n',
  LANGSMITH = 'langsmith'
}

export interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  engineType: EngineType;
  definition: any;
  version?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowParameters {
  [key: string]: any;
}

export interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  result?: any;
  error?: ExecutionError;
  startTime: Date;
  endTime?: Date;
  logs?: ExecutionLog[];
  metrics?: ExecutionMetrics;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ExecutionError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  engineError?: any;
}

export interface ExecutionLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

export interface ExecutionMetrics {
  duration?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkCalls?: number;
  customMetrics?: Record<string, number>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface CancellationResult {
  success: boolean;
  message?: string;
  error?: string;
}