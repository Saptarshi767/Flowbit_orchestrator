import { Logger } from 'winston';
import { ReportRequest, Report, ReportType } from '../interfaces/analytics.interface';
import { ElasticsearchPipelineService } from './elasticsearch-pipeline.service';
export declare class ReportGeneratorService {
    private elasticsearchService;
    private logger;
    private reportsDir;
    constructor(elasticsearchService: ElasticsearchPipelineService, logger: Logger);
    private ensureReportsDirectory;
    generateReport(request: ReportRequest): Promise<Report>;
    private generateReportData;
    private generatePerformanceReport;
    private generateUsageReport;
    private generateBillingReport;
    private generateExecutionSummaryReport;
    private generateWorkflowAnalyticsReport;
    private generateUserActivityReport;
    private generateSystemHealthReport;
    private generateReportFile;
    private generatePDFFile;
    private addPerformanceContentToPDF;
    private addUsageContentToPDF;
    private addBillingContentToPDF;
    private generateCSVFile;
    private generateHTMLFile;
    private generateHTMLContent;
    private generatePerformanceHTML;
    private generateUsageHTML;
    private generateBillingHTML;
    getReportTypes(): ReportType[];
    private generateReportId;
    private getFileExtension;
    private getDefaultTimeRange;
    private calculateErrorRate;
    private calculateSuccessRate;
    private bucketToRecord;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=report-generator.service.d.ts.map