import { Logger } from 'winston';
import { PerformanceQuery, PerformanceMetrics, TimeRange } from '../interfaces/analytics.interface';
import { ElasticsearchPipelineService } from './elasticsearch-pipeline.service';
export declare class PerformanceMetricsService {
    private elasticsearchService;
    private logger;
    constructor(elasticsearchService: ElasticsearchPipelineService, logger: Logger);
    getPerformanceMetrics(query: PerformanceQuery): Promise<PerformanceMetrics>;
    private calculatePeriodMetrics;
    private getResourceUtilizationMetrics;
    private getCustomMetrics;
    private getCustomMetricData;
    private createMetricData;
    private calculateTrends;
    private calculateTrendData;
    private getPreviousTimeRange;
    private getTimeInterval;
    private aggregationToMap;
    private calculateSuccessRate;
    getPerformanceSummary(organizationId: string, timeRange: TimeRange): Promise<any>;
    getPerformanceAlerts(organizationId: string): Promise<any[]>;
}
//# sourceMappingURL=performance-metrics.service.d.ts.map