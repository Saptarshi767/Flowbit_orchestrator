/**
 * Robust AI Orchestrator TypeScript/JavaScript SDK
 *
 * This SDK provides a convenient interface for interacting with the
 * Robust AI Orchestrator API from TypeScript and JavaScript applications.
 */
export interface ApiConfig {
    baseUrl: string;
    apiKey?: string;
    accessToken?: string;
    version?: string;
    timeout?: number;
    retries?: number;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta: {
        correlationId: string;
        timestamp: string;
        version: string;
        pagination?: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    };
}
export interface Workflow {
    id: string;
    name: string;
    description?: string;
    engineType: 'langflow' | 'n8n' | 'langsmith';
    definition: any;
    version: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    isPublic: boolean;
    organizationId: string;
}
export interface Execution {
    id: string;
    workflowId: string;
    workflowVersion: number;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: string;
    endTime?: string;
    parameters: any;
    result?: any;
    metrics?: any;
    executorId: string;
    userId: string;
}
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user' | 'viewer';
    organizationId: string;
    permissions: string[];
    preferences: any;
    createdAt: string;
    lastLoginAt: string;
}
export declare class RobustAIOrchestrator {
    private config;
    private correlationId;
    constructor(config: ApiConfig);
    private generateCorrelationId;
    private makeRequest;
    login(email: string, password: string): Promise<ApiResponse<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        user: User;
    }>>;
    register(userData: {
        email: string;
        password: string;
        name: string;
        organizationName?: string;
    }): Promise<ApiResponse<{
        user: User;
        message: string;
    }>>;
    refreshToken(refreshToken: string): Promise<ApiResponse<{
        accessToken: string;
        expiresIn: number;
    }>>;
    logout(): Promise<ApiResponse<{
        message: string;
    }>>;
    getUserProfile(): Promise<ApiResponse<User>>;
    updateUserProfile(updates: Partial<User>): Promise<ApiResponse<User>>;
    listUsers(params?: {
        page?: number;
        limit?: number;
        role?: string;
        organizationId?: string;
    }): Promise<ApiResponse<{
        users: User[];
    }>>;
    listWorkflows(params?: {
        page?: number;
        limit?: number;
        engineType?: 'langflow' | 'n8n' | 'langsmith';
        tags?: string;
        search?: string;
    }): Promise<ApiResponse<{
        workflows: Workflow[];
    }>>;
    getWorkflow(workflowId: string): Promise<ApiResponse<Workflow>>;
    createWorkflow(workflow: {
        name: string;
        description?: string;
        engineType: 'langflow' | 'n8n' | 'langsmith';
        definition: any;
        tags?: string[];
        isPublic?: boolean;
    }): Promise<ApiResponse<Workflow>>;
    updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<ApiResponse<Workflow>>;
    deleteWorkflow(workflowId: string): Promise<ApiResponse<void>>;
    getWorkflowVersions(workflowId: string, params?: {
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<{
        versions: any[];
    }>>;
    listExecutions(params?: {
        page?: number;
        limit?: number;
        workflowId?: string;
        status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
        startDate?: string;
        endDate?: string;
    }): Promise<ApiResponse<{
        executions: Execution[];
    }>>;
    executeWorkflow(request: {
        workflowId: string;
        parameters?: any;
        version?: number;
    }): Promise<ApiResponse<Execution>>;
    getExecution(executionId: string): Promise<ApiResponse<Execution>>;
    cancelExecution(executionId: string): Promise<ApiResponse<Execution>>;
    getExecutionLogs(executionId: string, params?: {
        level?: 'debug' | 'info' | 'warn' | 'error';
        startTime?: string;
        endTime?: string;
    }): Promise<ApiResponse<{
        logs: any[];
    }>>;
    getSystemMetrics(params?: {
        timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
        metrics?: string;
    }): Promise<ApiResponse<{
        metrics: any[];
    }>>;
    listAlerts(params?: {
        page?: number;
        limit?: number;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        status?: 'active' | 'resolved' | 'acknowledged';
    }): Promise<ApiResponse<{
        alerts: any[];
    }>>;
    browseMarketplaceWorkflows(params?: {
        page?: number;
        limit?: number;
        category?: string;
        tags?: string;
        search?: string;
        sortBy?: 'popularity' | 'rating' | 'recent' | 'name';
    }): Promise<ApiResponse<{
        workflows: any[];
    }>>;
    getHealth(): Promise<ApiResponse<{
        status: string;
        timestamp: string;
        version: string;
        uptime: number;
    }>>;
    getVersion(): Promise<ApiResponse<{
        version: string;
        apiVersion: string;
        buildDate: string;
    }>>;
    setAccessToken(token: string): void;
    setApiKey(apiKey: string): void;
    setVersion(version: string): void;
    getConfig(): Readonly<ApiConfig>;
}
export declare const createClient: (config: ApiConfig) => RobustAIOrchestrator;
export * from './types';
export default RobustAIOrchestrator;
//# sourceMappingURL=index.d.ts.map