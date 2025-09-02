import { EventEmitter } from 'events';
export interface AuditEvent {
    id: string;
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    outcome: 'success' | 'failure' | 'error';
    severity: 'low' | 'medium' | 'high' | 'critical';
    hash?: string;
    previousHash?: string;
}
export interface AuditChain {
    events: AuditEvent[];
    isValid: boolean;
    brokenAt?: number;
}
export declare class AuditLogger extends EventEmitter {
    private lastHash;
    private eventStore;
    private merkleTree;
    private storageBackend;
    constructor(storageBackend?: AuditStorageBackend);
    private initializeChain;
    logEvent(event: Omit<AuditEvent, 'id' | 'timestamp' | 'hash' | 'previousHash'>): Promise<void>;
    private calculateEventHash;
    verifyChainIntegrity(): Promise<AuditChain>;
    private persistEvent;
    logAuthentication(userId: string, outcome: 'success' | 'failure', details?: Record<string, any>): Promise<void>;
    logAuthorization(userId: string, resource: string, action: string, outcome: 'success' | 'failure', details?: Record<string, any>): Promise<void>;
    logDataAccess(userId: string, resource: string, resourceId: string, action: string, details?: Record<string, any>): Promise<void>;
    logSecurityEvent(action: string, severity: AuditEvent['severity'], details?: Record<string, any>): Promise<void>;
    logWorkflowExecution(userId: string, workflowId: string, action: string, outcome: 'success' | 'failure' | 'error', details?: Record<string, any>): Promise<void>;
    private buildMerkleTree;
    createAuditProof(eventId: string): Promise<AuditProof | null>;
    private generateMerkleProof;
    verifyAuditProof(proof: AuditProof): Promise<boolean>;
    exportAuditLog(startDate?: Date, endDate?: Date): Promise<AuditExport>;
    private signExport;
    getAuditStatistics(): Promise<AuditStatistics>;
    private groupEventsByField;
}
export interface AuditProof {
    eventId: string;
    eventHash: string;
    merkleRoot: string;
    proof: string[];
    timestamp: Date;
}
export interface AuditExport {
    events: AuditEvent[];
    merkleRoot: string;
    exportTimestamp: Date;
    signature: string;
}
export interface AuditStatistics {
    totalEvents: number;
    eventsLast24h: number;
    eventsLast7d: number;
    eventsByAction: Record<string, number>;
    eventsByResource: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    eventsByOutcome: Record<string, number>;
    uniqueUsers: number;
    chainIntegrity: boolean;
}
export interface AuditStorageBackend {
    store(event: AuditEvent): Promise<void>;
    retrieve(eventId: string): Promise<AuditEvent | null>;
    list(filters?: AuditFilters): Promise<AuditEvent[]>;
}
export interface AuditFilters {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: AuditEvent['severity'];
}
export declare const auditLogger: AuditLogger;
//# sourceMappingURL=auditLogger.d.ts.map