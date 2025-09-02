/**
 * Type definitions for the Robust AI Orchestrator SDK
 */
export type EngineType = 'langflow' | 'n8n' | 'langsmith';
export type UserRole = 'admin' | 'user' | 'viewer';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'resolved' | 'acknowledged';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface ApiError {
    code: string;
    message: string;
    details?: any;
    field?: string;
}
export interface ResponseMeta {
    correlationId: string;
    timestamp: string;
    version: string;
    pagination?: PaginationMeta;
}
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta: ResponseMeta;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: User;
}
export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    organizationName?: string;
}
export interface RegisterResponse {
    user: User;
    message: string;
}
export interface RefreshTokenRequest {
    refreshToken: string;
}
export interface TokenResponse {
    accessToken: string;
    expiresIn: number;
}
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId: string;
    permissions: string[];
    preferences: Record<string, any>;
    createdAt: string;
    lastLoginAt: string;
}
export interface UpdateUserProfileRequest {
    name?: string;
    preferences?: Record<string, any>;
}
export interface Organization {
    id: string;
    name: string;
    plan: string;
    settings: Record<string, any>;
    members: OrganizationMember[];
    createdAt: string;
}
export interface OrganizationMember {
    userId: string;
    role: UserRole;
    joinedAt: string;
}
export interface Workflow {
    id: string;
    name: string;
    description?: string;
    engineType: EngineType;
    definition: Record<string, any>;
    version: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    isPublic: boolean;
    organizationId: string;
    collaborators?: Collaborator[];
}
export interface Collaborator {
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    addedAt: string;
}
export interface WorkflowVersion {
    id: string;
    workflowId: string;
    version: number;
    definition: Record<string, any>;
    changeLog: string;
    createdBy: string;
    createdAt: string;
}
export interface CreateWorkflowRequest {
    name: string;
    description?: string;
    engineType: EngineType;
    definition: Record<string, any>;
    tags?: string[];
    isPublic?: boolean;
}
export interface UpdateWorkflowRequest {
    name?: string;
    description?: string;
    definition?: Record<string, any>;
    tags?: string[];
    isPublic?: boolean;
}
export interface Execution {
    id: string;
    workflowId: string;
    workflowVersion: number;
    status: ExecutionStatus;
    startTime: string;
    endTime?: string;
    parameters: Record<string, any>;
    result?: Record<string, any>;
    logs?: ExecutionLog[];
    metrics?: ExecutionMetrics;
    executorId: string;
    userId: string;
}
export interface ExecutionLog {
    timestamp: string;
    level: LogLevel;
    message: string;
    metadata?: Record<string, any>;
}
export interface ExecutionMetrics {
    duration?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    networkRequests?: number;
    errors?: number;
}
export interface ExecuteWorkflowRequest {
    workflowId: string;
    parameters?: Record<string, any>;
    version?: number;
}
export interface MetricDataPoint {
    timestamp: string;
    value: number;
}
export interface Metric {
    name: string;
    unit?: string;
    dataPoints: MetricDataPoint[];
}
export interface Alert {
    id: string;
    title: string;
    description?: string;
    severity: AlertSeverity;
    status: AlertStatus;
    createdAt: string;
    resolvedAt?: string;
    metadata?: Record<string, any>;
}
export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    services?: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
}
export interface MarketplaceWorkflow {
    id: string;
    name: string;
    description: string;
    author: string;
    category: string;
    tags: string[];
    rating: number;
    downloads: number;
    price: number;
    createdAt: string;
    screenshots?: string[];
    documentation?: string;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
}
export interface SortParams {
    sort?: string;
}
export interface WorkflowListParams extends PaginationParams, SortParams {
    engineType?: EngineType;
    tags?: string;
    search?: string;
}
export interface ExecutionListParams extends PaginationParams, SortParams {
    workflowId?: string;
    status?: ExecutionStatus;
    startDate?: string;
    endDate?: string;
}
export interface UserListParams extends PaginationParams, SortParams {
    role?: UserRole;
    organizationId?: string;
}
export interface AlertListParams extends PaginationParams {
    severity?: AlertSeverity;
    status?: AlertStatus;
}
export interface MetricsParams {
    timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
    metrics?: string;
}
export interface ExecutionLogsParams {
    level?: LogLevel;
    startTime?: string;
    endTime?: string;
}
export interface MarketplaceParams extends PaginationParams {
    category?: string;
    tags?: string;
    search?: string;
    sortBy?: 'popularity' | 'rating' | 'recent' | 'name';
}
export interface ApiConfig {
    baseUrl: string;
    apiKey?: string;
    accessToken?: string;
    version?: string;
    timeout?: number;
    retries?: number;
}
export interface RequestOptions {
    retries?: number;
    timeout?: number;
    headers?: Record<string, string>;
}
export interface WebhookEvent {
    id: string;
    type: string;
    data: Record<string, any>;
    timestamp: string;
    source: string;
}
export interface WebhookConfig {
    url: string;
    events: string[];
    secret?: string;
    active: boolean;
}
export declare class ApiError extends Error {
    code: string;
    details?: any;
    statusCode?: number;
    constructor(message: string, code: string, details?: any, statusCode?: number);
}
export declare class ValidationError extends ApiError {
    constructor(message: string, field?: string, details?: any);
}
export declare class AuthenticationError extends ApiError {
    constructor(message?: string);
}
export declare class AuthorizationError extends ApiError {
    constructor(message?: string);
}
export declare class NotFoundError extends ApiError {
    constructor(message?: string);
}
export declare class RateLimitError extends ApiError {
    readonly resetTime?: string;
    constructor(message: string, resetTime?: string);
}
export interface ExecutionStatusEvent {
    executionId: string;
    status: ExecutionStatus;
    timestamp: string;
    progress?: number;
    message?: string;
}
export interface WorkflowUpdateEvent {
    workflowId: string;
    version: number;
    changeType: 'created' | 'updated' | 'deleted';
    timestamp: string;
    userId: string;
}
export interface SystemAlertEvent {
    alertId: string;
    severity: AlertSeverity;
    title: string;
    description: string;
    timestamp: string;
}
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type SuccessResponse<T> = ApiResponse<T> & {
    success: true;
    data: T;
};
export type ErrorResponse = ApiResponse<never> & {
    success: false;
    error: ApiError;
};
export type ListResponse<T> = SuccessResponse<{
    items: T[];
    pagination: PaginationMeta;
}>;
export type WorkflowResponse = SuccessResponse<Workflow>;
export type WorkflowListResponse = SuccessResponse<{
    workflows: Workflow[];
}>;
export type ExecutionResponse = SuccessResponse<Execution>;
export type ExecutionListResponse = SuccessResponse<{
    executions: Execution[];
}>;
export type UserResponse = SuccessResponse<User>;
export type UserListResponse = SuccessResponse<{
    users: User[];
}>;
export type HealthResponse = SuccessResponse<SystemHealth>;
export type MetricsResponse = SuccessResponse<{
    metrics: Metric[];
}>;
export type AlertListResponse = SuccessResponse<{
    alerts: Alert[];
}>;
export type MarketplaceResponse = SuccessResponse<{
    workflows: MarketplaceWorkflow[];
}>;
//# sourceMappingURL=types.d.ts.map