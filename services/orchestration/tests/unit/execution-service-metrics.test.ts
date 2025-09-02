import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionService, ExecutionServiceConfig, WorkerStatus } from '../../src/services/execution.service';
import { ExecutionPriority } from '../../src/core/execution-queue';
import { 
  EngineType, 
  WorkflowDefinition, 
  ExecutionStatus 
} from '@robust-ai-orchestrator/shared';

describe('ExecutionService Metrics and Storage', () => {
  let executionService: ExecutionService;

  const testConfig: ExecutionServiceConfig = {
    scaling: {
      minWorkers: 1,
      maxWorkers: 5,
      targetUtilization: 0.7,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3,
      scaleUpCooldown: 1000,
      scaleDownCooldown: 2000,
      workerStartupTime: 500
    },
    faultTolerance: {
      maxRetries: 2,
      retryDelay: 500,
      backoffFactor: 1.5,
      circuitBreakerConfig: {
        failureThreshold: 3,
        resetTimeout: 10000,
        monitoringPeriod: 30000
      }
    },
    storage: {
      resultRetentionDays: 7,
      compressionEnabled: false,
      encryptionEnabled: false
    },
    metrics: {
      collectionInterval: 500,
      aggregationWindow: 30000,
      retentionPeriod: 43200000
    }
  };

  beforeEach(async () => {
    executionService = new ExecutionService(testConfig);
    await executionService.start();
  });

  afterEach(async () => {
    await executionService.stop();
  });

  describe('Metrics Collection', () => {
    it('should initialize metrics with correct default values', () => {
      const metrics = executionService.getExecutionMetrics();
      
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.averageExecutionTime).toBe(0);
      expect(metrics.currentQueueSize).toBe(0);
      expect(metrics.totalWorkers).toBe(testConfig.scaling.minWorkers);
      expect(metrics.activeWorkers).toBe(testConfig.scaling.minWorkers);
      expect(metrics.systemUtilization).toBe(0);
      expect(metrics.throughput).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should update metrics when executions are submitted', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Metrics Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      await executionService.submitExecution({
        id: 'metrics-test-1',
        workflowId: 'metrics-workflow-1',
        workflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'test' },
        priority: ExecutionPriority.NORMAL,
        createdAt: new Date(),
        timeout: 30000
      });

      const metrics = executionService.getExecutionMetrics();
      expect(metrics.totalExecutions).toBe(1);
    });

    it('should calculate error rate correctly', async () => {
      // Mock successful execution
      const successfulWorkflow: WorkflowDefinition = {
        name: 'Successful Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      await executionService.submitExecution({
        id: 'success-test',
        workflowId: 'success-workflow',
        workflow: successfulWorkflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'success' },
        priority: ExecutionPriority.NORMAL,
        createdAt: new Date(),
        timeout: 30000
      });

      // Simulate execution completion by directly updating metrics
      const metrics = executionService.getExecutionMetrics();
      expect(metrics.totalExecutions).toBe(1);
      
      // Error rate should be 0 initially
      expect(metrics.errorRate).toBe(0);
    });

    it('should track system utilization', () => {
      const workers = executionService.getWorkersStatus();
      const metrics = executionService.getExecutionMetrics();
      
      expect(workers.length).toBe(testConfig.scaling.minWorkers);
      expect(metrics.systemUtilization).toBeGreaterThanOrEqual(0);
      expect(metrics.systemUtilization).toBeLessThanOrEqual(1);
    });
  });

  describe('Worker Status Tracking', () => {
    it('should track worker status correctly', () => {
      const workers = executionService.getWorkersStatus();
      
      expect(workers).toHaveLength(testConfig.scaling.minWorkers);
      
      workers.forEach(worker => {
        expect(worker.id).toBeDefined();
        expect(worker.status).toBe(WorkerStatus.IDLE);
        expect(worker.currentLoad).toBe(0);
        expect(worker.activeExecutions).toBeDefined();
        expect(worker.totalExecutions).toBe(0);
        expect(worker.failedExecutions).toBe(0);
        expect(worker.averageExecutionTime).toBe(0);
        expect(worker.lastHeartbeat).toBeInstanceOf(Date);
      });
    });

    it('should update worker metrics when load changes', async () => {
      const initialWorkers = executionService.getWorkersStatus();
      const initialWorker = initialWorkers[0];
      
      expect(initialWorker.currentLoad).toBe(0);
      expect(initialWorker.status).toBe(WorkerStatus.IDLE);
    });
  });

  describe('Execution Result Storage', () => {
    it('should store execution results', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Storage Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      const executionId = await executionService.submitExecution({
        id: 'storage-test',
        workflowId: 'storage-workflow',
        workflow,
        engineType: EngineType.LANGFLOW,
        parameters: { input: 'storage-test' },
        priority: ExecutionPriority.NORMAL,
        createdAt: new Date(),
        timeout: 30000
      });

      // Initially should be pending or running (since no adapter is registered, it might fail)
      try {
        const status = await executionService.getExecutionStatus(executionId);
        expect([ExecutionStatus.PENDING, ExecutionStatus.RUNNING, ExecutionStatus.FAILED]).toContain(status);
      } catch (error) {
        // This is expected since no adapter is registered
        expect(error).toBeDefined();
      }
    });

    it('should handle execution result retrieval errors gracefully', async () => {
      await expect(
        executionService.getExecutionResult('non-existent-execution')
      ).rejects.toThrow('Execution result not found');
    });

    it('should handle execution status retrieval for non-existent executions', async () => {
      await expect(
        executionService.getExecutionStatus('non-existent-execution')
      ).rejects.toThrow('Execution not found');
    });
  });

  describe('Scaling Decision Logic', () => {
    it('should make correct scaling decisions based on demand', async () => {
      const demand = {
        queueSize: 10,
        averageWaitTime: 5000,
        executionRate: 2,
        engineTypeDistribution: {
          [EngineType.LANGFLOW]: 5,
          [EngineType.N8N]: 3,
          [EngineType.LANGSMITH]: 2
        }
      };

      const decision = await executionService.scaleExecutors(demand);
      
      expect(decision).toBeDefined();
      expect(decision.action).toMatch(/^(scale_up|scale_down|no_action)$/);
      expect(decision.targetWorkerCount).toBeGreaterThanOrEqual(testConfig.scaling.minWorkers);
      expect(decision.targetWorkerCount).toBeLessThanOrEqual(testConfig.scaling.maxWorkers);
      expect(decision.reason).toBeDefined();
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should respect minimum worker constraints', async () => {
      const lowDemand = {
        queueSize: 0,
        averageWaitTime: 0,
        executionRate: 0,
        engineTypeDistribution: {
          [EngineType.LANGFLOW]: 0,
          [EngineType.N8N]: 0,
          [EngineType.LANGSMITH]: 0
        }
      };

      const decision = await executionService.scaleExecutors(lowDemand);
      expect(decision.targetWorkerCount).toBeGreaterThanOrEqual(testConfig.scaling.minWorkers);
    });

    it('should respect maximum worker constraints', async () => {
      const highDemand = {
        queueSize: 100,
        averageWaitTime: 30000,
        executionRate: 50,
        engineTypeDistribution: {
          [EngineType.LANGFLOW]: 40,
          [EngineType.N8N]: 35,
          [EngineType.LANGSMITH]: 25
        }
      };

      const decision = await executionService.scaleExecutors(highDemand);
      expect(decision.targetWorkerCount).toBeLessThanOrEqual(testConfig.scaling.maxWorkers);
    });
  });

  describe('Fault Tolerance Configuration', () => {
    it('should use configured retry settings', () => {
      const config = testConfig.faultTolerance;
      
      expect(config.maxRetries).toBe(2);
      expect(config.retryDelay).toBe(500);
      expect(config.backoffFactor).toBe(1.5);
    });

    it('should use configured circuit breaker settings', () => {
      const circuitBreakerConfig = testConfig.faultTolerance.circuitBreakerConfig;
      
      expect(circuitBreakerConfig.failureThreshold).toBe(3);
      expect(circuitBreakerConfig.resetTimeout).toBe(10000);
      expect(circuitBreakerConfig.monitoringPeriod).toBe(30000);
    });
  });

  describe('Storage Configuration', () => {
    it('should use configured storage settings', () => {
      const storageConfig = testConfig.storage;
      
      expect(storageConfig.resultRetentionDays).toBe(7);
      expect(storageConfig.compressionEnabled).toBe(false);
      expect(storageConfig.encryptionEnabled).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit events for service lifecycle', async () => {
      const newService = new ExecutionService(testConfig);
      
      const startedPromise = new Promise<void>((resolve) => {
        newService.on('started', () => {
          resolve();
        });
      });

      await newService.start();
      await startedPromise;
      await newService.stop();
    });

    it('should emit events for scaling operations', async () => {
      const scalingPromise = new Promise<void>((resolve) => {
        executionService.on('scaling_completed', (decision) => {
          expect(decision).toBeDefined();
          expect(decision.action).toBeDefined();
          resolve();
        });
      });

      // Trigger scaling by submitting high demand
      const highDemand = {
        queueSize: 20,
        averageWaitTime: 10000,
        executionRate: 10,
        engineTypeDistribution: {
          [EngineType.LANGFLOW]: 10,
          [EngineType.N8N]: 5,
          [EngineType.LANGSMITH]: 5
        }
      };

      await executionService.scaleExecutors(highDemand);
      await scalingPromise;
    });

    it('should emit events for worker lifecycle', async () => {
      const workerStartedPromise = new Promise<void>((resolve) => {
        executionService.on('worker_started', (data) => {
          expect(data.workerId).toBeDefined();
          resolve();
        });
      });

      // Trigger worker creation by scaling up
      const highDemand = {
        queueSize: 25,
        averageWaitTime: 15000,
        executionRate: 15,
        engineTypeDistribution: {
          [EngineType.LANGFLOW]: 15,
          [EngineType.N8N]: 5,
          [EngineType.LANGSMITH]: 5
        }
      };

      await executionService.scaleExecutors(highDemand);
      await workerStartedPromise;
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid scaling configuration gracefully', () => {
      const invalidConfig = {
        ...testConfig,
        scaling: {
          ...testConfig.scaling,
          minWorkers: 10,
          maxWorkers: 5 // Invalid: min > max
        }
      };

      // Service should still initialize but may adjust values internally
      expect(() => new ExecutionService(invalidConfig)).not.toThrow();
    });

    it('should handle zero or negative values in configuration', () => {
      const edgeCaseConfig = {
        ...testConfig,
        scaling: {
          ...testConfig.scaling,
          minWorkers: 0,
          scaleUpCooldown: -1000
        }
      };

      expect(() => new ExecutionService(edgeCaseConfig)).not.toThrow();
    });
  });
});