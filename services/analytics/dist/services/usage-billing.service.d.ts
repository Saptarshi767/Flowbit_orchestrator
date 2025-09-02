import { Logger } from 'winston';
import { UsageQuery, UsageAnalytics, BillingMetrics, TimeRange } from '../interfaces/analytics.interface';
import { ElasticsearchPipelineService } from './elasticsearch-pipeline.service';
export declare class UsageBillingService {
    private elasticsearchService;
    private logger;
    private billingRates;
    constructor(elasticsearchService: ElasticsearchPipelineService, logger: Logger);
    getUsageAnalytics(query: UsageQuery): Promise<UsageAnalytics>;
    getBillingMetrics(organizationId: string, timeRange: TimeRange): Promise<BillingMetrics>;
    private calculateExecutionCosts;
    private calculateResourceCosts;
    private calculateCostsByUser;
    private calculateCostTrends;
    private calculateProjectedCost;
    getUsageSummary(organizationId: string, timeRange: TimeRange): Promise<any>;
    getUsageAlerts(organizationId: string): Promise<any[]>;
    private getTimeInterval;
    private getPreviousTimeRange;
    private getMostUsedEngine;
    private calculateOverallSuccessRate;
    private calculateOverallErrorRate;
    private getTopCostDriver;
    updateBillingRates(rates: Partial<Record<string, number>>): Promise<void>;
    getBillingRates(): Record<string, number>;
}
//# sourceMappingURL=usage-billing.service.d.ts.map