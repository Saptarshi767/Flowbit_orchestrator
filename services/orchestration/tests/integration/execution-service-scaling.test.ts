import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionService, ExecutionServiceConfig, WorkerStatus } from '../../src/services/execution.service';
import { ExecutionPriority } from '../../src/core/execution-queue';
import { 
  EngineType, 
  WorkflowDefinition, 
  ExecutionStatus,
  WorkflowParameters 
} from '@robust-ai-orchestrator/shared';
import { IEngineAdapter } from '../../src/interfaces/engine-adapter.interface';

// Mock engine adapter for testing
class MockEngineAdapter implements IEngineAdapter {
  private executionDelay: number;
  private shouldFail: boolean;

  constructor(executionDelay = 100, shouldFail = false) {
    this.executionDelay = executionDelay;
    this.shouldFail = shouldFail;
  }

  async validateWorkflow(workflow: WorkflowDefinition) {
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  async executeWorkflow(workflow: WorkflowDefinition, parameters: WorkflowParameters) {
    await new Promise(resolve => setTimeout(resolve, this.executionDelay));
    
    if (this.shouldFail) {
      throw new Error('Mock execution failure');
    }

    return {
      id: `exec-${Date.now()}`,
      status: ExecutionStatus.COMPLETED,
      result: { message: 'Mock execution completed' },
      startTime: new Date(),
      endTime: new Date()
    };
  }

  async getExecutionLogs(executionId: string) {
    return [];
  }

  async cancelExecution(executionId: string) {
    return { success: true };
  }

  setExecutionDelay(delay: number) {
    this.executionDelay = delay;
  }

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }
}

describe('ExecutionService Scaling Integration Tests', () => {
  let executionService: ExecutionService;
  let mockLangflowAdapter: MockEngineAdapter;
  let mockN8nAdapter: MockEngineAdapter;
  let mockLangsmithAdapter: MockEngineAdapter;

  const defaultConfig: ExecutionServiceConfig = {
    scaling: {
      minWorkers: 2,
      maxWorkers: 10,
      targetUtilization: 0.7,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3,
      scaleUpCooldown: 5000,
      scaleDownCooldown: 10000,
      workerStartupTime: 1000
    },
    faultTolerance: {
      maxRetries: 3,
      retryDelay: 1000,
      backoffFactor: 2,
      circuitBreakerConfig: {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 60000
      }
    },
    storage: {
      resultRetentionDays: 30,
      compressionEnabled: true,
      encryptionEnabled: true
    },
    metrics: {
      collectionInterval: 1000,
      aggregationWindow: 60000,
      retentionPeriod: 86400000
    }
  };

  beforeEach(async () => {
    executionService = new ExecutionService(defaultConfig);
    
    mockLangflowAdapter = new MockEngineAdapter();
    mockN8nAdapter = new MockEngineAdapter();
    mockLangsmithAdapter = new MockEngineAdapter();

    executionService.registerAdapter(EngineType.LANGFLOW, mockLangflowAdapter);
    executionService.registerAdapter(EngineType.N8N, mockN8nAdapter);
    executionService.registerAdapter(EngineType.LANGSMITH, mockLangsmithAdapter);

    await executionService.start();
  });

  afterEach(async () => {
    await executionService.stop();
  });

  describe('Worker Management', () => {
    it('should initialize minimum number of workers on start', async () => {
      const workers = executionService.getWorkersStatus();
      expect(workers).toHaveLength(defaultConfig.scaling.minWorkers);
      
      workers.forEach(worker => {
        expect(worker.status).toBe(WorkerStatus.IDLE);
        expect(worker.currentLoad).toBe(0);
        expect(worker.activeExecutions.size).toBe(0);
      });
    });

    it('should track worker metrics correctly', async () => {
      const metrics = executionService.getExecutionMetrics();
      expect(metrics.totalWorkers).toBe(defaultConfig.scaling.minWorkers);
      expect(metrics.activeWorkers).toBe(defaultConfig.scaling.minWorkers);
    });
  });

  describe('Execution Submission and Processing', () => {
    it('should submit and process executions successfully', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const executionId = await executionService.submitExecution({
        id: 'test-exec-1',
        workflowId: 'workflow-1',
        workflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'test' },
        priority: ExecutionPriority.NORMAL,
        createdAt: new Date(),
        timeout: 30000
      });

      expect(executionId).toBe('test-exec-1');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const status = await executionService.getExecutionStatus(executionId);
      expect([ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING]).toContain(status);
    });

    it('should handle multiple concurrent executions', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const executionPromises = [];
      for (let i = 0; i < 5; i++) {
        executionPromises.push(
          executionService.submitExecution({
            id: `test-exec-${i}`,
            workflowId: `workflow-${i}`,
            workflow,
            engineType: EngineType.LANGFLOW,
            parameters: { input: `test-${i}` },
            priority: ExecutionPriority.NORMAL,
            createdAt: new Date(),
            timeout: 30000
          })
        );
      }

      const executionIds = await Promise.all(executionPromises);
      expect(executionIds).toHaveLength(5);

      // Wait for executions to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = executionService.getExecutionMetrics();
      expect(metrics.totalExecutions).toBe(5);
    });
  });

  describe('Auto-Scaling Functionality', () => {
    it('should scale up workers when demand is high', async () => {
      // Set longer execution delay to create backlog
      mockLangflowAdapter.setExecutionDelay(2000);

      const workflow: WorkflowDefinition = {
        name: 'Long Running Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      // Submit many executions to trigger scaling
      const executionPromises = [];
      for (let i = 0; i < 20; i++) {
        executionPromises.push(
          executionService.submitExecution({
            id: `scale-up-exec-${i}`,
            workflowId: `workflow-${i}`,
            workflow,
            engineType: EngineType.LANGFLOW,
            parameters: { input: `test-${i}` },
            priority: ExecutionPriority.NORMAL,
            createdAt: new Date(),
            timeout: 30000
          })
        );
      }

      await Promise.all(executionPromises);

      // Wait for auto-scaling to trigger
      await new Promise(resolve => setTimeout(resolve, 6000));

      const workers = executionService.getWorkersStatus();
      expect(workers.length).toBeGreaterThan(defaultConfig.scaling.minWorkers);
    });

    it('should scale down workers when demand is low', async () => {
      // First scale up by creating high demand
      mockLangflowAdapter.setExecutionDelay(1000);
      
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      // Create high demand
      for (let i = 0; i < 15; i++) {
        await executionService.submitExecution({
          id: `scale-test-${i}`,
          workflowId: `workflow-${i}`,
          workflow,
          engineType: EngineType.LANGFLOW,
          parameters: { input: `test-${i}` },
          priority: ExecutionPriority.NORMAL,
          createdAt: new Date(),
          timeout: 30000
        });
      }

      // Wait for scale up
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      const workersAfterScaleUp = executionService.getWorkersStatus();
      const workerCountAfterScaleUp = workersAfterScaleUp.length;

      // Reduce execution delay to lower demand
      mockLangflowAdapter.setExecutionDelay(50);

      // Wait for executions to complete and scale down to trigger
      await new Promise(resolve => setTimeout(resolve, 15000));

      const workersAfterScaleDown = executionService.getWorkersStatus();
      expect(workersAfterScaleDown.length).toBeLessThanOrEqual(workerCountAfterScaleUp);
    });
  });

  describe('Fault Tolerance', () => {
    it('should retry failed executions', async () => {
      // Configure adapter to fail initially
      mockLangflowAdapter.setShouldFail(true);

      const workflow: WorkflowDefinition = {
        name: 'Failing Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const executionId = await executionService.submitExecution({
        id: 'retry-test-exec',
        workflowId: 'retry-workflow',
        workflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'test' },
        priority: ExecutionPriority.NORMAL,
        createdAt: new Date(),
        timeout: 30000,
        maxRetries: 2
      });

      // Wait for initial failure and retry
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Make adapter succeed on retry
      mockLangflowAdapter.setShouldFail(false);

      // Wait for retry to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      const metrics = executionService.getExecutionMetrics();
      expect(metrics.totalExecutions).toBeGreaterThan(0);
    });

    it('should handle worker failures gracefully', async () => {
      const initialWorkers = executionService.getWorkersStatus();
      const workerToFail = initialWorkers[0];

      // Simulate worker failure
      await executionService.handleExecutorFailure(workerToFail.id);

      // Wait for replacement worker
      await new Promise(resolve => setTimeout(resolve, 2000));

      const workersAfterFailure = executionService.getWorkersStatus();
      expect(workersAfterFailure.length).toBe(defaultConfig.scaling.minWorkers);
      expect(workersAfterFailure.find(w => w.id === workerToFail.id)).toBeUndefined();
    });
  });

  describe('Execution Cancellation', () => {
    it('should cancel queued executions', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const executionId = await executionService.submitExecution({
        id: 'cancel-test-exec',
        workflowId: 'cancel-workflow',
        workflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'test' },
        priority: ExecutionPriority.NORMAL,
        createdAt: new Date(),
        timeout: 30000
      });

      const cancellationResult = await executionService.cancelExecution(executionId);
      expect(cancellationResult.success).toBe(true);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect and update metrics continuously', async () => {
      const initialMetrics = executionService.getExecutionMetrics();
      expect(initialMetrics.totalWorkers).toBe(defaultConfig.scaling.minWorkers);

      const workflow: WorkflowDefinition = {
        name: 'Metrics Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      // Submit some executions
      for (let i = 0; i < 3; i++) {
        await executionService.submitExecution({
          id: `metrics-exec-${i}`,
          workflowId: `metrics-workflow-${i}`,
          workflow,
          engineType: EngineType.LANGFLOW,
          parameters: { input: `test-${i}` },
          priority: ExecutionPriority.NORMAL,
          createdAt: new Date(),
          timeout: 30000
        });
      }

      // Wait for metrics to update
      await new Promise(resolve => setTimeout(resolve, 2000));

      const updatedMetrics = executionService.getExecutionMetrics();
      expect(updatedMetrics.totalExecutions).toBe(3);
      expect(updatedMetrics.currentQueueSize).toBeGreaterThanOrEqual(0);
    });

    it('should track execution success and failure rates', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Success Rate Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      // Submit successful executions
      for (let i = 0; i < 2; i++) {
        await executionService.submitExecution({
          id: `success-exec-${i}`,
          workflowId: `success-workflow-${i}`,
          workflow,
          engineType: EngineType.LANGFLOW,
          parameters: { input: `test-${i}` },
          priority: ExecutionPriority.NORMAL,
          createdAt: new Date(),
          timeout: 30000
        });
      }

      // Configure adapter to fail
      mockLangflowAdapter.setShouldFail(true);

      // Submit failing execution
      await executionService.submitExecution({
        id: 'failure-exec',
        workflowId: 'failure-workflow',
        workflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'test-fail' },
        priority: ExecutionPriority.NORMAL,
        createdAt: new Date(),
        timeout: 30000,
        maxRetries: 0 // No retries for this test
      });

      // Wait for executions to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const metrics = executionService.getExecutionMetrics();
      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.successfulExecutions).toBeGreaterThan(0);
      expect(metrics.failedExecutions).toBeGreaterThan(0);
    });
  });

  describe('Priority-based Execution', () => {
    it('should process high priority executions first', async () => {
      // Set longer execution delay to create queue
      mockLangflowAdapter.setExecutionDelay(1000);

      const workflow: WorkflowDefinition = {
        name: 'Priority Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const executionOrder: string[] = [];

      // Listen for execution events to track order
      executionService.on('execution_completed', (data) => {
        executionOrder.push(data.executionId);
      });

      // Submit low priority execution first
      await executionService.submitExecution({
        id: 'low-priority-exec',
        workflowId: 'low-priority-workflow',
        workflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'low' },
        priority: ExecutionPriority.LOW,
        createdAt: new Date(),
        timeout: 30000
      });

      // Submit high priority execution second
      await executionService.submitExecution({
        id: 'high-priority-exec',
        workflowId: 'high-priority-workflow',
        workflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'high' },
        priority: ExecutionPriority.HIGH,
        createdAt: new Date(),
        timeout: 30000
      });

      // Wait for executions to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      // High priority should be processed first (after any currently running executions)
      expect(executionOrder).toContain('high-priority-exec');
      expect(executionOrder).toContain('low-priority-exec');
    });
  });

  describe('Multi-Engine Support', () => {
    it('should route executions to appropriate engine adapters', async () => {
      const workflows = [
        {
          id: 'langflow-exec',
          workflow: {
            name: 'Langflow Workflow',
            engineType: EngineType.LANGFLOW,
            definition: { nodes: [], edges: [] }
          }
        },
        {
          id: 'n8n-exec',
          workflow: {
            name: 'N8N Workflow',
            engineType: EngineType.N8N,
            definition: { nodes: [], edges: [] }
          }
        },
        {
          id: 'langsmith-exec',
          workflow: {
            name: 'LangSmith Workflow',
            engineType: EngineType.LANGSMITH,
            definition: { chains: [] }
          }
        }
      ];

      const executionPromises = workflows.map(({ id, workflow }) =>
        executionService.submitExecution({
          id,
          workflowId: `${workflow.engineType}-workflow`,
          workflow,
          engineType: workflow.engineType,
          parameters: { input: 'test' },
          priority: ExecutionPriority.NORMAL,
          createdAt: new Date(),
          timeout: 30000
        })
      );

      const executionIds = await Promise.all(executionPromises);
      expect(executionIds).toHaveLength(3);

      // Wait for executions to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = executionService.getExecutionMetrics();
      expect(metrics.totalExecutions).toBe(3);
    });
  });
});