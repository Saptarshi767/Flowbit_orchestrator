import { ILogAggregator, LogSearchQuery, LogSearchResult, LogStreamFilters } from '../interfaces/monitoring.interface';
import { LogEntry, LogLevel, TimeRange } from '@robust-ai-orchestrator/shared';
import { Logger } from 'winston';
import { EventEmitter } from 'events';

interface IndexedLogEntry extends LogEntry {
  id: string;
  indexed: boolean;
}

export class LogAggregatorService extends EventEmitter implements ILogAggregator {
  private logs: Map<string, IndexedLogEntry> = new Map();
  private serviceIndex: Map<string, Set<string>> = new Map();
  private levelIndex: Map<LogLevel, Set<string>> = new Map();
  private timeIndex: Map<string, Set<string>> = new Map(); // Date string -> log IDs
  private logger: Logger;
  private maxLogs: number = 100000; // Maximum number of logs to keep in memory
  private retentionHours: number = 24; // Keep logs for 24 hours

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.initializeIndexes();
    this.startCleanupTask();
  }

  private initializeIndexes(): void {
    // Initialize level index
    Object.values(LogLevel).forEach(level => {
      this.levelIndex.set(level, new Set());
    });
  }

  private startCleanupTask(): void {
    // Clean up old logs every hour
    setInterval(() => {
      this.cleanupOldLogs();
    }, 3600000); // 1 hour
  }

  private cleanupOldLogs(): void {
    const cutoffTime = new Date(Date.now() - this.retentionHours * 3600 * 1000);
    let removedCount = 0;

    for (const [id, log] of this.logs.entries()) {
      if (log.timestamp < cutoffTime) {
        this.removeLogFromIndexes(id, log);
        this.logs.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} old log entries`);
    }
  }

  private removeLogFromIndexes(id: string, log: IndexedLogEntry): void {
    // Remove from service index
    const serviceSet = this.serviceIndex.get(log.service);
    if (serviceSet) {
      serviceSet.delete(id);
      if (serviceSet.size === 0) {
        this.serviceIndex.delete(log.service);
      }
    }

    // Remove from level index
    const levelSet = this.levelIndex.get(log.level);
    if (levelSet) {
      levelSet.delete(id);
    }

    // Remove from time index
    const timeKey = this.getTimeKey(log.timestamp);
    const timeSet = this.timeIndex.get(timeKey);
    if (timeSet) {
      timeSet.delete(id);
      if (timeSet.size === 0) {
        this.timeIndex.delete(timeKey);
      }
    }
  }

  private getTimeKey(timestamp: Date): string {
    // Group by hour for efficient time-based queries
    const hour = new Date(timestamp);
    hour.setMinutes(0, 0, 0);
    return hour.toISOString();
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addLogToIndexes(id: string, log: IndexedLogEntry): void {
    // Add to service index
    if (!this.serviceIndex.has(log.service)) {
      this.serviceIndex.set(log.service, new Set());
    }
    this.serviceIndex.get(log.service)!.add(id);

    // Add to level index
    if (!this.levelIndex.has(log.level)) {
      this.levelIndex.set(log.level, new Set());
    }
    this.levelIndex.get(log.level)!.add(id);

    // Add to time index
    const timeKey = this.getTimeKey(log.timestamp);
    if (!this.timeIndex.has(timeKey)) {
      this.timeIndex.set(timeKey, new Set());
    }
    this.timeIndex.get(timeKey)!.add(id);
  }

  async ingest(logs: LogEntry[]): Promise<void> {
    try {
      const indexedLogs: IndexedLogEntry[] = [];

      for (const log of logs) {
        const id = this.generateLogId();
        const indexedLog: IndexedLogEntry = {
          ...log,
          id,
          indexed: false
        };

        this.logs.set(id, indexedLog);
        this.addLogToIndexes(id, indexedLog);
        indexedLogs.push(indexedLog);

        // Emit real-time log event
        this.emit('log', indexedLog);
      }

      // Mark as indexed
      indexedLogs.forEach(log => {
        log.indexed = true;
      });

      // Enforce memory limits
      if (this.logs.size > this.maxLogs) {
        await this.enforceMemoryLimits();
      }

      this.logger.debug(`Ingested ${logs.length} log entries`);
    } catch (error) {
      this.logger.error('Failed to ingest logs:', error);
      throw error;
    }
  }

  private async enforceMemoryLimits(): Promise<void> {
    const excess = this.logs.size - this.maxLogs;
    if (excess <= 0) return;

    // Remove oldest logs
    const sortedLogs = Array.from(this.logs.entries())
      .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 0; i < excess; i++) {
      const [id, log] = sortedLogs[i];
      this.removeLogFromIndexes(id, log);
      this.logs.delete(id);
    }

    this.logger.info(`Removed ${excess} logs to enforce memory limits`);
  }

  async search(query: LogSearchQuery): Promise<LogSearchResult> {
    const startTime = Date.now();
    
    try {
      // Get candidate log IDs based on filters
      let candidateIds = this.getCandidateLogIds(query);

      // Apply text search if query is provided
      if (query.query && query.query.trim()) {
        candidateIds = this.applyTextSearch(candidateIds, query.query);
      }

      // Sort by timestamp (newest first)
      const sortedLogs = Array.from(candidateIds)
        .map(id => this.logs.get(id)!)
        .filter(log => log) // Remove any undefined entries
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      const paginatedLogs = sortedLogs.slice(offset, offset + limit);

      const result: LogSearchResult = {
        logs: paginatedLogs,
        total: sortedLogs.length,
        took: Date.now() - startTime
      };

      this.logger.debug(`Log search completed: ${result.total} results in ${result.took}ms`);
      return result;
    } catch (error) {
      this.logger.error('Log search failed:', error);
      throw error;
    }
  }

  private getCandidateLogIds(query: LogSearchQuery): Set<string> {
    let candidateIds: Set<string> | null = null;

    // Filter by time range
    if (query.timeRange) {
      const timeIds = this.getLogIdsByTimeRange(query.timeRange);
      candidateIds = candidateIds ? this.intersectSets(candidateIds, timeIds) : timeIds;
    }

    // Filter by services
    if (query.services && query.services.length > 0) {
      const serviceIds = new Set<string>();
      query.services.forEach(service => {
        const ids = this.serviceIndex.get(service);
        if (ids) {
          ids.forEach(id => serviceIds.add(id));
        }
      });
      candidateIds = candidateIds ? this.intersectSets(candidateIds, serviceIds) : serviceIds;
    }

    // Filter by levels
    if (query.levels && query.levels.length > 0) {
      const levelIds = new Set<string>();
      query.levels.forEach(level => {
        const ids = this.levelIndex.get(level as LogLevel);
        if (ids) {
          ids.forEach(id => levelIds.add(id));
        }
      });
      candidateIds = candidateIds ? this.intersectSets(candidateIds, levelIds) : levelIds;
    }

    // If no filters applied, return all log IDs
    return candidateIds || new Set(this.logs.keys());
  }

  private getLogIdsByTimeRange(timeRange: TimeRange): Set<string> {
    const ids = new Set<string>();
    
    for (const [timeKey, logIds] of this.timeIndex.entries()) {
      const timeKeyDate = new Date(timeKey);
      if (timeKeyDate >= timeRange.start && timeKeyDate <= timeRange.end) {
        logIds.forEach(id => ids.add(id));
      }
    }

    return ids;
  }

  private intersectSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const item of set1) {
      if (set2.has(item)) {
        result.add(item);
      }
    }
    return result;
  }

  private applyTextSearch(candidateIds: Set<string>, searchQuery: string): Set<string> {
    const matchingIds = new Set<string>();
    const searchTerms = searchQuery.toLowerCase().split(/\s+/);

    for (const id of candidateIds) {
      const log = this.logs.get(id);
      if (!log) continue;

      const searchableText = [
        log.message,
        log.service,
        JSON.stringify(log.context),
        JSON.stringify(log.metadata || {})
      ].join(' ').toLowerCase();

      const matches = searchTerms.every(term => searchableText.includes(term));
      if (matches) {
        matchingIds.add(id);
      }
    }

    return matchingIds;
  }

  async *getLogStream(filters: LogStreamFilters): AsyncIterable<LogEntry> {
    // Start from the specified time or current time
    const startTime = filters.since || new Date();
    
    // Yield existing logs that match filters
    const existingLogs = Array.from(this.logs.values())
      .filter(log => this.matchesStreamFilters(log, filters))
      .filter(log => log.timestamp >= startTime)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (const log of existingLogs) {
      yield log;
    }

    // Set up real-time streaming
    const streamHandler = (log: IndexedLogEntry) => {
      if (this.matchesStreamFilters(log, filters)) {
        // Note: In a real implementation, you'd use a proper streaming mechanism
        // This is a simplified version for demonstration
        setImmediate(() => {
          // Emit to stream (this would be handled by the caller)
        });
      }
    };

    this.on('log', streamHandler);

    // Return a cleanup function (in real implementation)
    // return () => this.off('log', streamHandler);
  }

  private matchesStreamFilters(log: IndexedLogEntry, filters: LogStreamFilters): boolean {
    // Filter by services
    if (filters.services && filters.services.length > 0) {
      if (!filters.services.includes(log.service)) {
        return false;
      }
    }

    // Filter by levels
    if (filters.levels && filters.levels.length > 0) {
      if (!filters.levels.includes(log.level)) {
        return false;
      }
    }

    return true;
  }

  // Utility methods
  getLogById(id: string): IndexedLogEntry | undefined {
    return this.logs.get(id);
  }

  getLogCount(): number {
    return this.logs.size;
  }

  getServiceList(): string[] {
    return Array.from(this.serviceIndex.keys());
  }

  getLevelCounts(): Record<LogLevel, number> {
    const counts: Record<LogLevel, number> = {} as any;
    
    for (const [level, ids] of this.levelIndex.entries()) {
      counts[level] = ids.size;
    }

    return counts;
  }

  getLogStats(): {
    totalLogs: number;
    services: string[];
    levels: Record<LogLevel, number>;
    oldestLog?: Date;
    newestLog?: Date;
  } {
    const logs = Array.from(this.logs.values());
    const timestamps = logs.map(log => log.timestamp).sort((a, b) => a.getTime() - b.getTime());

    return {
      totalLogs: this.logs.size,
      services: this.getServiceList(),
      levels: this.getLevelCounts(),
      oldestLog: timestamps[0],
      newestLog: timestamps[timestamps.length - 1]
    };
  }

  // Cleanup method
  cleanup(): void {
    this.logs.clear();
    this.serviceIndex.clear();
    this.levelIndex.clear();
    this.timeIndex.clear();
    this.removeAllListeners();
    this.logger.info('Log aggregator cleaned up');
  }
}