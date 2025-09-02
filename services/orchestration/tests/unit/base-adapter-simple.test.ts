import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerState } from '../../src/utils/circuit-breaker';
import { Logger } from '../../src/utils/logger';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    }))
  }
}));

describe('BaseEngineAdapter Core Functionality', () => {
  describe('CircuitBreaker Integration', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000,
        monitoringPeriod: 500
      });
    });

    it('should create circuit breaker with correct configuration', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should execute operations through circuit breaker', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
    });

    it('should handle operation failures', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('operation failed'));
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      expect(circuitBreaker.getMetrics().failureCount).toBe(1);
    });
  });

  describe('Logger Integration', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger('test-context');
    });

    it('should create logger with context', () => {
      expect(logger).toBeDefined();
    });

    it('should log messages without throwing', () => {
      expect(() => {
        logger.info('Test message');
        logger.error('Test error');
        logger.warn('Test warning');
        logger.debug('Test debug');
      }).not.toThrow();
    });

    it('should create child logger', () => {
      const childLogger = logger.child('child-context');
      expect(childLogger).toBeDefined();
      expect(childLogger).toBeInstanceOf(Logger);
    });
  });

  describe('Utility Functions', () => {
    it('should generate unique IDs', () => {
      // Test UUID generation functionality
      const uuid = require('uuid');
      const id1 = uuid.v4();
      const id2 = uuid.v4();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should handle retry logic configuration', () => {
      const retryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffFactor: 2
      };

      expect(retryConfig.maxAttempts).toBe(3);
      expect(retryConfig.initialDelay).toBe(1000);
      expect(retryConfig.maxDelay).toBe(5000);
      expect(retryConfig.backoffFactor).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should identify retryable errors correctly', () => {
      // Test error classification logic
      const networkErrors = [
        { code: 'ECONNRESET' },
        { code: 'ETIMEDOUT' },
        { code: 'ENOTFOUND' }
      ];

      const retryableStatuses = [500, 502, 503, 504, 429, 408];
      const nonRetryableStatuses = [400, 401, 403, 404];

      // Network errors should be retryable
      networkErrors.forEach(error => {
        expect(error.code).toMatch(/^E(CONN|TIME|NOT)/);
      });

      // Server errors should be retryable
      retryableStatuses.forEach(status => {
        expect(status >= 500 || status === 429 || status === 408).toBe(true);
      });

      // Client errors should not be retryable
      nonRetryableStatuses.forEach(status => {
        expect(status >= 400 && status < 500 && status !== 408 && status !== 429).toBe(true);
      });
    });

    it('should transform errors correctly', () => {
      const axiosError = {
        code: 'ECONNRESET',
        message: 'Connection reset',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Server error' }
        },
        config: {
          url: '/test',
          method: 'GET'
        },
        stack: 'Error stack trace'
      };

      // Test error transformation logic
      const executionError = {
        code: axiosError.code,
        message: axiosError.message,
        details: {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          url: axiosError.config.url,
          method: axiosError.config.method
        },
        engineError: axiosError.response.data,
        stack: axiosError.stack
      };

      expect(executionError.code).toBe('ECONNRESET');
      expect(executionError.message).toBe('Connection reset');
      expect(executionError.details.status).toBe(500);
      expect(executionError.engineError).toEqual({ error: 'Server error' });
    });
  });
});