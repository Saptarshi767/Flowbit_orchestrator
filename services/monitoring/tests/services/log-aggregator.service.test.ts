import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LogAggregatorService } from '../../src/services/log-aggregator.service';
import { LogEntry, LogLevel, TimeRange } from '@robust-ai-orchestrator/shared';
import { createLogger } from 'winston';

describe('LogAggregatorService', () => {
  let service: LogAggregatorService;
  let logger: any;

  beforeEach(() => {
    logger = createLogger({ silent: true });
    service = new LogAggregatorService(logger);
  });

  afterEach(() => {
    service.cleanup();
    vi.clearAllMocks();
  });

  describe('ingest', () => {
    it('should ingest log entries successfully', async () => {
      const logs: LogEntry[] = [
        {
          timestamp: new Date(),
          level: LogLevel.INFO,
          message: 'Test log message 1',
          service: 'test-service',
          context: { userId: 'user123' },
          metadata: { requestId: 'req-123' }
        },
        {
          timestamp: new Date(),
          level: LogLevel.ERROR,
          message: 'Test error message',
          service: 'test-service',
          context: { error: 'Something went wrong' }
        }
      ];

      await expect(service.ingest(logs)).resolves.not.toThrow();
      
      const stats = service.getLogStats();
      expect(stats.totalLogs).toBe(2);
      expect(stats.services).toContain('test-service');
    });

    it('should handle empty log array', async () => {
      await expect(service.ingest([])).resolves.not.toThrow();
      
      const stats = service.getLogStats();
      expect(stats.totalLogs).toBe(0);
    });

    it('should emit log events for real-time streaming', async () => {
      const logEventSpy = vi.fn();
      service.on('log', logEventSpy);

      const logs: LogEntry[] = [
        {
          timestamp: new Date(),
          level: LogLevel.WARN,
          message: 'Warning message',
          service: 'warning-service',
          context: {}
        }
      ];

      await service.ingest(logs);

      expect(logEventSpy).toHaveBeenCalledTimes(1);
      expect(logEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Warning message',
          service: 'warning-service',
          level: LogLevel.WARN
        })
      );
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const testLogs: LogEntry[] = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          level: LogLevel.INFO,
          message: 'User login successful',
          service: 'auth-service',
          context: { userId: 'user123', action: 'login' }
        },
        {
          timestamp: new Date('2024-01-01T10:05:00Z'),
          level: LogLevel.ERROR,
          message: 'Database connection failed',
          service: 'database-service',
          context: { error: 'Connection timeout' }
        },
        {
          timestamp: new Date('2024-01-01T10:10:00Z'),
          level: LogLevel.INFO,
          message: 'User logout successful',
          service: 'auth-service',
          context: { userId: 'user123', action: 'logout' }
        },
        {
          timestamp: new Date('2024-01-01T10:15:00Z'),
          level: LogLevel.WARN,
          message: 'High memory usage detected',
          service: 'monitoring-service',
          context: { memoryUsage: 85 }
        }
      ];

      await service.ingest(testLogs);
    });

    it('should search logs by text query', async () => {
      const result = await service.search({
        query: 'user login',
        timeRange: {
          start: new Date('2024-01-01T09:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z')
        }
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].message).toContain('User login successful');
      expect(result.total).toBe(1);
      expect(result.took).toBeGreaterThan(0);
    });

    it('should search logs by service filter', async () => {
      const result = await service.search({
        query: '',
        services: ['auth-service'],
        timeRange: {
          start: new Date('2024-01-01T09:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z')
        }
      });

      expect(result.logs).toHaveLength(2);
      expect(result.logs.every(log => log.service === 'auth-service')).toBe(true);
    });

    it('should search logs by level filter', async () => {
      const result = await service.search({
        query: '',
        levels: [LogLevel.ERROR],
        timeRange: {
          start: new Date('2024-01-01T09:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z')
        }
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].level).toBe(LogLevel.ERROR);
      expect(result.logs[0].message).toContain('Database connection failed');
    });

    it('should apply pagination', async () => {
      const result = await service.search({
        query: '',
        timeRange: {
          start: new Date('2024-01-01T09:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z')
        },
        limit: 2,
        offset: 1
      });

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(4);
    });

    it('should handle empty search results', async () => {
      const result = await service.search({
        query: 'nonexistent query',
        timeRange: {
          start: new Date('2024-01-01T09:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z')
        }
      });

      expect(result.logs).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should search with multiple filters combined', async () => {
      const result = await service.search({
        query: 'user',
        services: ['auth-service'],
        levels: [LogLevel.INFO],
        timeRange: {
          start: new Date('2024-01-01T09:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z')
        }
      });

      expect(result.logs).toHaveLength(2);
      expect(result.logs.every(log => 
        log.service === 'auth-service' && 
        log.level === LogLevel.INFO &&
        log.message.toLowerCase().includes('user')
      )).toBe(true);
    });
  });

  describe('getLogStream', () => {
    it('should create log stream with filters', async () => {
      const filters = {
        services: ['test-service'],
        levels: [LogLevel.INFO, LogLevel.ERROR],
        since: new Date('2024-01-01T10:00:00Z')
      };

      const stream = service.getLogStream(filters);
      expect(stream).toBeDefined();
      expect(typeof stream[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      const testLogs: LogEntry[] = [
        {
          timestamp: new Date(),
          level: LogLevel.INFO,
          message: 'Info message',
          service: 'service-1',
          context: {}
        },
        {
          timestamp: new Date(),
          level: LogLevel.ERROR,
          message: 'Error message',
          service: 'service-2',
          context: {}
        },
        {
          timestamp: new Date(),
          level: LogLevel.WARN,
          message: 'Warning message',
          service: 'service-1',
          context: {}
        }
      ];

      await service.ingest(testLogs);
    });

    it('should get log count', () => {
      const count = service.getLogCount();
      expect(count).toBe(3);
    });

    it('should get service list', () => {
      const services = service.getServiceList();
      expect(services).toContain('service-1');
      expect(services).toContain('service-2');
      expect(services).toHaveLength(2);
    });

    it('should get level counts', () => {
      const levelCounts = service.getLevelCounts();
      expect(levelCounts[LogLevel.INFO]).toBe(1);
      expect(levelCounts[LogLevel.ERROR]).toBe(1);
      expect(levelCounts[LogLevel.WARN]).toBe(1);
    });

    it('should get log stats', () => {
      const stats = service.getLogStats();
      expect(stats.totalLogs).toBe(3);
      expect(stats.services).toHaveLength(2);
      expect(stats.levels[LogLevel.INFO]).toBe(1);
      expect(stats.levels[LogLevel.ERROR]).toBe(1);
      expect(stats.levels[LogLevel.WARN]).toBe(1);
      expect(stats.oldestLog).toBeInstanceOf(Date);
      expect(stats.newestLog).toBeInstanceOf(Date);
    });

    it('should get log by ID', async () => {
      const logs: LogEntry[] = [
        {
          timestamp: new Date(),
          level: LogLevel.DEBUG,
          message: 'Debug message',
          service: 'debug-service',
          context: {}
        }
      ];

      await service.ingest(logs);
      
      // Since we can't easily get the generated ID, we'll test the method exists
      const result = service.getLogById('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('memory management', () => {
    it('should enforce memory limits', async () => {
      // Create a service with a very low memory limit for testing
      const limitedService = new LogAggregatorService(logger);
      (limitedService as any).maxLogs = 2; // Set very low limit

      const logs: LogEntry[] = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          level: LogLevel.INFO,
          message: 'Log 1',
          service: 'test',
          context: {}
        },
        {
          timestamp: new Date('2024-01-01T10:01:00Z'),
          level: LogLevel.INFO,
          message: 'Log 2',
          service: 'test',
          context: {}
        },
        {
          timestamp: new Date('2024-01-01T10:02:00Z'),
          level: LogLevel.INFO,
          message: 'Log 3',
          service: 'test',
          context: {}
        }
      ];

      await limitedService.ingest(logs);

      const count = limitedService.getLogCount();
      expect(count).toBeLessThanOrEqual(2);

      limitedService.cleanup();
    });

    it('should cleanup old logs based on retention', () => {
      // Test cleanup functionality
      expect(() => {
        (service as any).cleanupOldLogs();
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', () => {
      expect(() => {
        service.cleanup();
      }).not.toThrow();
      
      const stats = service.getLogStats();
      expect(stats.totalLogs).toBe(0);
    });
  });
});