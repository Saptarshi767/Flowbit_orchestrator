import {
  WorkflowDefinition,
  WorkflowParameters,
  ExecutionResult,
  ValidationResult,
  CancellationResult,
  ExecutionLog,
  EngineType
} from '@robust-ai-orchestrator/shared';

/**
 * Base interface for all engine adapters
 * Defines the contract that all engine adapters must implement
 */
export interface IEngineAdapter {
  /**
   * The type of engine this adapter supports
   */
  readonly engineType: EngineType;

  /**
   * Validates a workflow definition for this engine
   * @param workflow - The workflow definition to validate
   * @returns Promise resolving to validation result
   */
  validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult>;

  /**
   * Executes a workflow with the given parameters
   * @param workflow - The workflow definition to execute
   * @param parameters - Parameters to pass to the workflow
   * @returns Promise resolving to execution result
   */
  executeWorkflow(workflow: WorkflowDefinition, parameters: WorkflowParameters): Promise<ExecutionResult>;

  /**
   * Gets the execution logs for a specific execution
   * @param executionId - The ID of the execution
   * @returns Promise resolving to execution logs
   */
  getExecutionLogs(executionId: string): Promise<ExecutionLog[]>;

  /**
   * Cancels a running execution
   * @param executionId - The ID of the execution to cancel
   * @returns Promise resolving to cancellation result
   */
  cancelExecution(executionId: string): Promise<CancellationResult>;

  /**
   * Gets the current status of an execution
   * @param executionId - The ID of the execution
   * @returns Promise resolving to execution result with current status
   */
  getExecutionStatus(executionId: string): Promise<ExecutionResult>;

  /**
   * Converts a workflow from another engine format to this engine's format
   * @param workflow - The workflow to convert
   * @param sourceEngine - The source engine type
   * @returns Promise resolving to converted workflow
   */
  convertWorkflow(workflow: WorkflowDefinition, sourceEngine: EngineType): Promise<WorkflowDefinition>;

  /**
   * Tests the connection to the engine
   * @returns Promise resolving to true if connection is successful
   */
  testConnection(): Promise<boolean>;

  /**
   * Gets engine-specific capabilities and metadata
   * @returns Promise resolving to engine capabilities
   */
  getCapabilities(): Promise<EngineCapabilities>;
}

/**
 * Engine capabilities and metadata
 */
export interface EngineCapabilities {
  version: string;
  supportedFeatures: string[];
  maxConcurrentExecutions: number;
  supportedNodeTypes?: string[];
  customProperties?: Record<string, any>;
}

/**
 * Configuration for engine adapters
 */
export interface EngineAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryConfig: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
  customHeaders?: Record<string, string>;
  customConfig?: Record<string, any>;
}