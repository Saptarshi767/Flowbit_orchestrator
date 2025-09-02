import { register, Counter, Gauge, Histogram, Summary, collectDefaultMetrics } from 'prom-client';
import { IMetricsCollector, MetricType } from '../interfaces/monitoring.interface';
import { Metrics, MetricSource } from '@robust-ai-orchestrator/shared';
import { Logger } from 'winston';

export class MetricsCollectorService implements IMetricsCollector {
  private metrics: Map<string, any> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    
    // Collect default Node.js metrics
    collectDefaultMetrics({
      register,
      prefix: 'robust_ai_orchestrator_',
    });

    // Register custom application metrics
    this.registerDefaultMetrics();
  }

  private registerDefaultMetrics(): void {
    // HTTP request metrics
    this.register('http_requests_total', MetricType.COUNTER, 'Total number of HTTP requests');
    this.register('http_request_duration_seconds', MetricType.HISTOGRAM, 'HTTP request duration in seconds');
    
    // Workflow execution metrics
    this.register('workflow_executions_total', MetricType.COUNTER, 'Total number of workflow executions');
    this.register('workflow_execution_duration_seconds', MetricType.HISTOGRAM, 'Workflow execution duration in seconds');
    this.register('workflow_execution_errors_total', MetricType.COUNTER, 'Total number of workflow execution errors');
    
    // System metrics
    this.register('active_connections', MetricType.GAUGE, 'Number of active connections');
    this.register('queue_size', MetricType.GAUGE, 'Current queue size');
    this.register('memory_usage_bytes', MetricType.GAUGE, 'Memory usage in bytes');
    
    // Engine-specific metrics
    this.register('engine_requests_total', MetricType.COUNTER, 'Total requests to workflow engines');
    this.register('engine_request_duration_seconds', MetricType.HISTOGRAM, 'Engine request duration in seconds');
    this.register('engine_errors_total', MetricType.COUNTER, 'Total engine errors');
  }

  register(metricName: string, metricType: MetricType, help: string): void {
    try {
      let metric;
      
      switch (metricType) {
        case MetricType.COUNTER:
          metric = new Counter({
            name: metricName,
            help,
            labelNames: ['service', 'method', 'status', 'engine', 'organization']
          });
          break;
          
        case MetricType.GAUGE:
          metric = new Gauge({
            name: metricName,
            help,
            labelNames: ['service', 'instance', 'organization']
          });
          break;
          
        case MetricType.HISTOGRAM:
          metric = new Histogram({
            name: metricName,
            help,
            labelNames: ['service', 'method', 'status', 'engine', 'organization'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
          });
          break;
          
        case MetricType.SUMMARY:
          metric = new Summary({
            name: metricName,
            help,
            labelNames: ['service', 'method', 'status', 'engine', 'organization'],
            percentiles: [0.5, 0.9, 0.95, 0.99]
          });
          break;
          
        default:
          throw new Error(`Unsupported metric type: ${metricType}`);
      }
      
      this.metrics.set(metricName, metric);
      this.logger.debug(`Registered metric: ${metricName} (${metricType})`);
    } catch (error) {
      this.logger.error(`Failed to register metric ${metricName}:`, error);
      throw error;
    }
  }

  increment(metricName: string, labels: Record<string, string> = {}): void {
    try {
      const metric = this.metrics.get(metricName);
      if (!metric) {
        this.logger.warn(`Metric not found: ${metricName}`);
        return;
      }
      
      if (metric.inc) {
        metric.inc(labels);
      } else {
        this.logger.warn(`Metric ${metricName} does not support increment operation`);
      }
    } catch (error) {
      this.logger.error(`Failed to increment metric ${metricName}:`, error);
    }
  }

  decrement(metricName: string, labels: Record<string, string> = {}): void {
    try {
      const metric = this.metrics.get(metricName);
      if (!metric) {
        this.logger.warn(`Metric not found: ${metricName}`);
        return;
      }
      
      if (metric.dec) {
        metric.dec(labels);
      } else {
        this.logger.warn(`Metric ${metricName} does not support decrement operation`);
      }
    } catch (error) {
      this.logger.error(`Failed to decrement metric ${metricName}:`, error);
    }
  }

  set(metricName: string, value: number, labels: Record<string, string> = {}): void {
    try {
      const metric = this.metrics.get(metricName);
      if (!metric) {
        this.logger.warn(`Metric not found: ${metricName}`);
        return;
      }
      
      if (metric.set) {
        metric.set(labels, value);
      } else {
        this.logger.warn(`Metric ${metricName} does not support set operation`);
      }
    } catch (error) {
      this.logger.error(`Failed to set metric ${metricName}:`, error);
    }
  }

  observe(metricName: string, value: number, labels: Record<string, string> = {}): void {
    try {
      const metric = this.metrics.get(metricName);
      if (!metric) {
        this.logger.warn(`Metric not found: ${metricName}`);
        return;
      }
      
      if (metric.observe) {
        metric.observe(labels, value);
      } else {
        this.logger.warn(`Metric ${metricName} does not support observe operation`);
      }
    } catch (error) {
      this.logger.error(`Failed to observe metric ${metricName}:`, error);
    }
  }

  async collect(source: MetricSource): Promise<Metrics> {
    try {
      const timestamp = new Date();
      const counters: Record<string, number> = {};
      const gauges: Record<string, number> = {};
      const histograms: Record<string, number[]> = {};
      
      // Collect current metric values
      for (const [name, metric] of this.metrics.entries()) {
        try {
          const metricValue = await metric.get();
          
          if (metric.type === 'counter') {
            counters[name] = metricValue.values?.[0]?.value || 0;
          } else if (metric.type === 'gauge') {
            gauges[name] = metricValue.values?.[0]?.value || 0;
          } else if (metric.type === 'histogram') {
            histograms[name] = metricValue.values?.map((v: any) => v.value) || [];
          }
        } catch (error) {
          this.logger.warn(`Failed to collect metric ${name}:`, error);
        }
      }
      
      return {
        timestamp,
        source,
        counters,
        gauges,
        histograms,
        labels: {
          service: source.service,
          instance: source.instance,
          version: source.version,
          environment: source.environment
        }
      };
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
      throw error;
    }
  }

  async getMetrics(): Promise<string> {
    try {
      return await register.metrics();
    } catch (error) {
      this.logger.error('Failed to get Prometheus metrics:', error);
      throw error;
    }
  }

  // Utility methods for common metric operations
  recordHttpRequest(method: string, status: string, duration: number, labels: Record<string, string> = {}): void {
    const httpLabels = { method, status, ...labels };
    this.increment('http_requests_total', httpLabels);
    this.observe('http_request_duration_seconds', duration / 1000, httpLabels);
  }

  recordWorkflowExecution(engine: string, status: string, duration: number, labels: Record<string, string> = {}): void {
    const workflowLabels = { engine, status, ...labels };
    this.increment('workflow_executions_total', workflowLabels);
    this.observe('workflow_execution_duration_seconds', duration / 1000, workflowLabels);
    
    if (status === 'failed' || status === 'error') {
      this.increment('workflow_execution_errors_total', workflowLabels);
    }
  }

  recordEngineRequest(engine: string, status: string, duration: number, labels: Record<string, string> = {}): void {
    const engineLabels = { engine, status, ...labels };
    this.increment('engine_requests_total', engineLabels);
    this.observe('engine_request_duration_seconds', duration / 1000, engineLabels);
    
    if (status === 'failed' || status === 'error') {
      this.increment('engine_errors_total', engineLabels);
    }
  }

  updateSystemMetrics(activeConnections: number, queueSize: number, memoryUsage: number): void {
    this.set('active_connections', activeConnections);
    this.set('queue_size', queueSize);
    this.set('memory_usage_bytes', memoryUsage);
  }
}