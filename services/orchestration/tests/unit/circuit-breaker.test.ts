import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerState } from '../../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockOperation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 500
    });
    mockOperation = vi.fn();
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should have zero failure count initially', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.lastFailureTime).toBeUndefined();
    });
  });

  describe('successful operations', () => {
    it('should execute operation successfully when closed', async () => {
      const expectedResult = 'success';
      mockOperation.mockResolvedValue(expectedResult);

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe(expectedResult);
      expect(mockOperation).toHaveBeenCalledOnce();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should increment success count on successful operation', async () => {
      mockOperation.mockResolvedValue('success');

      await circuitBreaker.execute(mockOperation);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(0);
    });

    it('should reset failure count on success', async () => {
      // First, cause some failures
      mockOperation.mockRejectedValue(new Error('failure'));
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch {}
      try {
        await circuitBreaker.execute(mockOperation);
      } catch {}

      expect(circuitBreaker.getMetrics().failureCount).toBe(2);

      // Then succeed
      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(1);
    });
  });

  describe('failed operations', () => {
    it('should propagate error when operation fails', async () => {
      const error = new Error('operation failed');
      mockOperation.mockRejectedValue(error);

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      expect(mockOperation).toHaveBeenCalledOnce();
    });

    it('should increment failure count on failed operation', async () => {
      mockOperation.mockRejectedValue(new Error('failure'));

      try {
        await circuitBreaker.execute(mockOperation);
      } catch {}

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
      expect(metrics.lastFailureTime).toBeInstanceOf(Date);
    });

    it('should open circuit after reaching failure threshold', async () => {
      mockOperation.mockRejectedValue(new Error('failure'));

      // Cause failures up to threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.getMetrics().failureCount).toBe(3);
    });
  });

  describe('open state behavior', () => {
    beforeEach(async () => {
      // Force circuit breaker to open state
      mockOperation.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch {}
      }
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      // Clear the mock call history after setup
      mockOperation.mockClear();
    });

    it('should reject operations immediately when open', async () => {
      mockOperation.mockResolvedValue('success');

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is open');
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should transition to half-open after recovery timeout', async () => {
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('half-open state behavior', () => {
    beforeEach(async () => {
      // Force circuit breaker to open state
      mockOperation.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch {}
      }
      
      // Wait for recovery timeout to allow transition to half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      // Clear the mock call history after setup
      mockOperation.mockClear();
    });

    it('should close circuit on successful operation in half-open state', async () => {
      mockOperation.mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should open circuit on failed operation in half-open state', async () => {
      mockOperation.mockRejectedValue(new Error('still failing'));

      try {
        await circuitBreaker.execute(mockOperation);
      } catch {}

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('reset functionality', () => {
    it('should reset circuit breaker to initial state', async () => {
      // Cause some failures and successes
      mockOperation.mockRejectedValue(new Error('failure'));
      try {
        await circuitBreaker.execute(mockOperation);
      } catch {}

      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);

      // Reset
      circuitBreaker.reset();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.lastFailureTime).toBeUndefined();
    });

    it('should allow operations after reset', async () => {
      // Force open state
      mockOperation.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch {}
      }
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Reset and try operation
      circuitBreaker.reset();
      mockOperation.mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('metrics', () => {
    it('should provide accurate metrics', async () => {
      // Perform some operations
      mockOperation.mockRejectedValue(new Error('failure'));
      try {
        await circuitBreaker.execute(mockOperation);
      } catch {}
      try {
        await circuitBreaker.execute(mockOperation);
      } catch {}

      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.failureCount).toBe(0); // Reset after success
      expect(metrics.successCount).toBe(2);
      expect(metrics.lastFailureTime).toBeInstanceOf(Date);
    });
  });

  describe('edge cases', () => {
    it('should handle synchronous errors', async () => {
      const syncError = new Error('sync error');
      mockOperation.mockImplementation(() => {
        throw syncError;
      });

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('sync error');
      expect(circuitBreaker.getMetrics().failureCount).toBe(1);
    });

    it('should handle operations that return undefined', async () => {
      mockOperation.mockResolvedValue(undefined);

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBeUndefined();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getMetrics().successCount).toBe(1);
    });

    it('should handle operations that return null', async () => {
      mockOperation.mockResolvedValue(null);

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBeNull();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getMetrics().successCount).toBe(1);
    });
  });
});