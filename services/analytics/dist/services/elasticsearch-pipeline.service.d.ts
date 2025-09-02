import { Logger } from 'winston';
import { AnalyticsData, AnalyticsQuery, AnalyticsResult, ElasticsearchConfig } from '../interfaces/analytics.interface';
export declare class ElasticsearchPipelineService {
    private client;
    private logger;
    private indexPrefix;
    constructor(config: ElasticsearchConfig, logger: Logger);
    private initializeIndices;
    private getIndexMapping;
    private createIndex;
    ingestData(data: AnalyticsData): Promise<void>;
    ingestBulkData(dataItems: AnalyticsData[]): Promise<void>;
    queryData(query: AnalyticsQuery): Promise<AnalyticsResult>;
    createDataView(name: string, indexPattern: string, timeField?: string): Promise<void>;
    deleteOldData(indexPattern: string, olderThanDays: number): Promise<void>;
    getIndexStats(indexPattern: string): Promise<any>;
    private getIndexName;
    healthCheck(): Promise<{
        status: string;
        cluster: any;
    }>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=elasticsearch-pipeline.service.d.ts.map