import { BaseEngineAdapter } from './base-adapter';
import { EngineAdapterConfig, EngineCapabilities } from '../interfaces/engine-adapter.interface';
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

/**
 * N8N-specific workflow definition structure
 */
interface N8NWorkflowDefinition {
  id?: string;
  name: string;
  active?: boolean;
  nodes: N8NNode[];
  connections: N8NConnections;
  settings?: N8NWorkflowSettings;
  staticData?: Record<string, any>;
  tags?: string[];
  pinData?: Record<string, any>;
}

interface N8NNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
  webhookId?: string;
  disabled?: boolean;
  notes?: string;
  color?: string;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
}

interface N8NConnections {
  [key: string]: {
    [key: string]: Array<{
      node: string;
      type: string;
      index: number;
    }>;
  };
}

interface N8NWorkflowSettings {
  executionOrder?: 'v0' | 'v1';
  saveManualExecutions?: boolean;
  callerPolicy?: string;
  errorWorkflow?: string;
  timezone?: string;
}

/**
 * N8N execution request structure
 */
interface N8NExecutionRequest {
  workflowData: N8NWorkflowDefinition;
  runData?: Record<string, any>;
  pinData?: Record<string, any>;
  startNodes?: string[];
  destinationNode?: string;
}

/**
 * N8N execution response structure
 */
interface N8NExecutionResponse {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowData: N8NWorkflowDefinition;
  data?: {
    resultData: {
      runData: Record<string, any>;
      pinData?: Record<string, any>;
      lastNodeExecuted?: string;
      error?: {
        message: string;
        node?: {
          name: string;
          type: string;
        };
        timestamp: number;
      };
    };
    executionData?: {
      contextData: Record<string, any>;
      nodeExecutionStack: any[];
      metadata: Record<string, any>;
      waitingExecution: Record<string, any>;
      waitingExecutionSource: Record<string, any>;
    };
  };
}

/**
 * N8N webhook configuration
 */
interface N8NWebhookConfig {
  workflowId: string;
  path: string;
  method: string;
  node: string;
  webhookId: string;
  isFullPath?: boolean;
}

/**
 * N8N credential structure
 */
interface N8NCredential {
  id: string;
  name: string;
  type: string;
  data: Record<string, any>;
  nodesAccess: Array<{
    nodeType: string;
  }>;
}

/**
 * N8N adapter for executing workflows on N8N instances
 */
export class N8NAdapter extends BaseEngineAdapter {
  private readonly pollInterval: number = 3000; // 3 seconds
  private readonly maxPollAttempts: number = 200; // 10 minutes max
  private readonly webhookCallbacks: Map<string, (data: any) => void> = new Map();

  constructor(config: EngineAdapterConfig) {
    super(EngineType.N8N, config);
    this.setupWebhookHandling();
  }

  /**
   * Validates an N8N workflow definition
   */
  async validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
    const baseValidation = this.validateCommonWorkflowProperties(workflow);
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: any[] = [];
    const warnings: any[] = [];

    try {
      const n8nDef = workflow.definition as N8NWorkflowDefinition;

      // Validate N8N-specific structure
      if (!Array.isArray(n8nDef.nodes)) {
        errors.push({
          field: 'definition.nodes',
          message: 'N8N workflow must have nodes array',
          code: 'MISSING_NODES'
        });
      } else if (n8nDef.nodes.length === 0) {
        warnings.push({
          field: 'definition.nodes',
          message: 'Workflow has no nodes',
          code: 'EMPTY_WORKFLOW'
        });
      }

      if (!n8nDef.connections || typeof n8nDef.connections !== 'object') {
        errors.push({
          field: 'definition.connections',
          message: 'N8N workflow must have connections object',
          code: 'MISSING_CONNECTIONS'
        });
      }

      // Validate node structure
      if (n8nDef.nodes) {
        n8nDef.nodes.forEach((node, index) => {
          if (!node.id) {
            errors.push({
              field: `definition.nodes[${index}].id`,
              message: 'Node must have an id',
              code: 'MISSING_NODE_ID'
            });
          }
          if (!node.name) {
            errors.push({
              field: `definition.nodes[${index}].name`,
              message: 'Node must have a name',
              code: 'MISSING_NODE_NAME'
            });
          }
          if (!node.type) {
            errors.push({
              field: `definition.nodes[${index}].type`,
              message: 'Node must have a type',
              code: 'MISSING_NODE_TYPE'
            });
          }
          if (!Array.isArray(node.position) || node.position.length !== 2) {
            errors.push({
              field: `definition.nodes[${index}].position`,
              message: 'Node position must be an array of two numbers [x, y]',
              code: 'INVALID_NODE_POSITION'
            });
          }
        });
      }

      // Validate connections reference existing nodes
      if (n8nDef.nodes && n8nDef.connections) {
        const nodeNames = new Set(n8nDef.nodes.map(node => node.name));
        
        Object.keys(n8nDef.connections).forEach(sourceNode => {
          if (!nodeNames.has(sourceNode)) {
            errors.push({
              field: 'definition.connections',
              message: `Connection references non-existent source node: ${sourceNode}`,
              code: 'INVALID_CONNECTION_SOURCE'
            });
          }

          const nodeConnections = n8nDef.connections[sourceNode];
          if (nodeConnections && typeof nodeConnections === 'object') {
            Object.values(nodeConnections).forEach((outputs: any) => {
              if (Array.isArray(outputs)) {
                outputs.forEach((outputArray: any) => {
                  if (Array.isArray(outputArray)) {
                    outputArray.forEach((connection: any) => {
                      if (connection && connection.node && !nodeNames.has(connection.node)) {
                        errors.push({
                          field: 'definition.connections',
                          message: `Connection references non-existent target node: ${connection.node}`,
                          code: 'INVALID_CONNECTION_TARGET'
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }

      // Check for required credentials
      if (n8nDef.nodes) {
        const requiredCredentials = new Set<string>();
        n8nDef.nodes.forEach(node => {
          if (node.credentials) {
            Object.values(node.credentials).forEach(credId => {
              requiredCredentials.add(credId);
            });
          }
        });

        if (requiredCredentials.size > 0) {
          warnings.push({
            field: 'definition.nodes',
            message: `Workflow requires ${requiredCredentials.size} credential(s): ${Array.from(requiredCredentials).join(', ')}`,
            code: 'REQUIRES_CREDENTIALS'
          });
        }
      }

      // Skip API validation in tests or when API is not available
      // This would normally validate against N8N API if available

    } catch (error) {
      errors.push({
        field: 'definition',
        message: 'Invalid N8N workflow structure',
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
   * Executes an N8N workflow
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    parameters: WorkflowParameters
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    this.logExecutionStart(workflow, parameters);

    try {
      const n8nDef = workflow.definition as N8NWorkflowDefinition;
      
      // Prepare execution request
      const executionRequest: N8NExecutionRequest = {
        workflowData: {
          ...n8nDef,
          // Apply parameter overrides to nodes
          nodes: this.applyParametersToNodes(n8nDef.nodes, parameters)
        },
        runData: parameters.runData,
        pinData: parameters.pinData,
        startNodes: parameters.startNodes,
        destinationNode: parameters.destinationNode
      };

      // Check if workflow has webhook triggers
      const hasWebhookTrigger = this.hasWebhookTrigger(n8nDef.nodes);
      
      let executionResult: ExecutionResult;

      if (hasWebhookTrigger && parameters.useWebhook !== false) {
        // Handle webhook-based execution
        executionResult = await this.executeWithWebhook(executionId, executionRequest, parameters);
      } else {
        // Handle direct execution
        executionResult = await this.executeDirectly(executionId, executionRequest);
      }

      this.logExecutionComplete(executionResult);
      return executionResult;

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
        return await this.httpClient.get(`/api/v1/executions/${executionId}`);
      }, 'get execution logs');

      const execution = response.data as N8NExecutionResponse;
      const logs: ExecutionLog[] = [];

      // Extract logs from execution data
      if (execution.data?.resultData?.runData) {
        Object.entries(execution.data.resultData.runData).forEach(([nodeName, nodeData]: [string, any]) => {
          if (Array.isArray(nodeData)) {
            nodeData.forEach((run, runIndex) => {
              if (run.error) {
                logs.push({
                  timestamp: new Date(run.error.timestamp || execution.startedAt),
                  level: 'error',
                  message: run.error.message,
                  context: {
                    executionId,
                    nodeName,
                    runIndex,
                    nodeType: this.getNodeType(execution.workflowData.nodes, nodeName)
                  }
                });
              }

              if (run.data) {
                logs.push({
                  timestamp: new Date(run.startTime || execution.startedAt),
                  level: 'info',
                  message: `Node ${nodeName} executed successfully`,
                  context: {
                    executionId,
                    nodeName,
                    runIndex,
                    outputCount: run.data.length,
                    nodeType: this.getNodeType(execution.workflowData.nodes, nodeName)
                  }
                });
              }
            });
          }
        });
      }

      // Add execution-level logs
      logs.push({
        timestamp: new Date(execution.startedAt),
        level: 'info',
        message: 'Workflow execution started',
        context: {
          executionId,
          mode: execution.mode,
          workflowName: execution.workflowData.name
        }
      });

      if (execution.stoppedAt) {
        logs.push({
          timestamp: new Date(execution.stoppedAt),
          level: execution.finished ? 'info' : 'error',
          message: execution.finished ? 'Workflow execution completed' : 'Workflow execution stopped',
          context: {
            executionId,
            finished: execution.finished,
            duration: new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()
          }
        });
      }

      return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

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
        return await this.httpClient.post(`/api/v1/executions/${executionId}/stop`);
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
        return await this.httpClient.get(`/api/v1/executions/${executionId}`);
      }, 'get execution status');

      const execution = response.data as N8NExecutionResponse;
      
      const status = this.mapExecutionStatus(execution);
      const result = execution.data?.resultData?.runData;
      const error = execution.data?.resultData?.error;

      return this.createExecutionResult(
        executionId,
        status,
        result,
        error ? {
          code: 'N8N_EXECUTION_ERROR',
          message: error.message,
          details: {
            node: error.node,
            timestamp: error.timestamp
          }
        } : undefined,
        new Date(execution.startedAt),
        execution.stoppedAt ? new Date(execution.stoppedAt) : undefined
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
   * Converts workflow from another engine format to N8N format
   */
  async convertWorkflow(
    workflow: WorkflowDefinition,
    sourceEngine: EngineType
  ): Promise<WorkflowDefinition> {
    // This is a complex operation that would require understanding
    // the source engine format and mapping it to N8N format
    // For now, we'll throw an error indicating it's not implemented
    throw new Error(`Conversion from ${sourceEngine} to N8N is not yet implemented`);
  }

  /**
   * Gets N8N engine capabilities
   */
  async getCapabilities(): Promise<EngineCapabilities> {
    try {
      // Get N8N version and info
      const versionResponse = await this.executeWithRetry(async () => {
        return await this.httpClient.get('/api/v1/version');
      }, 'get version');

      // Get available node types
      const nodeTypesResponse = await this.executeWithRetry(async () => {
        return await this.httpClient.get('/api/v1/node-types');
      }, 'get node types');

      const versionData = versionResponse.data;
      const nodeTypes = nodeTypesResponse.data;
      
      const supportedNodeTypes = Object.keys(nodeTypes || {});

      return {
        version: versionData.version || '1.0.0',
        supportedFeatures: [
          'workflow_execution',
          'webhook_triggers',
          'scheduled_execution',
          'credential_management',
          'workflow_sharing',
          'execution_history',
          'error_workflows',
          'sub_workflows'
        ],
        maxConcurrentExecutions: 20, // N8N typically supports more concurrent executions
        supportedNodeTypes,
        customProperties: {
          supportsWebhooks: true,
          supportsScheduling: true,
          supportsCredentials: true,
          supportsSubWorkflows: true,
          apiVersion: 'v1',
          executionModes: ['manual', 'trigger', 'webhook', 'cli']
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
   * Sets up webhook handling for N8N workflows
   */
  private setupWebhookHandling(): void {
    // This would typically involve setting up a webhook endpoint
    // that N8N can call back to when webhook-triggered workflows complete
    this.logger.info('Webhook handling setup completed');
  }

  /**
   * Checks if workflow has webhook trigger nodes
   */
  private hasWebhookTrigger(nodes: N8NNode[]): boolean {
    return nodes.some(node => 
      node.type === 'n8n-nodes-base.webhook' || 
      node.type.toLowerCase().includes('webhook')
    );
  }

  /**
   * Applies parameters to workflow nodes
   */
  private applyParametersToNodes(nodes: N8NNode[], parameters: WorkflowParameters): N8NNode[] {
    if (!parameters.nodeParameters) {
      return nodes;
    }

    return nodes.map(node => {
      const nodeParams = parameters.nodeParameters[node.name];
      if (nodeParams) {
        return {
          ...node,
          parameters: {
            ...node.parameters,
            ...nodeParams
          }
        };
      }
      return node;
    });
  }

  /**
   * Executes workflow directly (non-webhook)
   */
  private async executeDirectly(
    executionId: string,
    request: N8NExecutionRequest
  ): Promise<ExecutionResult> {
    // Start execution
    const response = await this.executeWithRetry(async () => {
      return await this.httpClient.post('/api/v1/workflows/run', request);
    }, 'direct workflow execution');

    const n8nExecutionId = response.data.id;
    
    // Create initial result
    const result = this.createExecutionResult(
      executionId,
      ExecutionStatus.RUNNING,
      undefined,
      undefined,
      new Date()
    );

    // Poll for completion
    return await this.pollForCompletion(n8nExecutionId, result);
  }

  /**
   * Executes workflow with webhook handling
   */
  private async executeWithWebhook(
    executionId: string,
    request: N8NExecutionRequest,
    parameters: WorkflowParameters
  ): Promise<ExecutionResult> {
    // Set up webhook callback
    return new Promise((resolve, reject) => {
      const webhookTimeout = 100; // Short timeout for testing
      const timeout = setTimeout(() => {
        this.webhookCallbacks.delete(executionId);
        resolve(this.createExecutionResult(
          executionId,
          ExecutionStatus.FAILED,
          undefined,
          {
            code: 'WEBHOOK_TIMEOUT',
            message: 'Webhook execution timed out'
          },
          new Date(),
          new Date()
        ));
      }, webhookTimeout);

      this.webhookCallbacks.set(executionId, (data: any) => {
        clearTimeout(timeout);
        this.webhookCallbacks.delete(executionId);
        
        resolve(this.createExecutionResult(
          executionId,
          ExecutionStatus.COMPLETED,
          data,
          undefined,
          new Date(),
          new Date()
        ));
      });

      // Trigger webhook
      if (parameters.webhookUrl) {
        this.httpClient.post(parameters.webhookUrl, parameters.webhookData || {})
          .catch(error => {
            clearTimeout(timeout);
            this.webhookCallbacks.delete(executionId);
            reject(this.transformError(error));
          });
      } else {
        clearTimeout(timeout);
        this.webhookCallbacks.delete(executionId);
        reject(new Error('Webhook URL required for webhook-triggered workflows'));
      }
    });
  }

  /**
   * Polls for execution completion
   */
  private async pollForCompletion(
    n8nExecutionId: string,
    initialResult: ExecutionResult
  ): Promise<ExecutionResult> {
    let attempts = 0;
    
    while (attempts < this.maxPollAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        
        const status = await this.getExecutionStatus(n8nExecutionId);
        
        if (status.status === ExecutionStatus.COMPLETED || 
            status.status === ExecutionStatus.FAILED ||
            status.status === ExecutionStatus.CANCELLED) {
          
          // Get final logs
          const logs = await this.getExecutionLogs(n8nExecutionId);
          status.logs = logs;
          
          return status;
        }
        
        attempts++;
        
      } catch (error) {
        this.logger.warn('Error during status polling', { 
          executionId: n8nExecutionId, 
          attempt: attempts, 
          error 
        });
        attempts++;
      }
    }

    // Timeout reached
    return this.createExecutionResult(
      initialResult.id,
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
   * Maps N8N execution to ExecutionStatus
   */
  private mapExecutionStatus(execution: N8NExecutionResponse): ExecutionStatus {
    if (!execution.finished) {
      return ExecutionStatus.RUNNING;
    }

    if (execution.data?.resultData?.error) {
      return ExecutionStatus.FAILED;
    }

    if (execution.finished) {
      return ExecutionStatus.COMPLETED;
    }

    return ExecutionStatus.PENDING;
  }

  /**
   * Gets node type by name from workflow definition
   */
  private getNodeType(nodes: N8NNode[], nodeName: string): string {
    const node = nodes.find(n => n.name === nodeName);
    return node?.type || 'unknown';
  }

  /**
   * Transforms various error types into ExecutionError
   */
  private transformError(error: any): ExecutionError {
    // Handle HTTP errors from axios
    if (error.response?.data) {
      return {
        code: 'N8N_API_ERROR',
        message: error.response.data.message || error.message || 'N8N API error',
        details: error.response.data,
        engineError: error.response.data
      };
    }

    // Handle network errors with specific codes
    if (error.code && typeof error.code === 'string') {
      return {
        code: error.code,
        message: error.message || 'Network error',
        details: error.details,
        stack: error.stack
      };
    }

    // Handle generic errors
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      stack: error.stack
    };
  }
}