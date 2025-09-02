import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MetricsCollectorService } from '../../src/services/metrics-collector.service';
import { MetricType } from '../../src/interfaces/monitoring.interface';
import { MetricSource } from '@robust-ai-orchestrator/shared';
import { createLogger } from 'winston';

// Mock prom-client
vi.mock('prom-client', () => ({
  register: {
    metrics: vi.fn().mockResolvedValue('# Mock Prometheus metrics'),
    clear: vi.fn()
  },
  Counter: vi.fn().mockImplementation(() => ({
    inc: vi.fn(),
    get: vi.fn().mockResolvedValue({ values: [{ value: 10 }] }),
    type: 'counter'
  })),
  Gauge: vi.fn().mockImplementation(() => ({
    set: vi.fn(),
    dec: vi.fn(),
    get: vi.fn().mockResolvedValue({ values: [{ value: 50 }] }),
    type: 'gauge'
  })),
  Histogram: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    get: vi.fn().mockResolvedValue({ values: [{ value: 1.5 }, { value: 2.0 }] }),
    type: 'histogram'
  })),
  Summary: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    get: vi.fn().mockResolvedValue({ values: [{ value: 0.95 }] }),
    type: 'summary'
  })),
  collectDefaultMetrics: vi.fn()
}));

describe('MetricsCollectorService', () => {
  let service: MetricsCollectorService;
  let logger: any;

  beforeEach(() => {
    logger = createLogger({ silent: true });
    service = new MetricsCollectorService(logger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a counter metric', () => {
      expect(() => {
        service.register('test_counter', MetricType.COUNTER, 'Test counter metric');
      }).not.toThrow();
    });

    it('should register a gauge metric', () => {
      expect(() => {
        service.register('test_gauge', MetricType.GAUGE, 'Test gauge metric');
      }).not.toThrow();
    });

    it('should register a histogram metric', () => {
      expect(() => {
        service.register('test_histogram', MetricType.HISTOGRAM, 'Test histogram metric');
      }).not.toThrow();
    });

    it('should register a summary metric', () => {
      expect(() => {
        service.register('test_summary', MetricType.SUMMARY, 'Test summary metric');
      }).not.toThrow();
    });

    it('should throw error for unsupported metric type', () => {
      expect(() => {
        service.register('test_invalid', 'invalid' as MetricType, 'Invalid metric');
      }).toThrow('Unsupported metric type: invalid');
    });
  });

  describe('increment', () => {
    beforeEach(() => {
      service.register('test_counter', MetricType.COUNTER, 'Test counter');
    });

    it('should increment a counter metric', () => {
      expect(() => {
        service.increment('test_counter', { service: 'test' });
      }).not.toThrow();
    });

    it('should handle non-existent metric gracefully', () => {
      expect(() => {
        service.increment('non_existent_metric');
      }).not.toThrow();
    });
  });

  describe('set', () => {
    beforeEach(() => {
      service.register('test_gauge', MetricType.GAUGE, 'Test gauge');
    });

    it('should set a gauge metric value', () => {
      expect(() => {
        service.set('test_gauge', 42, { service: 'test' });
      }).not.toThrow();
    });

    it('should handle non-existent metric gracefully', () => {
      expect(() => {
        service.set('non_existent_metric', 42);
      }).not.toThrow();
    });
  });

  describe('observe', () => {
    beforeEach(() => {
      service.register('test_histogram', MetricType.HISTOGRAM, 'Test histogram');
    });

    it('should observe a histogram metric value', () => {
      expect(() => {
        service.observe('test_histogram', 1.5, { service: 'test' });
      }).not.toThrow();
    });

    it('should handle non-existent metric gracefully', () => {
      expect(() => {
        service.observe('non_existent_metric', 1.5);
      }).not.toThrow();
    });
  });

  describe('collect', () => {
    beforeEach(() => {
      service.register('test_counter', MetricType.COUNTER, 'Test counter');
      service.register('test_gauge', MetricType.GAUGE, 'Test gauge');
      service.register('test_histogram', MetricType.HISTOGRAM, 'Test histogram');
    });

    it('should collect metrics from all registered metrics', async () => {
      const source: MetricSource = {
        service: 'test-service',
        instance: 'test-instance',
        version: '1.0.0',
        environment: 'test'
      };

      const metrics = await service.collect(source);

      expect(metrics).toMatchObject({
        source,
        counters: expect.any(Object),
        gauges: expect.any(Object),
        histograms: expect.any(Object),
        labels: {
          service: 'test-service',
          instance: 'test-instance',
          version: '1.0.0',
          environment: 'test'
        }
      });
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getMetrics', () => {
    it('should return Prometheus metrics string', async () => {
      const metrics = await service.getMetrics();
      expect(metrics).toBe('# Mock Prometheus metrics');
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      service.register('http_requests_total', MetricType.COUNTER, 'HTTP requests');
      service.register('http_request_duration_seconds', MetricType.HISTOGRAM, 'HTTP duration');
      service.register('workflow_executions_total', MetricType.COUNTER, 'Workflow executions');
      service.register('workflow_execution_duration_seconds', MetricType.HISTOGRAM, 'Workflow duration');
      service.register('workflow_execution_errors_total', MetricType.COUNTER, 'Workflow errors');
      service.register('engine_requests_total', MetricType.COUNTER, 'Engine requests');
      service.register('engine_request_duration_seconds', MetricType.HISTOGRAM, 'Engine duration');
      service.register('engine_errors_total', MetricType.COUNTER, 'Engine errors');
      service.register('active_connections', MetricType.GAUGE, 'Active connections');
      service.register('queue_size', MetricType.GAUGE, 'Queue size');
      service.register('memory_usage_bytes', MetricType.GAUGE, 'Memory usage');
    });

    it('should record HTTP request metrics', () => {
      expect(() => {
        service.recordHttpRequest('GET', '200', 150, { endpoint: '/api/test' });
      }).not.toThrow();
    });

    it('should record workflow execution metrics', () => {
      expect(() => {
        service.recordWorkflowExecution('langflow', 'completed', 5000, { workflow: 'test' });
      }).not.toThrow();
    });

    it('should record workflow execution error metrics', () => {
      expect(() => {
        service.recordWorkflowExecution('n8n', 'failed', 2000, { workflow: 'test' });
      }).not.toThrow();
    });

    it('should record engine request metrics', () => {
      expect(() => {
        service.recordEngineRequest('langsmith', '200', 1000, { operation: 'execute' });
      }).not.toThrow();
    });

    it('should record engine error metrics', () => {
      expect(() => {
        service.recordEngineRequest('langflow', 'error', 500, { operation: 'execute' });
      }).not.toThrow();
    });

    it('should update system metrics', () => {
      expect(() => {
        service.updateSystemMetrics(100, 50, 1024 * 1024 * 512);
      }).not.toThrow();
    });
  });
});