import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExecutionService, ExecutionServiceConfig } from '../../src/services/execution.service';
import { ExecutionPriority } from '../../src/core/execution-queue';
import { 
  EngineType, 
  WorkflowDefinition, 
  ExecutionStatus 
} from '@robust-ai-orchestrator/shared';
import { IEngineAdapter } from '../../src/interfaces/engine-adapter.interface';

// High-performance mock adapter for load testing
class LoadTestAdapter implements IEngineAdapter {
  private executionCount = 0;
  private executionDelay: number;

  constructor(executionDelay = 10) {
    this.executionDelay = executionDelay;
  }

  async validateWorkflow(workflow: WorkflowDefinition) {
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  async executeWorkflow(workflow: WorkflowDefinition, parameters: any) {
    this.executionCount++;
    
    // Simulate minimal processing time
    await new Promise(resolve => setTimeout(resolve, this.executionDelay));
    
    return {
      id: `load-exec-${this.executionCount}`,
      status: ExecutionStatus.COMPLETED,
      result: { 
        message: 'Load test execution completed',
        executionNumber: this.executionCount 
      },
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

  getExecutionCount(): number {
    return this.executionCount;
  }

  reset(): void {
    this.executionCount = 0;
  }
}

describe('ExecutionService Load and Performance Tests', () => {
  let executionService: ExecutionService;
  let loadTestAdapter: LoadTestAdapter;

  const performanceConfig: ExecutionServiceConfig = {
    scaling: {
      minWorkers: 2,
      maxWorkers: 20,
      targetUtilization: 0.7,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3,
      scaleUpCooldown: 2000,
      scaleDownCooldown: 5000,
      workerStartupTime: 500
    },
    faultTolerance: {
      maxRetries: 1,
      retryDelay: 100,
      backoffFactor: 1.5,
      circuitBreakerConfig: {
        failureThreshold: 10,
        resetTimeout: 30000,
        monitoringPeriod: 60000
      }
    },
    storage: {
      resultRetentionDays: 1,
      compressionEnabled: false,
      encryptionEnabled: false
    },
    metrics: {
      collectionInterval: 500,
      aggregationWindow: 30000,
      retentionPeriod: 3600000
    }
  };

  beforeEach(async () => {
    executionService = new ExecutionService(performanceConfig);
    loadTestAdapter = new LoadTestAdapter(10); // 10ms execution time
    
    executionService.registerAdapter(EngineType.LANGFLOW, loadTestAdapter);
    executionService.registerAdapter(EngineType.N8N, loadTestAdapter);
    executionService.registerAdapter(EngineType.LANGSMITH, loadTestAdapter);

    await executionService.start();
  });

  afterEach(async () => {
    await executionService.stop();
    loadTestAdapter.reset();
  });

  describe('High Volume Execution Tests', () => {
    it('should handle 100 concurrent executions efficiently', async () => {
      const startTime = Date.now();
      const executionCount = 100;
      
      const workflow: WorkflowDefinition = {
        name: 'Load Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      // Submit all executions concurrently
      const executionPromises = Array.from({ length: executionCount }, (_, i) =>
        executionService.submitExecution({
          id: `load-test-${i}`,
          workflowId: `load-workflow-${i}`,
          workflow,
          engineType: EngineType.LANGFLOW,
          parameters: { input: `test-${i}` },
          priority: ExecutionPriority.NORMAL,
          createdAt: new Date(),
          timeout: 30000
        })
      );

      const executionIds = await Promise.all(executionPromises);
      expect(executionIds).toHaveLength(executionCount);

      // Wait for all executions to complete
      const maxWaitTime = 30000; // 30 seconds max
      const checkInterval = 500;
      let elapsedTime = 0;

      while (elapsedTime < maxWaitTime) {
        const metrics = executionService.getExecutionMetrics();
        if (metrics.totalExecutions >= executionCount && 
            metrics.currentQueueSize === 0) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsedTime += checkInterval;
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const finalMetrics = executionService.getExecutionMetrics();
      
      // Performance assertions
      expect(finalMetrics.totalExecutions).toBe(executionCount);
      expect(totalTime).toBeLessThan(maxWaitTime);
      expect(finalMetrics.currentQueueSize).toBe(0);
      
      // Calculate throughput (executions per second)
      const throughput = (executionCount / totalTime) * 1000;
      expect(throughput).toBeGreaterThan(5); // At least 5 executions per second
      
      console.log(`Processed ${executionCount} executions in ${totalTime}ms (${throughput.toFixed(2)} exec/sec)`);
    }, 60000); // 60 second timeout

    it('should scale workers appropriately under sustained load', async () => {
      const initialWorkers = executionService.getWorkersStatus().length;
      const executionCount = 200;
      
      const workflow: WorkflowDefinition = {
        name: 'Scaling Load Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      // Submit executions in batches to simulate sustained load
      const batchSize = 20;
      const batches = Math.ceil(executionCount / batchSize);
      
      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array.from({ length: batchSize }, (_, i) => {
          const executionIndex = batch * batchSize + i;
          if (executionIndex >= executionCount) return null;
          
          return executionService.submitExecution({
            id: `scaling-load-${executionIndex}`,
            workflowId: `scaling-workflow-${executionIndex}`,
            workflow,
            engineType: EngineType.LANGFLOW,
            parameters: { input: `test-${executionIndex}` },
            priority: ExecutionPriority.NORMAL,
            createdAt: new Date(),
            timeout: 30000
          });
        }).filter(Boolean);

        await Promise.all(batchPromises);
        
        // Small delay between batches to allow scaling to react
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for scaling to occur
      await new Promise(resolve => setTimeout(resolve, 5000));

      const scaledWorkers = executionService.getWorkersStatus().length;
      expect(scaledWorkers).toBeGreaterThanOrEqual(initialWorkers);
      expect(scaledWorkers).toBeLessThanOrEqual(performanceConfig.scaling.maxWorkers);

      // Wait for executions to complete
      const maxWaitTime = 60000;
      const checkInterval = 1000;
      let elapsedTime = 0;

      while (elapsedTime < maxWaitTime) {
        const metrics = executionService.getExecutionMetrics();
        if (metrics.totalExecutions >= executionCount && 
            metrics.currentQueueSize === 0) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsedTime += checkInterval;
      }

      const finalMetrics = executionService.getExecutionMetrics();
      expect(finalMetrics.totalExecutions).toBe(executionCount);
      
      console.log(`Scaled from ${initialWorkers} to ${scaledWorkers} workers for ${executionCount} executions`);
    }, 90000); // 90 second timeout
  });

  describe('Memory and Resource Usage Tests', () => {
    it('should maintain stable memory usage under continuous load', async () => {
      const initialMemory = process.memoryUsage();
      const executionCount = 500;
      
      const workflow: WorkflowDefinition = {
        name: 'Memory Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      // Submit executions continuously
      for (let i = 0; i < executionCount; i++) {
        await executionService.submitExecution({
          id: `memory-test-${i}`,
          workflowId: `memory-workflow-${i}`,
          workflow,
          engineType: EngineType.LANGFLOW,
          parameters: { input: `test-${i}` },
          priority: ExecutionPriority.NORMAL,
          createdAt: new Date(),
          timeout: 30000
        });

        // Check memory every 100 executions
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory increase should be reasonable (less than 100MB)
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        }
      }

      // Wait for all executions to complete
      const maxWaitTime = 60000;
      const checkInterval = 1000;
      let elapsedTime = 0;

      while (elapsedTime < maxWaitTime) {
        const metrics = executionService.getExecutionMetrics();
        if (metrics.totalExecutions >= executionCount && 
            metrics.currentQueueSize === 0) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsedTime += checkInterval;
      }

      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB for ${executionCount} executions`);
      
      // Total memory increase should be reasonable
      expect(totalMemoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
    }, 120000); // 2 minute timeout
  });

  describe('Throughput and Latency Tests', () => {
    it('should maintain consistent throughput under varying load', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Throughput Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      const testPhases = [
        { name: 'Low Load', executionCount: 50, expectedMinThroughput: 10 },
        { name: 'Medium Load', executionCount: 100, expectedMinThroughput: 15 },
        { name: 'High Load', executionCount: 200, expectedMinThroughput: 20 }
      ];

      for (const phase of testPhases) {
        const startTime = Date.now();
        
        // Submit executions for this phase
        const executionPromises = Array.from({ length: phase.executionCount }, (_, i) =>
          executionService.submitExecution({
            id: `throughput-${phase.name}-${i}`,
            workflowId: `throughput-workflow-${i}`,
            workflow,
            engineType: EngineType.LANGFLOW,
            parameters: { input: `${phase.name}-${i}` },
            priority: ExecutionPriority.NORMAL,
            createdAt: new Date(),
            timeout: 30000
          })
        );

        await Promise.all(executionPromises);

        // Wait for executions to complete
        const maxWaitTime = 30000;
        const checkInterval = 500;
        let elapsedTime = 0;
        let phaseStartExecutions = executionService.getExecutionMetrics().totalExecutions - phase.executionCount;

        while (elapsedTime < maxWaitTime) {
          const metrics = executionService.getExecutionMetrics();
          const completedInPhase = metrics.totalExecutions - phaseStartExecutions;
          
          if (completedInPhase >= phase.executionCount && metrics.currentQueueSize === 0) {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          elapsedTime += checkInterval;
        }

        const endTime = Date.now();
        const phaseTime = endTime - startTime;
        const throughput = (phase.executionCount / phaseTime) * 1000;

        console.log(`${phase.name}: ${phase.executionCount} executions in ${phaseTime}ms (${throughput.toFixed(2)} exec/sec)`);
        
        expect(throughput).toBeGreaterThan(phase.expectedMinThroughput);

        // Small delay between phases
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }, 180000); // 3 minute timeout

    it('should handle mixed priority executions efficiently', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Priority Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      const executionCounts = {
        [ExecutionPriority.LOW]: 50,
        [ExecutionPriority.NORMAL]: 100,
        [ExecutionPriority.HIGH]: 30,
        [ExecutionPriority.CRITICAL]: 10
      };

      const totalExecutions = Object.values(executionCounts).reduce((sum, count) => sum + count, 0);
      const startTime = Date.now();

      // Submit executions with different priorities
      const allPromises: Promise<string>[] = [];
      
      for (const [priority, count] of Object.entries(executionCounts)) {
        const priorityValue = parseInt(priority) as ExecutionPriority;
        
        for (let i = 0; i < count; i++) {
          allPromises.push(
            executionService.submitExecution({
              id: `priority-${priority}-${i}`,
              workflowId: `priority-workflow-${priority}-${i}`,
              workflow,
              engineType: EngineType.LANGFLOW,
              parameters: { input: `priority-${priority}-${i}` },
              priority: priorityValue,
              createdAt: new Date(),
              timeout: 30000
            })
          );
        }
      }

      await Promise.all(allPromises);

      // Wait for all executions to complete
      const maxWaitTime = 60000;
      const checkInterval = 1000;
      let elapsedTime = 0;

      while (elapsedTime < maxWaitTime) {
        const metrics = executionService.getExecutionMetrics();
        if (metrics.totalExecutions >= totalExecutions && 
            metrics.currentQueueSize === 0) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsedTime += checkInterval;
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const throughput = (totalExecutions / totalTime) * 1000;

      console.log(`Mixed priority: ${totalExecutions} executions in ${totalTime}ms (${throughput.toFixed(2)} exec/sec)`);

      const finalMetrics = executionService.getExecutionMetrics();
      expect(finalMetrics.totalExecutions).toBe(totalExecutions);
      expect(throughput).toBeGreaterThan(10); // At least 10 executions per second
    }, 120000); // 2 minute timeout
  });

  describe('Stress Tests', () => {
    it('should handle rapid burst of executions', async () => {
      const burstSize = 1000;
      const workflow: WorkflowDefinition = {
        name: 'Burst Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] }
      };

      const startTime = Date.now();

      // Submit all executions as fast as possible
      const executionPromises: Promise<string>[] = [];
      for (let i = 0; i < burstSize; i++) {
        executionPromises.push(
          executionService.submitExecution({
            id: `burst-${i}`,
            workflowId: `burst-workflow-${i}`,
            workflow,
            engineType: EngineType.LANGFLOW,
            parameters: { input: `burst-${i}` },
            priority: ExecutionPriority.NORMAL,
            createdAt: new Date(),
            timeout: 30000
          })
        );
      }

      const submissionEndTime = Date.now();
      const submissionTime = submissionEndTime - startTime;

      console.log(`Submitted ${burstSize} executions in ${submissionTime}ms`);

      await Promise.all(executionPromises);

      // Wait for processing to complete
      const maxWaitTime = 120000; // 2 minutes
      const checkInterval = 2000;
      let elapsedTime = 0;

      while (elapsedTime < maxWaitTime) {
        const metrics = executionService.getExecutionMetrics();
        if (metrics.totalExecutions >= burstSize && 
            metrics.currentQueueSize === 0) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsedTime += checkInterval;
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const throughput = (burstSize / totalTime) * 1000;

      console.log(`Processed ${burstSize} executions in ${totalTime}ms (${throughput.toFixed(2)} exec/sec)`);

      const finalMetrics = executionService.getExecutionMetrics();
      expect(finalMetrics.totalExecutions).toBe(burstSize);
      expect(finalMetrics.currentQueueSize).toBe(0);
      
      // Should handle at least 5 executions per second even under burst load
      expect(throughput).toBeGreaterThan(5);
    }, 180000); // 3 minute timeout
  });
});