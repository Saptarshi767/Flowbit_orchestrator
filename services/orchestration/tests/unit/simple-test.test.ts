import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitBreakerState } from '../../src/utils/circuit-breaker';

describe('Simple Integration Test', () => {
  it('should create circuit breaker successfully', () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 500
    });

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('should have all required exports', () => {
    // Test that all main exports are available
    expect(CircuitBreaker).toBeDefined();
    expect(CircuitBreakerState).toBeDefined();
    expect(CircuitBreakerState.CLOSED).toBe('closed');
    expect(CircuitBreakerState.OPEN).toBe('open');
    expect(CircuitBreakerState.HALF_OPEN).toBe('half_open');
  });
});