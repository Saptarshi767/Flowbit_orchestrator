import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExecutionContext,
  ExecutionContextData
} from '../../src/core/execution-context';
import {
  WorkflowDefinition,
  WorkflowParameters,
  ExecutionStatus,
  ExecutionError,
  EngineType
} from '@robust-ai-orchestrator/shared';

describe('ExecutionContext', () => {
  let context: ExecutionContext;
  let workflow: WorkflowDefinition;
  let parameters: WorkflowParameters;

  beforeEach(() => {
    workflow = {
      name: 'Test Workflow',
      engineType: EngineType.LANGFLOW,
      definition: { nodes: [], edges: [] }
    };

    parameters = {
      input: 'test input',
      config: { timeout: 30000 }
    };

    context = new ExecutionContext(
      'test-execution-id',
      workflow,
      parameters,
      'test-user-id'
    );
  });

  afterEach(() => {
    // Clean up any timeouts
    context.clearTimeouts();
  });

  describe('Initialization', () => {
    it('should create execution context with correct properties', () => {
      expect(context.id).toBe('test-execution-id');
      expect(context.workflow).toEqual(workflow);
      expect(context.parameters).toEqual(parameters);
      expect(context.userId).toBe('test-user-id');
      expect(context.status).toBe(ExecutionStatus.PENDING);
      expect(context.createdAt).toBeInstanceOf(Date);
    });

    it('should initialize with empty logs and metrics', () => {
      expect(context.logs).toEqual([]);
      expect(context.metrics).toEqual({});
    });

    it('should create context without user ID', () => {
      const contextWithoutUser = new ExecutionContext(
        'test-id',
        workflow,
        parameters
      );
      expect(contextWithoutUser.userId).toBeUndefined();
    });
  });

  describe('Execution Lifecycle', () => {
    it('should start execution correctly', () => {
      context.start();
      
      expect(context.status).toBe(ExecutionStatus.RUNNING);
      expect(context.startTime).toBeInstanceOf(Date);
      expect(context.logs.length).toBeGreaterThan(0);
      expect(context.logs[0].message).toContain('Execution started');
    });

    it('should complete execution successfully', () => {
      const result = { output: 'test result' };
      
      context.start();
      context.complete(result);
      
      expect(context.status).toBe(ExecutionStatus.COMPLETED);
      expect(context.endTime).toBeInstanceOf(Date);
      expect(context.result).toEqual(result);
      expect(context.getDuration()).toBeGreaterThanOrEqual(0);
    });

    it('should fail execution with error', () => {
      const error: ExecutionError = {
        code: 'TEST_ERROR',
        message: 'Test error message'
      };
      
      context.start();
      context.fail(error);
      
      expect(context.status).toBe(ExecutionStatus.FAILED);
      expect(context.endTime).toBeInstanceOf(Date);
      expect(context.error).toEqual(error);
    });

    it('should cancel execution', () => {
      context.start();
      context.cancel();
      
      expect(context.status).toBe(ExecutionStatus.CANCELLED);
      expect(context.endTime).toBeInstanceOf(Date);
    });
  });

  describe('Logging', () => {
    it('should add log entries', () => {
      context.addLog('info', 'Test message', { key: 'value' });
      
      expect(context.logs).toHaveLength(1);
      expect(context.logs[0].level).toBe('info');
      expect(context.logs[0].message).toBe('Test message');
      expect(context.logs[0].context?.key).toBe('value');
      expect(context.logs[0].context?.executionId).toBe(context.id);
    });

    it('should limit log entries to prevent memory issues', () => {
      // Add more than 1000 log entries
      for (let i = 0; i < 1100; i++) {
        context.addLog('debug', `Log entry ${i}`);
      }
      
      expect(context.logs).toHaveLength(1000);
      expect(context.logs[0].message).toBe('Log entry 100'); // First 100 should be removed
    });

    it('should include current step in log context', () => {
      context.setCurrentStep('step-1');
      context.addLog('info', 'Step message');
      
      expect(context.logs[0].context?.step).toBe('step-1');
    });
  });

  describe('Context Data Management', () => {
    it('should set and get context data', () => {
      context.setContextData('key1', 'value1');
      context.setContextData('key2', { nested: 'object' });
      
      expect(context.getContextData('key1')).toBe('value1');
      expect(context.getContextData('key2')).toEqual({ nested: 'object' });
    });

    it('should get all context data', () => {
      context.setContextData('key1', 'value1');
      context.setContextData('key2', 'value2');
      
      const allData = context.getAllContextData();
      expect(allData).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should return undefined for non-existent keys', () => {
      expect(context.getContextData('non-existent')).toBeUndefined();
    });
  });

  describe('Step Results Management', () => {
    it('should set and get step results', () => {
      const result1 = { output: 'result1' };
      const result2 = { output: 'result2' };
      
      context.setStepResult('step-1', result1);
      context.setStepResult('step-2', result2);
      
      expect(context.getStepResult('step-1')).toEqual(result1);
      expect(context.getStepResult('step-2')).toEqual(result2);
    });

    it('should get all step results', () => {
      context.setStepResult('step-1', { output: 'result1' });
      context.setStepResult('step-2', { output: 'result2' });
      
      const allResults = context.getAllStepResults();
      expect(allResults).toEqual({
        'step-1': { output: 'result1' },
        'step-2': { output: 'result2' }
      });
    });

    it('should log when setting step results', () => {
      context.setStepResult('step-1', { output: 'test' });
      
      const logEntry = context.logs.find(log => 
        log.message.includes('Step result set: step-1')
      );
      expect(logEntry).toBeDefined();
    });
  });

  describe('Current Step Management', () => {
    it('should set and get current step', () => {
      context.setCurrentStep('step-1');
      expect(context.getCurrentStep()).toBe('step-1');
    });

    it('should log when setting current step', () => {
      context.setCurrentStep('step-1');
      
      const logEntry = context.logs.find(log => 
        log.message.includes('Executing step: step-1')
      );
      expect(logEntry).toBeDefined();
    });
  });

  describe('Timeout Management', () => {
    it('should set and clear timeouts', (done) => {
      let callbackCalled = false;
      
      context.setTimeout('test-timeout', () => {
        callbackCalled = true;
        done();
      }, 10);
      
      // Timeout should be set
      expect(callbackCalled).toBe(false);
      
      // Wait for timeout to execute
      setTimeout(() => {
        expect(callbackCalled).toBe(true);
      }, 20);
    });

    it('should clear specific timeout', () => {
      let callbackCalled = false;
      
      context.setTimeout('test-timeout', () => {
        callbackCalled = true;
      }, 10);
      
      context.clearTimeout('test-timeout');
      
      // Wait longer than timeout duration
      setTimeout(() => {
        expect(callbackCalled).toBe(false);
      }, 20);
    });

    it('should clear all timeouts', () => {
      let callback1Called = false;
      let callback2Called = false;
      
      context.setTimeout('timeout-1', () => { callback1Called = true; }, 10);
      context.setTimeout('timeout-2', () => { callback2Called = true; }, 10);
      
      context.clearTimeouts();
      
      setTimeout(() => {
        expect(callback1Called).toBe(false);
        expect(callback2Called).toBe(false);
      }, 20);
    });
  });

  describe('Duration Calculation', () => {
    it('should return undefined duration before start', () => {
      expect(context.getDuration()).toBeUndefined();
    });

    it('should calculate duration after start', (done) => {
      context.start();
      
      // Wait a bit
      setTimeout(() => {
        const duration = context.getDuration();
        expect(duration).toBeGreaterThanOrEqual(0);
        done();
      }, 10);
    });

    it('should calculate final duration after completion', (done) => {
      context.start();
      
      setTimeout(() => {
        context.complete();
        const duration = context.getDuration();
        expect(duration).toBeGreaterThanOrEqual(0);
        done();
      }, 10);
    });
  });

  describe('State Checks', () => {
    it('should identify terminal states', () => {
      expect(context.isTerminal()).toBe(false);
      
      context.complete();
      expect(context.isTerminal()).toBe(true);
      
      const failedContext = new ExecutionContext('id', workflow, {});
      failedContext.fail({ code: 'ERROR', message: 'Failed' });
      expect(failedContext.isTerminal()).toBe(true);
      
      const cancelledContext = new ExecutionContext('id', workflow, {});
      cancelledContext.cancel();
      expect(cancelledContext.isTerminal()).toBe(true);
    });

    it('should identify active states', () => {
      expect(context.isActive()).toBe(true);
      
      context.start();
      expect(context.isActive()).toBe(true);
      
      context.complete();
      expect(context.isActive()).toBe(false);
    });
  });

  describe('Summary Generation', () => {
    it('should generate execution summary', () => {
      context.start();
      context.setCurrentStep('step-1');
      context.setStepResult('step-1', { output: 'test' });
      context.addLog('info', 'Test log');
      
      const summary = context.getSummary();
      
      expect(summary.id).toBe(context.id);
      expect(summary.workflowName).toBe(workflow.name);
      expect(summary.engineType).toBe(workflow.engineType);
      expect(summary.status).toBe(ExecutionStatus.RUNNING);
      expect(summary.currentStep).toBe('step-1');
      expect(summary.logCount).toBe(4); // start log + setCurrentStep log + setStepResult log + test log
      expect(summary.stepCount).toBe(1);
      expect(summary.hasError).toBe(false);
      expect(summary.hasResult).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      context.start();
      context.setContextData('key', 'value');
      context.setStepResult('step-1', { output: 'test' });
      
      const json = context.toJSON();
      
      expect(json.id).toBe(context.id);
      expect(json.workflow).toEqual(workflow);
      expect(json.parameters).toEqual(parameters);
      expect(json.status).toBe(ExecutionStatus.RUNNING);
      expect(json.contextData).toEqual({ key: 'value' });
      expect(json.stepResults).toEqual({ 'step-1': { output: 'test' } });
    });

    it('should deserialize from JSON', () => {
      context.start();
      context.setContextData('key', 'value');
      context.setStepResult('step-1', { output: 'test' });
      
      const json = context.toJSON();
      const restored = ExecutionContext.fromJSON(json);
      
      expect(restored.id).toBe(context.id);
      expect(restored.workflow).toEqual(workflow);
      expect(restored.parameters).toEqual(parameters);
      expect(restored.status).toBe(context.status);
      expect(restored.getContextData('key')).toBe('value');
      expect(restored.getStepResult('step-1')).toEqual({ output: 'test' });
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate metrics on completion', () => {
      context.start();
      context.addLog('info', 'Test log');
      context.setStepResult('step-1', { output: 'test' });
      context.complete();
      
      expect(context.metrics.duration).toBeGreaterThanOrEqual(0);
      expect(context.metrics.logCount).toBe(3); // start + test log + completion log
      expect(context.metrics.stepCount).toBe(1);
      expect(context.metrics.contextDataSize).toBe(0);
    });

    it('should include memory usage if available', () => {
      // Mock process.memoryUsage for testing
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 1024000,
        heapTotal: 2048000,
        external: 512000,
        rss: 4096000,
        arrayBuffers: 0
      });
      
      context.start();
      context.complete();
      
      expect(context.metrics.memoryUsage).toBe(1024000);
      
      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });
});