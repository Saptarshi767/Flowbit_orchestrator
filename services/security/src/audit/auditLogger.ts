import crypto from 'crypto';
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

export class AuditLogger extends EventEmitter {
  private lastHash: string = '';
  private eventStore: AuditEvent[] = [];
  private merkleTree: string[] = [];
  private storageBackend: AuditStorageBackend;

  constructor(storageBackend?: AuditStorageBackend) {
    super();
    this.storageBackend = storageBackend || new InMemoryAuditStorage();
    this.initializeChain();
  }

  private initializeChain(): void {
    // Genesis block for audit chain
    this.lastHash = crypto.createHash('sha256')
      .update('genesis-audit-chain')
      .digest('hex');
  }

  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp' | 'hash' | 'previousHash'>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
      previousHash: this.lastHash
    };

    // Calculate hash for tamper detection
    auditEvent.hash = this.calculateEventHash(auditEvent);
    this.lastHash = auditEvent.hash;

    // Store event
    this.eventStore.push(auditEvent);
    
    // Emit event for real-time processing
    this.emit('auditEvent', auditEvent);

    // Persist to storage (implement based on your storage solution)
    await this.persistEvent(auditEvent);
  }

  private calculateEventHash(event: AuditEvent): string {
    const hashData = {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      details: JSON.stringify(event.details),
      outcome: event.outcome,
      previousHash: event.previousHash
    };

    return crypto.createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
  }

  async verifyChainIntegrity(): Promise<AuditChain> {
    const result: AuditChain = {
      events: this.eventStore,
      isValid: true
    };

    let expectedPreviousHash = crypto.createHash('sha256')
      .update('genesis-audit-chain')
      .digest('hex');

    for (let i = 0; i < this.eventStore.length; i++) {
      const event = this.eventStore[i];
      
      // Verify previous hash
      if (event.previousHash !== expectedPreviousHash) {
        result.isValid = false;
        result.brokenAt = i;
        break;
      }

      // Verify event hash
      const calculatedHash = this.calculateEventHash(event);
      if (event.hash !== calculatedHash) {
        result.isValid = false;
        result.brokenAt = i;
        break;
      }

      expectedPreviousHash = event.hash!;
    }

    return result;
  }

  private async persistEvent(event: AuditEvent): Promise<void> {
    // This would typically write to a secure, append-only storage
    // For now, we'll simulate with console logging
    console.log(`[AUDIT] ${event.timestamp.toISOString()} - ${event.action} on ${event.resource} by ${event.userId || 'anonymous'}`);
  }

  // Convenience methods for common audit events
  async logAuthentication(userId: string, outcome: 'success' | 'failure', details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      userId,
      action: 'authentication',
      resource: 'auth',
      details,
      outcome,
      severity: outcome === 'failure' ? 'medium' : 'low'
    });
  }

  async logAuthorization(userId: string, resource: string, action: string, outcome: 'success' | 'failure', details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      userId,
      action: `authorization:${action}`,
      resource,
      details,
      outcome,
      severity: outcome === 'failure' ? 'high' : 'low'
    });
  }

  async logDataAccess(userId: string, resource: string, resourceId: string, action: string, details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      userId,
      action: `data:${action}`,
      resource,
      resourceId,
      details,
      outcome: 'success',
      severity: 'low'
    });
  }

  async logSecurityEvent(action: string, severity: AuditEvent['severity'], details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      action: `security:${action}`,
      resource: 'system',
      details,
      outcome: 'success',
      severity
    });
  }

  async logWorkflowExecution(userId: string, workflowId: string, action: string, outcome: 'success' | 'failure' | 'error', details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      userId,
      action: `workflow:${action}`,
      resource: 'workflow',
      resourceId: workflowId,
      details,
      outcome,
      severity: outcome === 'error' ? 'high' : 'low'
    });
  }

  // Enhanced tamper-proof features
  private buildMerkleTree(events: AuditEvent[]): string[] {
    if (events.length === 0) return [];
    
    let level = events.map(event => event.hash!);
    const tree = [...level];
    
    while (level.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : left;
        const combined = crypto.createHash('sha256')
          .update(left + right)
          .digest('hex');
        nextLevel.push(combined);
        tree.push(combined);
      }
      
      level = nextLevel;
    }
    
    return tree;
  }

  async createAuditProof(eventId: string): Promise<AuditProof | null> {
    const eventIndex = this.eventStore.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return null;
    
    const event = this.eventStore[eventIndex];
    const merkleTree = this.buildMerkleTree(this.eventStore);
    const proof = this.generateMerkleProof(eventIndex, merkleTree);
    
    return {
      eventId,
      eventHash: event.hash!,
      merkleRoot: merkleTree[merkleTree.length - 1],
      proof,
      timestamp: new Date()
    };
  }

  private generateMerkleProof(index: number, tree: string[]): string[] {
    const proof: string[] = [];
    let currentIndex = index;
    let levelSize = this.eventStore.length;
    let treeIndex = 0;
    
    while (levelSize > 1) {
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      
      if (siblingIndex < levelSize) {
        proof.push(tree[treeIndex + siblingIndex]);
      }
      
      currentIndex = Math.floor(currentIndex / 2);
      treeIndex += levelSize;
      levelSize = Math.ceil(levelSize / 2);
    }
    
    return proof;
  }

  async verifyAuditProof(proof: AuditProof): Promise<boolean> {
    const event = this.eventStore.find(e => e.id === proof.eventId);
    if (!event || event.hash !== proof.eventHash) return false;
    
    let hash = proof.eventHash;
    const eventIndex = this.eventStore.findIndex(e => e.id === proof.eventId);
    let currentIndex = eventIndex;
    
    for (const siblingHash of proof.proof) {
      if (currentIndex % 2 === 0) {
        hash = crypto.createHash('sha256').update(hash + siblingHash).digest('hex');
      } else {
        hash = crypto.createHash('sha256').update(siblingHash + hash).digest('hex');
      }
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    return hash === proof.merkleRoot;
  }

  async exportAuditLog(startDate?: Date, endDate?: Date): Promise<AuditExport> {
    let events = this.eventStore;
    
    if (startDate || endDate) {
      events = events.filter(event => {
        const eventTime = event.timestamp.getTime();
        const start = startDate?.getTime() || 0;
        const end = endDate?.getTime() || Date.now();
        return eventTime >= start && eventTime <= end;
      });
    }
    
    const merkleTree = this.buildMerkleTree(events);
    const merkleRoot = merkleTree.length > 0 ? merkleTree[merkleTree.length - 1] : '';
    
    return {
      events,
      merkleRoot,
      exportTimestamp: new Date(),
      signature: await this.signExport(events, merkleRoot)
    };
  }

  private async signExport(events: AuditEvent[], merkleRoot: string): Promise<string> {
    const exportData = {
      eventCount: events.length,
      merkleRoot,
      firstEvent: events[0]?.id,
      lastEvent: events[events.length - 1]?.id
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(exportData))
      .digest('hex');
  }

  async getAuditStatistics(): Promise<AuditStatistics> {
    const events = this.eventStore;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      totalEvents: events.length,
      eventsLast24h: events.filter(e => e.timestamp >= last24h).length,
      eventsLast7d: events.filter(e => e.timestamp >= last7d).length,
      eventsByAction: this.groupEventsByField(events, 'action'),
      eventsByResource: this.groupEventsByField(events, 'resource'),
      eventsBySeverity: this.groupEventsByField(events, 'severity'),
      eventsByOutcome: this.groupEventsByField(events, 'outcome'),
      uniqueUsers: new Set(events.map(e => e.userId).filter(Boolean)).size,
      chainIntegrity: (await this.verifyChainIntegrity()).isValid
    };
  }

  private groupEventsByField(events: AuditEvent[], field: keyof AuditEvent): Record<string, number> {
    return events.reduce((acc, event) => {
      const value = String(event[field]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

// Additional interfaces for enhanced audit features
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

class InMemoryAuditStorage implements AuditStorageBackend {
  private events: Map<string, AuditEvent> = new Map();

  async store(event: AuditEvent): Promise<void> {
    this.events.set(event.id, event);
  }

  async retrieve(eventId: string): Promise<AuditEvent | null> {
    return this.events.get(eventId) || null;
  }

  async list(filters?: AuditFilters): Promise<AuditEvent[]> {
    let events = Array.from(this.events.values());
    
    if (filters) {
      events = events.filter(event => {
        if (filters.userId && event.userId !== filters.userId) return false;
        if (filters.action && event.action !== filters.action) return false;
        if (filters.resource && event.resource !== filters.resource) return false;
        if (filters.severity && event.severity !== filters.severity) return false;
        if (filters.startDate && event.timestamp < filters.startDate) return false;
        if (filters.endDate && event.timestamp > filters.endDate) return false;
        return true;
      });
    }
    
    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

export const auditLogger = new AuditLogger();