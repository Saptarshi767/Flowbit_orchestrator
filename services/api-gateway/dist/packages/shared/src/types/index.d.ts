export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId: string;
    permissions: Permission[];
    createdAt: Date;
    lastLoginAt?: Date;
}
export declare enum UserRole {
    ADMIN = "admin",
    USER = "user",
    VIEWER = "viewer"
}
export interface Permission {
    resource: string;
    actions: string[];
}
export interface JWTPayload {
    userId: string;
    email: string;
    role: UserRole;
    organizationId: string;
    permissions: Permission[];
    iat: number;
    exp: number;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        correlationId: string;
        timestamp: string;
        version: string;
    };
}
export interface RateLimitConfig {
    windowMs: number;
    max: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}
export interface LogContext {
    correlationId: string;
    userId?: string;
    organizationId?: string;
    method: string;
    url: string;
    userAgent?: string;
    ip: string;
}
export declare enum EngineType {
    LANGFLOW = "langflow",
    N8N = "n8n",
    LANGSMITH = "langsmith"
}
export interface WorkflowDefinition {
    id?: string;
    name: string;
    description?: string;
    engineType: EngineType;
    definition: any;
    version?: number;
    metadata?: Record<string, any>;
}
export interface WorkflowParameters {
    [key: string]: any;
}
export interface ExecutionResult {
    id: string;
    status: ExecutionStatus;
    result?: any;
    error?: ExecutionError;
    startTime: Date;
    endTime?: Date;
    logs?: ExecutionLog[];
    metrics?: ExecutionMetrics;
}
export declare enum ExecutionStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export interface ExecutionError {
    code: string;
    message: string;
    details?: any;
    stack?: string;
    engineError?: any;
}
export interface ExecutionLog {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    context?: Record<string, any>;
}
export interface ExecutionMetrics {
    duration?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    networkCalls?: number;
    customMetrics?: Record<string, number>;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
}
export interface ValidationWarning {
    field: string;
    message: string;
    code: string;
}
export interface CancellationResult {
    success: boolean;
    message?: string;
    error?: string;
}
export interface RetryConfig {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    retryableErrors: string[];
}
export interface MetricSource {
    service: string;
    instance: string;
    version: string;
    environment: string;
}
export interface Metrics {
    timestamp: Date;
    source: MetricSource;
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, number[]>;
    labels: Record<string, string>;
}
export interface AlertCondition {
    id: string;
    name: string;
    description: string;
    metric: string;
    operator: AlertOperator;
    threshold: number;
    duration: number;
    severity: AlertSeverity;
    enabled: boolean;
}
export declare enum AlertOperator {
    GREATER_THAN = "gt",
    LESS_THAN = "lt",
    EQUALS = "eq",
    NOT_EQUALS = "ne",
    GREATER_THAN_OR_EQUAL = "gte",
    LESS_THAN_OR_EQUAL = "lte"
}
export declare enum AlertSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface Alert {
    id: string;
    conditionId: string;
    status: AlertStatus;
    triggeredAt: Date;
    resolvedAt?: Date;
    message: string;
    value: number;
    threshold: number;
    severity: AlertSeverity;
    metadata: Record<string, any>;
}
export declare enum AlertStatus {
    TRIGGERED = "triggered",
    RESOLVED = "resolved",
    ACKNOWLEDGED = "acknowledged"
}
export interface NotificationConfig {
    channels: NotificationChannel[];
    template?: string;
    throttle?: number;
}
export interface NotificationChannel {
    type: NotificationChannelType;
    config: Record<string, any>;
    enabled: boolean;
}
export declare enum NotificationChannelType {
    EMAIL = "email",
    SLACK = "slack",
    WEBHOOK = "webhook",
    SMS = "sms"
}
export interface DashboardData {
    id: string;
    name: string;
    widgets: DashboardWidget[];
    timeRange: TimeRange;
    refreshInterval: number;
}
export interface DashboardWidget {
    id: string;
    type: WidgetType;
    title: string;
    query: string;
    config: Record<string, any>;
    position: WidgetPosition;
}
export declare enum WidgetType {
    LINE_CHART = "line_chart",
    BAR_CHART = "bar_chart",
    GAUGE = "gauge",
    COUNTER = "counter",
    TABLE = "table",
    HEATMAP = "heatmap"
}
export interface WidgetPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface HealthCheck {
    service: string;
    status: HealthStatus;
    timestamp: Date;
    checks: HealthCheckResult[];
    metadata?: Record<string, any>;
}
export declare enum HealthStatus {
    HEALTHY = "healthy",
    DEGRADED = "degraded",
    UNHEALTHY = "unhealthy"
}
export interface HealthCheckResult {
    name: string;
    status: HealthStatus;
    message?: string;
    duration: number;
    metadata?: Record<string, any>;
}
export interface ServiceDiscovery {
    services: ServiceInfo[];
    lastUpdated: Date;
}
export interface ServiceInfo {
    name: string;
    version: string;
    instances: ServiceInstance[];
    healthStatus: HealthStatus;
}
export interface ServiceInstance {
    id: string;
    host: string;
    port: number;
    status: InstanceStatus;
    metadata: Record<string, any>;
    lastSeen: Date;
}
export declare enum InstanceStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    DRAINING = "draining"
}
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    service: string;
    message: string;
    context: LogContext;
    metadata?: Record<string, any>;
}
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
    FATAL = "fatal"
}
export interface ReportType {
    id: string;
    name: string;
    description: string;
    template: string;
    parameters: ReportParameter[];
}
export interface ReportParameter {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    required: boolean;
    defaultValue?: any;
}
export interface Report {
    id: string;
    type: string;
    generatedAt: Date;
    parameters: Record<string, any>;
    data: any;
    format: ReportFormat;
}
export declare enum ReportFormat {
    JSON = "json",
    CSV = "csv",
    PDF = "pdf",
    HTML = "html"
}
//# sourceMappingURL=index.d.ts.map