"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = exports.AuditLogger = void 0;
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
class AuditLogger extends events_1.EventEmitter {
    constructor(storageBackend) {
        super();
        this.lastHash = '';
        this.eventStore = [];
        this.merkleTree = [];
        this.storageBackend = storageBackend || new InMemoryAuditStorage();
        this.initializeChain();
    }
    initializeChain() {
        // Genesis block for audit chain
        this.lastHash = crypto_1.default.createHash('sha256')
            .update('genesis-audit-chain')
            .digest('hex');
    }
    async logEvent(event) {
        const auditEvent = {
            id: crypto_1.default.randomUUID(),
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
    calculateEventHash(event) {
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
        return crypto_1.default.createHash('sha256')
            .update(JSON.stringify(hashData))
            .digest('hex');
    }
    async verifyChainIntegrity() {
        const result = {
            events: this.eventStore,
            isValid: true
        };
        let expectedPreviousHash = crypto_1.default.createHash('sha256')
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
            expectedPreviousHash = event.hash;
        }
        return result;
    }
    async persistEvent(event) {
        // This would typically write to a secure, append-only storage
        // For now, we'll simulate with console logging
        console.log(`[AUDIT] ${event.timestamp.toISOString()} - ${event.action} on ${event.resource} by ${event.userId || 'anonymous'}`);
    }
    // Convenience methods for common audit events
    async logAuthentication(userId, outcome, details = {}) {
        await this.logEvent({
            userId,
            action: 'authentication',
            resource: 'auth',
            details,
            outcome,
            severity: outcome === 'failure' ? 'medium' : 'low'
        });
    }
    async logAuthorization(userId, resource, action, outcome, details = {}) {
        await this.logEvent({
            userId,
            action: `authorization:${action}`,
            resource,
            details,
            outcome,
            severity: outcome === 'failure' ? 'high' : 'low'
        });
    }
    async logDataAccess(userId, resource, resourceId, action, details = {}) {
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
    async logSecurityEvent(action, severity, details = {}) {
        await this.logEvent({
            action: `security:${action}`,
            resource: 'system',
            details,
            outcome: 'success',
            severity
        });
    }
    async logWorkflowExecution(userId, workflowId, action, outcome, details = {}) {
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
    buildMerkleTree(events) {
        if (events.length === 0)
            return [];
        let level = events.map(event => event.hash);
        const tree = [...level];
        while (level.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < level.length; i += 2) {
                const left = level[i];
                const right = i + 1 < level.length ? level[i + 1] : left;
                const combined = crypto_1.default.createHash('sha256')
                    .update(left + right)
                    .digest('hex');
                nextLevel.push(combined);
                tree.push(combined);
            }
            level = nextLevel;
        }
        return tree;
    }
    async createAuditProof(eventId) {
        const eventIndex = this.eventStore.findIndex(e => e.id === eventId);
        if (eventIndex === -1)
            return null;
        const event = this.eventStore[eventIndex];
        const merkleTree = this.buildMerkleTree(this.eventStore);
        const proof = this.generateMerkleProof(eventIndex, merkleTree);
        return {
            eventId,
            eventHash: event.hash,
            merkleRoot: merkleTree[merkleTree.length - 1],
            proof,
            timestamp: new Date()
        };
    }
    generateMerkleProof(index, tree) {
        const proof = [];
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
    async verifyAuditProof(proof) {
        const event = this.eventStore.find(e => e.id === proof.eventId);
        if (!event || event.hash !== proof.eventHash)
            return false;
        let hash = proof.eventHash;
        const eventIndex = this.eventStore.findIndex(e => e.id === proof.eventId);
        let currentIndex = eventIndex;
        for (const siblingHash of proof.proof) {
            if (currentIndex % 2 === 0) {
                hash = crypto_1.default.createHash('sha256').update(hash + siblingHash).digest('hex');
            }
            else {
                hash = crypto_1.default.createHash('sha256').update(siblingHash + hash).digest('hex');
            }
            currentIndex = Math.floor(currentIndex / 2);
        }
        return hash === proof.merkleRoot;
    }
    async exportAuditLog(startDate, endDate) {
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
    async signExport(events, merkleRoot) {
        const exportData = {
            eventCount: events.length,
            merkleRoot,
            firstEvent: events[0]?.id,
            lastEvent: events[events.length - 1]?.id
        };
        return crypto_1.default.createHash('sha256')
            .update(JSON.stringify(exportData))
            .digest('hex');
    }
    async getAuditStatistics() {
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
    groupEventsByField(events, field) {
        return events.reduce((acc, event) => {
            const value = String(event[field]);
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {});
    }
}
exports.AuditLogger = AuditLogger;
class InMemoryAuditStorage {
    constructor() {
        this.events = new Map();
    }
    async store(event) {
        this.events.set(event.id, event);
    }
    async retrieve(eventId) {
        return this.events.get(eventId) || null;
    }
    async list(filters) {
        let events = Array.from(this.events.values());
        if (filters) {
            events = events.filter(event => {
                if (filters.userId && event.userId !== filters.userId)
                    return false;
                if (filters.action && event.action !== filters.action)
                    return false;
                if (filters.resource && event.resource !== filters.resource)
                    return false;
                if (filters.severity && event.severity !== filters.severity)
                    return false;
                if (filters.startDate && event.timestamp < filters.startDate)
                    return false;
                if (filters.endDate && event.timestamp > filters.endDate)
                    return false;
                return true;
            });
        }
        return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
}
exports.auditLogger = new AuditLogger();
//# sourceMappingURL=auditLogger.js.map