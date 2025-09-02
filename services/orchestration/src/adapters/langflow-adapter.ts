// Local type definitions - normally would import from shared package
enum EngineType {
  LANGFLOW = 'langflow',
  N8N = 'n8n',
  LANGSMITH = 'langsmith'
}

enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  engineType: EngineType;
  definition: any;
  version?: number;
  metadata?: Record<string, any>;
}

interface WorkflowParameters {
  [key: string]: any;
}

interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  result?: any;
  error?: ExecutionError;
  startTime: Date;
  endTime?: Date;
  logs?: ExecutionLog[];
  metrics?: ExecutionMetrics;
}

interface ExecutionError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  engineError?: any;
}

interface ExecutionLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

interface ExecutionMetrics {
  duration?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkCalls?: number;
  customMetrics?: Record<string, number>;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

interface CancellationResult {
  success: boolean;
  message?: string;
  error?: string;
}
import { BaseEngineAdapter } from './base-adapter';
import { EngineAdapterConfig, EngineCapabilities } from '../interfaces/engine-adapter.interface';

/**
 * Langflow-specific workflow definition structure
 */
interface LangflowWorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  data: {
    nodes: LangflowNode[];
    edges: LangflowEdge[];
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  tweaks?: Record<string, any>;
}

interface LangflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    type: string;
    node: {
      template: Record<string, any>;
      description: string;
      base_classes: string[];
      name: string;
      display_name: string;
    };
  };
}

interface LangflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

/**
 * Langflow execution request structure
 */
interface LangflowExecutionRequest {
  input_value?: string;
  input_type?: string;
  output_type?: string;
  tweaks?: Record<string, any>;
  session_id?: string;
}

/**
 * Langflow execution response structure
 */
interface LangflowExecutionResponse {
  session_id: string;
  outputs: Array<{
    inputs: Record<string, any>;
    outputs: Array<{
      results: Record<string, any>;
      artifacts: Record<string, any>;
      outputs: Record<string, any>;
      logs: {
        message: string;
        type: string;
        timestamp: string;
      }[];
    }>;
  }>;
}

/**
 * Langflow status response structure
 */
interface LangflowStatusResponse {
  status: 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
  logs?: Array<{
    message: string;
    level: string;
    timestamp: string;
  }>;
}

/**
 * Langflow adapter for executing workflows on Langflow instances
 */
export class LangflowAdapter extends BaseEngineAdapter {
  private readonly pollInterval: number = 2000; // 2 seconds
  private readonly maxPollAttempts: number = 300; // 10 minutes max

  constructor(config: EngineAdapterConfig) {
    super(EngineType.LANGFLOW, config);
  }

  /**
   * Validates a Langflow workflow definition
   */
  async validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
    const baseValidation = this.validateCommonWorkflowProperties(workflow);
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: any[] = [];
    const warnings: any[] = [];

    try {
      const langflowDef = workflow.definition as LangflowWorkflowDefinition;

      // Validate Langflow-specific structure
      if (!langflowDef.data) {
        errors.push({
          field: 'definition.data',
          message: 'Langflow workflow must have a data property',
          code: 'MISSING_DATA'
        });
      } else {
        // Validate nodes
        if (!Array.isArray(langflowDef.data.nodes)) {
          errors.push({
            field: 'definition.data.nodes',
            message: 'Langflow workflow must have nodes array',
            code: 'MISSING_NODES'
          });
        } else if (langflowDef.data.nodes.length === 0) {
          warnings.push({
            field: 'definition.data.nodes',
            message: 'Workflow has no nodes',
            code: 'EMPTY_WORKFLOW'
          });
        }

        // Validate edges
        if (!Array.isArray(langflowDef.data.edges)) {
          errors.push({
            field: 'definition.data.edges',
            message: 'Langflow workflow must have edges array',
            code: 'MISSING_EDGES'
          });
        }

        // Validate node structure
        if (langflowDef.data.nodes) {
          langflowDef.data.nodes.forEach((node, index) => {
            if (!node.id) {
              errors.push({
                field: `definition.data.nodes[${index}].id`,
                message: 'Node must have an id',
                code: 'MISSING_NODE_ID'
              });
            }
            if (!node.type) {
              errors.push({
                field: `definition.data.nodes[${index}].type`,
                message: 'Node must have a type',
                code: 'MISSING_NODE_TYPE'
              });
            }
            if (!node.data?.type) {
              errors.push({
                field: `definition.data.nodes[${index}].data.type`,
                message: 'Node must have data.type',
                code: 'MISSING_NODE_DATA_TYPE'
              });
            }
          });
        }
      }

      // Validate against Langflow API if possible
      if (errors.length === 0) {
        try {
          await this.executeWithRetry(async () => {
            const response = await this.httpClient.post('/api/v1/validate', {
              flow: langflowDef
            });
            return response.data;
          }, 'workflow validation');
        } catch (error) {
          warnings.push({
            field: 'definition',
            message: 'Could not validate against Langflow API',
            code: 'API_VALIDATION_FAILED'
          });
        }
      }

    } catch (error) {
      errors.push({
        field: 'definition',
        message: 'Invalid Langflow workflow structure',
        code: 'INVALID_STRUCTURE'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: [...baseValidation.errors, ...errors],
      warnings: [...baseValidation.warnings, ...warnings]
    };
  }

  /**
   * Executes a Langflow workflow
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    parameters: WorkflowParameters
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    this.logExecutionStart(workflow, parameters);

    try {
      const langflowDef = workflow.definition as LangflowWorkflowDefinition;
      
      // Prepare execution request
      const executionRequest: LangflowExecutionRequest = {
        input_value: parameters.input_value || '',
        input_type: parameters.input_type || 'chat',
        output_type: parameters.output_type || 'chat',
        tweaks: {
          ...langflowDef.tweaks,
          ...parameters.tweaks
        },
        session_id: executionId
      };

      // Start execution
      const executionResult = await this.executeWithRetry(async () => {
        const response = await this.httpClient.post(
          `/api/v1/run/${workflow.id || workflow.name}`,
          executionRequest
        );
        return response.data as LangflowExecutionResponse;
      }, 'workflow execution');

      // Create initial result
      const result = this.createExecutionResult(
        executionId,
        ExecutionStatus.RUNNING,
        undefined,
        undefined,
        new Date()
      );

      // Poll for completion
      const finalResult = await this.pollForCompletion(executionId, result);
      
      this.logExecutionComplete(finalResult);
      return finalResult;

    } catch (error) {
      const executionError = this.transformError(error);
      const result = this.createExecutionResult(
        executionId,
        ExecutionStatus.FAILED,
        undefined,
        executionError,
        new Date(),
        new Date()
      );
      
      this.logExecutionError(executionId, executionError);
      return result;
    }
  }

  /**
   * Gets execution logs for a specific execution
   */
  async getExecutionLogs(executionId: string): Promise<ExecutionLog[]> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.httpClient.get(`/api/v1/logs/${executionId}`);
      }, 'get execution logs');

      const langflowLogs = response.data.logs || [];
      
      return langflowLogs.map((log: any) => ({
        timestamp: new Date(log.timestamp),
        level: this.mapLogLevel(log.level || log.type),
        message: log.message,
        context: {
          sessionId: executionId,
          nodeId: log.node_id,
          component: log.component
        }
      }));

    } catch (error) {
      this.logger.error('Failed to get execution logs', { executionId, error });
      return [];
    }
  }

  /**
   * Cancels a running execution
   */
  async cancelExecution(executionId: string): Promise<CancellationResult> {
    try {
      await this.executeWithRetry(async () => {
        return await this.httpClient.post(`/api/v1/cancel/${executionId}`);
      }, 'cancel execution');

      return {
        success: true,
        message: 'Execution cancelled successfully'
      };

    } catch (error) {
      this.logger.error('Failed to cancel execution', { executionId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets the current status of an execution
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionResult> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.httpClient.get(`/api/v1/status/${executionId}`);
      }, 'get execution status');

      const statusData = response.data as LangflowStatusResponse;
      
      return this.createExecutionResult(
        executionId,
        this.mapExecutionStatus(statusData.status),
        statusData.result,
        statusData.error ? { 
          code: 'LANGFLOW_ERROR', 
          message: statusData.error 
        } : undefined,
        undefined,
        statusData.status === 'completed' || statusData.status === 'error' 
          ? new Date() 
          : undefined
      );

    } catch (error) {
      return this.createExecutionResult(
        executionId,
        ExecutionStatus.FAILED,
        undefined,
        this.transformError(error),
        undefined,
        new Date()
      );
    }
  }

  /**
   * Converts workflow from another engine format to Langflow format
   */
  async convertWorkflow(
    workflow: WorkflowDefinition,
    sourceEngine: EngineType
  ): Promise<WorkflowDefinition> {
    // This is a complex operation that would require understanding
    // the source engine format and mapping it to Langflow format
    // For now, we'll throw an error indicating it's not implemented
    throw new Error(`Conversion from ${sourceEngine} to Langflow is not yet implemented`);
  }

  /**
   * Gets Langflow engine capabilities
   */
  async getCapabilities(): Promise<EngineCapabilities> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.httpClient.get('/api/v1/version');
      }, 'get capabilities');

      const versionData = response.data;
      
      // Get available components
      const componentsResponse = await this.executeWithRetry(async () => {
        return await this.httpClient.get('/api/v1/all');
      }, 'get components');

      const components = componentsResponse.data;
      const supportedNodeTypes = Object.keys(components || {});

      return {
        version: versionData.version || '1.0.0',
        supportedFeatures: [
          'workflow_execution',
          'real_time_logs',
          'session_management',
          'custom_components',
          'tweaks_support'
        ],
        maxConcurrentExecutions: 10, // Default limit
        supportedNodeTypes,
        customProperties: {
          supportsStreaming: true,
          supportsCustomComponents: true,
          supportsTweaks: true,
          apiVersion: 'v1'
        }
      };

    } catch (error) {
      this.logger.error('Failed to get capabilities', { error });
      
      // Return default capabilities
      return {
        version: 'unknown',
        supportedFeatures: ['workflow_execution'],
        maxConcurrentExecutions: 1,
        supportedNodeTypes: [],
        customProperties: {}
      };
    }
  }

  /**
   * Polls for execution completion
   */
  private async pollForCompletion(
    executionId: string,
    initialResult: ExecutionResult
  ): Promise<ExecutionResult> {
    let attempts = 0;
    
    while (attempts < this.maxPollAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        
        const status = await this.getExecutionStatus(executionId);
        
        if (status.status === ExecutionStatus.COMPLETED || 
            status.status === ExecutionStatus.FAILED ||
            status.status === ExecutionStatus.CANCELLED) {
          
          // Get final logs
          const logs = await this.getExecutionLogs(executionId);
          status.logs = logs;
          
          return status;
        }
        
        attempts++;
        
      } catch (error) {
        this.logger.warn('Error during status polling', { 
          executionId, 
          attempt: attempts, 
          error 
        });
        attempts++;
      }
    }

    // Timeout reached
    return this.createExecutionResult(
      executionId,
      ExecutionStatus.FAILED,
      undefined,
      {
        code: 'EXECUTION_TIMEOUT',
        message: 'Execution timed out while polling for completion'
      },
      initialResult.startTime,
      new Date()
    );
  }

  /**
   * Maps Langflow status to ExecutionStatus
   */
  private mapExecutionStatus(langflowStatus: string): ExecutionStatus {
    switch (langflowStatus) {
      case 'running':
        return ExecutionStatus.RUNNING;
      case 'completed':
        return ExecutionStatus.COMPLETED;
      case 'error':
        return ExecutionStatus.FAILED;
      default:
        return ExecutionStatus.PENDING;
    }
  }

  /**
   * Maps Langflow log level to standard log level
   */
  private mapLogLevel(langflowLevel: string): 'debug' | 'info' | 'warn' | 'error' {
    switch (langflowLevel.toLowerCase()) {
      case 'debug':
        return 'debug';
      case 'info':
      case 'message':
        return 'info';
      case 'warning':
      case 'warn':
        return 'warn';
      case 'error':
      case 'exception':
        return 'error';
      default:
        return 'info';
    }
  }

  /**
   * Transforms various error types into ExecutionError
   */
  private transformError(error: any): ExecutionError {
    if (error.response?.data?.error) {
      return {
        code: 'LANGFLOW_API_ERROR',
        message: error.response.data.error,
        details: error.response.data,
        engineError: error.response.data
      };
    }

    if (error.code) {
      return {
        code: error.code,
        message: error.message || 'Unknown error',
        details: error.details,
        stack: error.stack
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      stack: error.stack
    };
  }
}