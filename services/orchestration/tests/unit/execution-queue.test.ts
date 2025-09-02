import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExecutionQueue,
  ExecutionRequest,
  ExecutionPriority,
  QueueConfig
} from '../../src/core/execution-queue';
import {
  WorkflowDefinition,
  EngineType,
  ExecutionStatus
} from '@robust-ai-orchestrator/shared';

describe('ExecutionQueue', () => {
  let queue: ExecutionQueue;
  let config: QueueConfig;

  beforeEach(() => {
    config = {
      maxSize: 10,
      processingInterval: 100,
      maxConcurrentExecutions: 3,
      retryConfig: {
        maxAttempts: 2,
        initialDelay: 500,
        backoffFactor: 2
      }
    };

    queue = new ExecutionQueue(config);
  });

  afterEach(async () => {
    if (queue) {
      await queue.stop();
    }
  });

  describe('Initialization', () => {
    it('should create execution queue with config', () => {
      expect(queue).toBeDefined();
      expect(queue.getStats()).toBeDefined();
    });

    it('should use default config values', () => {
      const minimalConfig = {
        maxSize: 5,
        processingInterval: 1000
      };
      
      const queueWithDefaults = new ExecutionQueue(minimalConfig);
      expect(queueWithDefaults).toBeDefined();
    });
  });

  describe('Queue Lifecycle', () => {
    it('should start and stop queue', async () => {
      await expect(queue.start()).resolves.toBeUndefined();
      await expect(queue.stop()).resolves.toBeUndefined();
    });

    it('should emit started and stopped events', async () => {
      const startedSpy = vi.fn();
      const stoppedSpy = vi.fn();

      queue.on('started', startedSpy);
      queue.on('stopped', stoppedSpy);

      await queue.start();
      expect(startedSpy).toHaveBeenCalled();

      await queue.stop();
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not start if already processing', async () => {
      await queue.start();
      await queue.start(); // Should not throw or cause issues
      await queue.stop();
    });
  });

  describe('Request Enqueueing', () => {
    beforeEach(async () => {
      await queue.start();
    });

    it('should enqueue execution request', async () => {
      const request = createTestRequest('test-1', ExecutionPriority.NORMAL);
      
      const resultPromise = queue.enqueue(request);
      expect(resultPromise).toBeInstanceOf(Promise);

      const stats = queue.getStats();
      expect(stats.totalQueued).toBe(1);
    });

    it('should enqueue requests in priority order', async () => {
      const lowPriorityRequest = createTestRequest('low', ExecutionPriority.LOW);
      const highPriorityRequest = createTestRequest('high', ExecutionPriority.HIGH);
      const normalPriorityRequest = createTestRequest('normal', ExecutionPriority.NORMAL);

      // Enqueue in random order
      queue.enqueue(lowPriorityRequest);
      queue.enqueue(highPriorityRequest);
      queue.enqueue(normalPriorityRequest);

      const pendingRequests = queue.getPendingRequests();
      expect(pendingRequests[0].id).toBe('high'); // Highest priority first
      expect(pendingRequests[1].id).toBe('normal');
      expect(pendingRequests[2].id).toBe('low');
    });

    it('should reject when queue is full', async () => {
      // Fill the queue to capacity
      const promises = [];
      for (let i = 0; i < config.maxSize; i++) {
        const request = createTestRequest(`test-${i}`, ExecutionPriority.NORMAL);
        promises.push(queue.enqueue(request));
      }

      // Try to add one more
      const overflowRequest = createTestRequest('overflow', ExecutionPriority.NORMAL);
      await expect(queue.enqueue(overflowRequest)).rejects.toThrow('queue is full');
    });

    it('should emit enqueued event', async () => {
      const enqueuedSpy = vi.fn();
      queue.on('enqueued', enqueuedSpy);

      const request = createTestRequest('test-event', ExecutionPriority.NORMAL);
      queue.enqueue(request);

      expect(enqueuedSpy).toHaveBeenCalledWith(request);
    });
  });

  describe('Request Dequeuing', () => {
    beforeEach(async () => {
      await queue.start();
    });

    it('should dequeue specific request', async () => {
      const request1 = createTestRequest('test-1', ExecutionPriority.NORMAL);
      const request2 = createTestRequest('test-2', ExecutionPriority.NORMAL);

      queue.enqueue(request1);
      queue.enqueue(request2);

      const removed = queue.dequeue('test-1');
      expect(removed).toBe(true);

      const pendingRequests = queue.getPendingRequests();
      expect(pendingRequests).toHaveLength(1);
      expect(pendingRequests[0].id).toBe('test-2');
    });

    it('should return false for non-existent request', () => {
      const removed = queue.dequeue('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Queue Processing', () => {
    beforeEach(async () => {
      await queue.start();
    });

    it('should process requests automatically', async () => {
      const executionStartedSpy = vi.fn();
      queue.on('executionStarted', executionStartedSpy);

      const request = createTestRequest('auto-process', ExecutionPriority.NORMAL);
      queue.enqueue(request);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(executionStartedSpy).toHaveBeenCalled();
    });

    it('should respect max concurrent executions', async () => {
      const executionStartedSpy = vi.fn();
      queue.on('executionStarted', executionStartedSpy);

      // Enqueue more requests than max concurrent
      for (let i = 0; i < config.maxConcurrentExecutions! + 2; i++) {
        const request = createTestRequest(`concurrent-${i}`, ExecutionPriority.NORMAL);
        queue.enqueue(request);
      }

      // Wait for initial processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const activeExecutions = queue.getActiveExecutions();
      expect(activeExecutions.length).toBeLessThanOrEqual(config.maxConcurrentExecutions!);
    });

    it('should emit execution completed events', async () => {
      const executionCompletedSpy = vi.fn();
      queue.on('executionCompleted', executionCompletedSpy);

      const request = createTestRequest('completion-test', ExecutionPriority.NORMAL);
      queue.enqueue(request);

      // Wait for processing and completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(executionCompletedSpy).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await queue.start();
    });

    it('should track queue statistics', async () => {
      const request1 = createTestRequest('stats-1', ExecutionPriority.NORMAL);
      const request2 = createTestRequest('stats-2', ExecutionPriority.HIGH);

      queue.enqueue(request1);
      queue.enqueue(request2);

      const stats = queue.getStats();
      expect(stats.totalQueued).toBe(2);
      expect(stats.currentQueueSize).toBe(2);
      expect(typeof stats.averageProcessingTime).toBe('number');
    });

    it('should update statistics after processing', async () => {
      const request = createTestRequest('stats-processing', ExecutionPriority.NORMAL);
      queue.enqueue(request);

      const initialStats = queue.getStats();
      expect(initialStats.totalQueued).toBe(1);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalStats = queue.getStats();
      expect(finalStats.totalProcessed).toBeGreaterThan(0);
    });
  });

  describe('Queue Management', () => {
    beforeEach(async () => {
      await queue.start();
    });

    it('should clear queue', () => {
      const request1 = createTestRequest('clear-1', ExecutionPriority.NORMAL);
      const request2 = createTestRequest('clear-2', ExecutionPriority.NORMAL);

      queue.enqueue(request1);
      queue.enqueue(request2);

      expect(queue.getPendingRequests()).toHaveLength(2);

      queue.clear();

      expect(queue.getPendingRequests()).toHaveLength(0);
      expect(queue.getStats().currentQueueSize).toBe(0);
    });

    it('should emit cleared event', () => {
      const clearedSpy = vi.fn();
      queue.on('cleared', clearedSpy);

      queue.clear();

      expect(clearedSpy).toHaveBeenCalled();
    });

    it('should get pending requests', () => {
      const request1 = createTestRequest('pending-1', ExecutionPriority.NORMAL);
      const request2 = createTestRequest('pending-2', ExecutionPriority.HIGH);

      queue.enqueue(request1);
      queue.enqueue(request2);

      const pendingRequests = queue.getPendingRequests();
      expect(pendingRequests).toHaveLength(2);
      expect(pendingRequests[0].priority).toBe(ExecutionPriority.HIGH);
    });

    it('should get active executions', () => {
      const activeExecutions = queue.getActiveExecutions();
      expect(Array.isArray(activeExecutions)).toBe(true);
    });
  });

  describe('Error Handling and Retries', () => {
    beforeEach(async () => {
      await queue.start();
    });

    it('should handle execution failures', async () => {
      const executionFailedSpy = vi.fn();
      queue.on('executionFailed', executionFailedSpy);

      // Mock execution to fail
      const originalExecute = (queue as any).executeRequest;
      (queue as any).executeRequest = vi.fn().mockRejectedValue(new Error('Execution failed'));

      const request = createTestRequest('failure-test', ExecutionPriority.NORMAL);
      queue.enqueue(request);

      // Wait for processing and failure
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(executionFailedSpy).toHaveBeenCalled();

      // Restore original method
      (queue as any).executeRequest = originalExecute;
    });

    it('should retry failed executions', async () => {
      const retryScheduledSpy = vi.fn();
      queue.on('retryScheduled', retryScheduledSpy);

      // Mock execution to fail with retryable error
      const originalExecute = (queue as any).executeRequest;
      (queue as any).executeRequest = vi.fn().mockRejectedValue(new Error('TIMEOUT'));

      const request = createTestRequest('retry-test', ExecutionPriority.NORMAL);
      queue.enqueue(request);

      // Wait for processing and retry scheduling
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(retryScheduledSpy).toHaveBeenCalled();

      // Restore original method
      (queue as any).executeRequest = originalExecute;
    });
  });

  describe('Timeout Handling', () => {
    beforeEach(async () => {
      await queue.start();
    });

    it('should timeout long-running executions', async () => {
      const request = createTestRequest('timeout-test', ExecutionPriority.NORMAL);
      request.timeout = 100; // Very short timeout

      // Mock long-running execution
      const originalExecute = (queue as any).executeRequest;
      (queue as any).executeRequest = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000)) // Longer than timeout
      );

      const resultPromise = queue.enqueue(request);
      await expect(resultPromise).rejects.toThrow('timeout');

      // Restore original method
      (queue as any).executeRequest = originalExecute;
    });
  });

  // Helper function to create test requests
  function createTestRequest(id: string, priority: ExecutionPriority): ExecutionRequest {
    const workflow: WorkflowDefinition = {
      name: `Test Workflow ${id}`,
      engineType: EngineType.LANGFLOW,
      definition: { nodes: [], edges: [] }
    };

    return {
      id,
      workflow,
      parameters: { test: true },
      priority,
      createdAt: new Date(),
      timeout: 5000
    };
  }
});