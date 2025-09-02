import {
  Metrics,
  MetricSource,
  Alert,
  AlertCondition,
  NotificationConfig,
  DashboardData,
  TimeRange,
  HealthCheck,
  ServiceDiscovery,
  LogEntry,
  Report,
  ReportType
} from '@robust-ai-orchestrator/shared';

export interface IMonitoringService {
  collectMetrics(source: MetricSource, metrics: Metrics): Promise<void>;
  createAlert(condition: AlertCondition, notification: NotificationConfig): Promise<Alert>;
  getDashboardData(dashboardId: string, timeRange: TimeRange): Promise<DashboardData>;
  generateReport(reportType: ReportType, parameters: Record<string, any>): Promise<Report>;
  getSystemHealth(): Promise<HealthCheck[]>;
  getServiceDiscovery(): Promise<ServiceDiscovery>;
}

export interface IMetricsCollector {
  collect(source: MetricSource): Promise<Metrics>;
  register(metricName: string, metricType: MetricType, help: string): void;
  increment(metricName: string, labels?: Record<string, string>): void;
  decrement(metricName: string, labels?: Record<string, string>): void;
  set(metricName: string, value: number, labels?: Record<string, string>): void;
  observe(metricName: string, value: number, labels?: Record<string, string>): void;
  getMetrics(): Promise<string>;
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

export interface IAlertManager {
  createCondition(condition: AlertCondition): Promise<AlertCondition>;
  updateCondition(id: string, condition: Partial<AlertCondition>): Promise<AlertCondition>;
  deleteCondition(id: string): Promise<void>;
  getConditions(): Promise<AlertCondition[]>;
  evaluateConditions(): Promise<Alert[]>;
  acknowledgeAlert(alertId: string, userId: string): Promise<void>;
  resolveAlert(alertId: string): Promise<void>;
}

export interface INotificationService {
  sendNotification(alert: Alert, config: NotificationConfig): Promise<void>;
  testNotification(config: NotificationConfig): Promise<boolean>;
  getNotificationHistory(alertId: string): Promise<NotificationHistory[]>;
}

export interface NotificationHistory {
  id: string;
  alertId: string;
  channel: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt: Date;
  error?: string;
}

export interface IHealthChecker {
  registerCheck(name: string, check: HealthCheckFunction): void;
  runChecks(): Promise<HealthCheck>;
  getHealthStatus(): Promise<HealthCheck>;
}

export type HealthCheckFunction = () => Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metadata?: Record<string, any>;
}>;

export interface IServiceRegistry {
  registerService(service: ServiceRegistration): Promise<void>;
  deregisterService(serviceId: string): Promise<void>;
  getServices(): Promise<ServiceDiscovery>;
  heartbeat(serviceId: string): Promise<void>;
}

export interface ServiceRegistration {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  metadata: Record<string, any>;
  healthCheckUrl?: string;
}

export interface ILogAggregator {
  ingest(logs: LogEntry[]): Promise<void>;
  search(query: LogSearchQuery): Promise<LogSearchResult>;
  getLogStream(filters: LogStreamFilters): AsyncIterable<LogEntry>;
}

export interface LogSearchQuery {
  query: string;
  timeRange: TimeRange;
  services?: string[];
  levels?: string[];
  limit?: number;
  offset?: number;
}

export interface LogSearchResult {
  logs: LogEntry[];
  total: number;
  took: number;
}

export interface LogStreamFilters {
  services?: string[];
  levels?: string[];
  since?: Date;
}

export interface IRealtimeMonitor {
  subscribeToExecutions(callback: (execution: any) => void): string;
  subscribeToMetrics(callback: (metrics: Metrics) => void): string;
  subscribeToAlerts(callback: (alert: Alert) => void): string;
  unsubscribe(subscriptionId: string): void;
  broadcastExecutionUpdate(executionId: string, update: any): void;
  broadcastMetricsUpdate(metrics: Metrics): void;
  broadcastAlert(alert: Alert): void;
}