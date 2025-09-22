import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response } from 'express';

export class MetricsService {
  private static instance: MetricsService;
  
  // HTTP Metrics
  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestsInFlight: Gauge<string>;

  // Workflow Metrics
  public readonly workflowExecutionsTotal: Counter<string>;
  public readonly workflowExecutionDuration: Histogram<string>;
  public readonly workflowExecutionQueueSize: Gauge<string>;
  public readonly workflowsCreatedTotal: Counter<string>;

  // Business Metrics
  public readonly userLoginsTotal: Counter<string>;
  public readonly activeUsers: Gauge<string>;
  public readonly apiCallsTotal: Counter<string>;
  public readonly billingRevenueTotal: Counter<string>;

  // System Metrics
  public readonly databaseConnectionsActive: Gauge<string>;
  public readonly cacheHitRate: Gauge<string>;
  public readonly queueDepth: Gauge<string>;

  // Engine-specific Metrics
  public readonly engineCallsTotal: Counter<string>;
  public readonly engineCallDuration: Histogram<string>;
  public readonly engineErrorsTotal: Counter<string>;

  constructor() {
    // Enable default metrics collection
    collectDefaultMetrics({ register });

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [register],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['service'],
      registers: [register],
    });

    // Workflow Metrics
    this.workflowExecutionsTotal = new Counter({
      name: 'workflow_executions_total',
      help: 'Total number of workflow executions',
      labelNames: ['workflow_id', 'workflow_name', 'engine_type', 'status', 'user_id'],
      registers: [register],
    });

    this.workflowExecutionDuration = new Histogram({
      name: 'workflow_execution_duration_seconds',
      help: 'Duration of workflow executions in seconds',
      labelNames: ['workflow_id', 'engine_type', 'status'],
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
      registers: [register],
    });

    this.workflowExecutionQueueSize = new Gauge({
      name: 'execution_queue_size',
      help: 'Number of workflow executions in queue',
      labelNames: ['priority'],
      registers: [register],
    });

    this.workflowsCreatedTotal = new Counter({
      name: 'workflows_created_total',
      help: 'Total number of workflows created',
      labelNames: ['engine_type', 'user_id', 'organization_id'],
      registers: [register],
    });

    // Business Metrics
    this.userLoginsTotal = new Counter({
      name: 'user_logins_total',
      help: 'Total number of user logins',
      labelNames: ['auth_method', 'organization_id'],
      registers: [register],
    });

    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of active users',
      labelNames: ['time_window'],
      registers: [register],
    });

    this.apiCallsTotal = new Counter({
      name: 'api_requests_total',
      help: 'Total number of API calls',
      labelNames: ['endpoint', 'method', 'user_id', 'api_key_id'],
      registers: [register],
    });

    this.billingRevenueTotal = new Counter({
      name: 'billing_revenue_total',
      help: 'Total billing revenue',
      labelNames: ['plan_type', 'organization_id'],
      registers: [register],
    });

    // System Metrics
    this.databaseConnectionsActive = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      labelNames: ['database', 'pool'],
      registers: [register],
    });

    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [register],
    });

    this.queueDepth = new Gauge({
      name: 'queue_depth',
      help: 'Number of items in queue',
      labelNames: ['queue_name'],
      registers: [register],
    });

    // Engine-specific Metrics
    this.engineCallsTotal = new Counter({
      name: 'engine_calls_total',
      help: 'Total number of engine API calls',
      labelNames: ['engine_type', 'operation', 'status'],
      registers: [register],
    });

    this.engineCallDuration = new Histogram({
      name: 'engine_call_duration_seconds',
      help: 'Duration of engine API calls in seconds',
      labelNames: ['engine_type', 'operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [register],
    });

    this.engineErrorsTotal = new Counter({
      name: 'engine_errors_total',
      help: 'Total number of engine errors',
      labelNames: ['engine_type', 'error_type', 'error_code'],
      registers: [register],
    });
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  public getMetrics(): Promise<string> {
    return register.metrics();
  }

  public clearMetrics(): void {
    register.clear();
  }

  // Helper methods for common metric operations
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    service: string
  ): void {
    const labels = { method, route, status_code: statusCode.toString(), service };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
  }

  public recordWorkflowExecution(
    workflowId: string,
    workflowName: string,
    engineType: string,
    status: string,
    duration: number,
    userId: string
  ): void {
    const labels = { workflow_id: workflowId, workflow_name: workflowName, engine_type: engineType, status, user_id: userId };
    this.workflowExecutionsTotal.inc(labels);
    this.workflowExecutionDuration.observe({ workflow_id: workflowId, engine_type: engineType, status }, duration);
  }

  public recordEngineCall(
    engineType: string,
    operation: string,
    status: string,
    duration: number,
    errorType?: string,
    errorCode?: string
  ): void {
    this.engineCallsTotal.inc({ engine_type: engineType, operation, status });
    this.engineCallDuration.observe({ engine_type: engineType, operation }, duration);
    
    if (status === 'error' && errorType && errorCode) {
      this.engineErrorsTotal.inc({ engine_type: engineType, error_type: errorType, error_code: errorCode });
    }
  }

  public updateQueueSize(queueName: string, size: number): void {
    this.queueDepth.set({ queue_name: queueName }, size);
  }

  public updateActiveUsers(timeWindow: string, count: number): void {
    this.activeUsers.set({ time_window: timeWindow }, count);
  }

  public updateCacheHitRate(cacheType: string, hitRate: number): void {
    this.cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }

  public updateDatabaseConnections(database: string, pool: string, count: number): void {
    this.databaseConnectionsActive.set({ database, pool }, count);
  }
}

// Express middleware for automatic HTTP metrics collection
export function createMetricsMiddleware(serviceName: string) {
  const metrics = MetricsService.getInstance();

  return (req: Request, res: Response, next: Function) => {
    const startTime = Date.now();
    
    // Increment in-flight requests
    metrics.httpRequestsInFlight.inc({ service: serviceName });

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = (Date.now() - startTime) / 1000;
      
      // Record metrics
      metrics.recordHttpRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration,
        serviceName
      );

      // Decrement in-flight requests
      metrics.httpRequestsInFlight.dec({ service: serviceName });

      // Call original end method
      originalEnd.apply(this, args);
    };

    next();
  };
}

// Metrics endpoint handler
export function createMetricsHandler() {
  const metrics = MetricsService.getInstance();
  
  return async (req: Request, res: Response) => {
    try {
      const metricsData = await metrics.getMetrics();
      res.set('Content-Type', register.contentType);
      res.end(metricsData);
    } catch (error) {
      res.status(500).end(error);
    }
  };
}