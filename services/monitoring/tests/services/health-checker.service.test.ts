import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HealthCheckerService } from '../../src/services/health-checker.service';
import { HealthStatus } from '@robust-ai-orchestrator/shared';
import { createLogger } from 'winston';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock Redis client
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('HealthCheckerService', () => {
  let service: HealthCheckerService;
  let logger: any;

  beforeEach(() => {
    logger = createLogger({ silent: true });
    service = new HealthCheckerService(logger);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerCheck', () => {
    it('should register a custom health check', () => {
      const customCheck = vi.fn().mockResolvedValue({
        status: 'healthy' as const,
        message: 'Custom check passed'
      });

      expect(() => {
        service.registerCheck('custom_check', customCheck);
      }).not.toThrow();

      expect(service.getRegisteredChecks()).toContain('custom_check');
    });
  });

  describe('runChecks', () => {
    it('should run all registered health checks', async () => {
      // Mock successful Redis connection
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const healthCheck = await service.runChecks();

      expect(healthCheck).toMatchObject({
        service: 'monitoring',
        status: expect.any(String),
        timestamp: expect.any(Date),
        checks: expect.any(Array),
        metadata: expect.any(Object)
      });

      expect(healthCheck.checks.length).toBeGreaterThan(0);
    });

    it('should handle individual check failures gracefully', async () => {
      // Register a failing check
      const failingCheck = vi.fn().mockRejectedValue(new Error('Check failed'));
      service.registerCheck('failing_check', failingCheck);

      const healthCheck = await service.runChecks();

      expect(healthCheck.status).toBe(HealthStatus.UNHEALTHY);
      
      const failingCheckResult = healthCheck.checks.find(c => c.name === 'failing_check');
      expect(failingCheckResult).toBeDefined();
      expect(failingCheckResult?.status).toBe(HealthStatus.UNHEALTHY);
      expect(failingCheckResult?.message).toContain('Health check failed');
    });

    it('should set overall status to degraded when some checks are degraded', async () => {
      // Register a degraded check
      const degradedCheck = vi.fn().mockResolvedValue({
        status: 'degraded' as const,
        message: 'Service is degraded'
      });
      service.registerCheck('degraded_check', degradedCheck);

      // Mock other services as healthy
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const healthCheck = await service.runChecks();

      expect(healthCheck.status).toBe(HealthStatus.DEGRADED);
    });

    it('should handle check timeouts', async () => {
      // Register a slow check that should timeout
      const slowCheck = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 15000))
      );
      service.registerCheck('slow_check', slowCheck);

      const healthCheck = await service.runChecks();

      const slowCheckResult = healthCheck.checks.find(c => c.name === 'slow_check');
      expect(slowCheckResult?.status).toBe(HealthStatus.UNHEALTHY);
      expect(slowCheckResult?.message).toContain('timeout');
    });
  });

  describe('runSingleCheck', () => {
    it('should run a single health check by name', async () => {
      const customCheck = vi.fn().mockResolvedValue({
        status: 'healthy' as const,
        message: 'Check passed',
        metadata: { test: true }
      });
      service.registerCheck('single_check', customCheck);

      const result = await service.runSingleCheck('single_check');

      expect(result).toMatchObject({
        name: 'single_check',
        status: HealthStatus.HEALTHY,
        message: 'Check passed',
        duration: expect.any(Number),
        metadata: { test: true }
      });
    });

    it('should return null for non-existent check', async () => {
      const result = await service.runSingleCheck('non_existent');
      expect(result).toBeNull();
    });

    it('should handle single check failure', async () => {
      const failingCheck = vi.fn().mockRejectedValue(new Error('Single check failed'));
      service.registerCheck('failing_single', failingCheck);

      const result = await service.runSingleCheck('failing_single');

      expect(result).toMatchObject({
        name: 'failing_single',
        status: HealthStatus.UNHEALTHY,
        message: expect.stringContaining('Single check failed'),
        duration: expect.any(Number)
      });
    });
  });

  describe('default health checks', () => {
    it('should include database health check', async () => {
      const healthCheck = await service.runChecks();
      const dbCheck = healthCheck.checks.find(c => c.name === 'database');
      
      expect(dbCheck).toBeDefined();
      expect(dbCheck?.status).toBe(HealthStatus.HEALTHY);
    });

    it('should include Redis health check', async () => {
      const healthCheck = await service.runChecks();
      const redisCheck = healthCheck.checks.find(c => c.name === 'redis');
      
      expect(redisCheck).toBeDefined();
      expect(redisCheck?.status).toBe(HealthStatus.HEALTHY);
    });

    it('should include memory health check', async () => {
      const healthCheck = await service.runChecks();
      const memoryCheck = healthCheck.checks.find(c => c.name === 'memory');
      
      expect(memoryCheck).toBeDefined();
      expect(memoryCheck?.metadata).toHaveProperty('heapUsed');
      expect(memoryCheck?.metadata).toHaveProperty('heapTotal');
      expect(memoryCheck?.metadata).toHaveProperty('usagePercent');
    });

    it('should include CPU health check', async () => {
      const healthCheck = await service.runChecks();
      const cpuCheck = healthCheck.checks.find(c => c.name === 'cpu');
      
      expect(cpuCheck).toBeDefined();
      expect(cpuCheck?.metadata).toHaveProperty('cpuPercent');
    });

    it('should include external service health checks', async () => {
      // Mock successful external service responses
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const healthCheck = await service.runChecks();
      
      const langflowCheck = healthCheck.checks.find(c => c.name === 'langflow');
      const n8nCheck = healthCheck.checks.find(c => c.name === 'n8n');
      const langsmithCheck = healthCheck.checks.find(c => c.name === 'langsmith');
      
      expect(langflowCheck).toBeDefined();
      expect(n8nCheck).toBeDefined();
      expect(langsmithCheck).toBeDefined();
    });

    it('should handle external service failures', async () => {
      // Mock external service failure
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      const healthCheck = await service.runChecks();
      
      const externalChecks = healthCheck.checks.filter(c => 
        ['langflow', 'n8n', 'langsmith'].includes(c.name)
      );
      
      externalChecks.forEach(check => {
        expect(check.status).toBe(HealthStatus.UNHEALTHY);
        expect(check.message).toContain('not accessible');
      });
    });

    it('should handle external service timeouts', async () => {
      // Mock timeout error
      const timeoutError = new Error('timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValue(timeoutError);

      const healthCheck = await service.runChecks();
      
      const externalChecks = healthCheck.checks.filter(c => 
        ['langflow', 'n8n', 'langsmith'].includes(c.name)
      );
      
      externalChecks.forEach(check => {
        expect(check.status).toBe(HealthStatus.UNHEALTHY);
        expect(check.message).toContain('timeout');
      });
    });
  });

  describe('removeCheck', () => {
    it('should remove a registered health check', () => {
      const customCheck = vi.fn();
      service.registerCheck('removable_check', customCheck);
      
      expect(service.getRegisteredChecks()).toContain('removable_check');
      
      const removed = service.removeCheck('removable_check');
      
      expect(removed).toBe(true);
      expect(service.getRegisteredChecks()).not.toContain('removable_check');
    });

    it('should return false when removing non-existent check', () => {
      const removed = service.removeCheck('non_existent');
      expect(removed).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return the same result as runChecks', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const healthStatus = await service.getHealthStatus();
      const runChecksResult = await service.runChecks();

      expect(healthStatus.service).toBe(runChecksResult.service);
      expect(healthStatus.checks.length).toBe(runChecksResult.checks.length);
    });
  });

  describe('cleanup', () => {
    it('should cleanup Redis connection', async () => {
      // Trigger Redis connection by running checks
      await service.runChecks();
      
      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });
});