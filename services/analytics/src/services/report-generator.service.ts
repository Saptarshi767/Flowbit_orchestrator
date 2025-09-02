import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import { Logger } from 'winston';
import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  ReportRequest, 
  Report, 
  ReportType, 
  ReportStatus,
  ReportFormat,
  TimeRange,
  PerformanceMetrics,
  UsageAnalytics,
  BillingMetrics
} from '../interfaces/analytics.interface';
// ReportFormat is already imported from analytics.interface
import { ElasticsearchPipelineService } from './elasticsearch-pipeline.service';

export class ReportGeneratorService {
  private elasticsearchService: ElasticsearchPipelineService;
  private logger: Logger;
  private reportsDir: string;

  constructor(elasticsearchService: ElasticsearchPipelineService, logger: Logger) {
    this.elasticsearchService = elasticsearchService;
    this.logger = logger;
    this.reportsDir = process.env.REPORTS_DIR || './reports';
    
    this.ensureReportsDirectory();
  }

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create reports directory:', error);
    }
  }

  async generateReport(request: ReportRequest): Promise<Report> {
    const report: Report = {
      id: this.generateReportId(),
      type: request.type,
      name: request.name,
      generatedAt: new Date(),
      parameters: request.parameters,
      format: request.format,
      organizationId: request.organizationId,
      userId: request.userId,
      status: ReportStatus.GENERATING,
      data: null
    };

    try {
      this.logger.info(`Generating report: ${report.id} (${request.type})`);

      // Generate report data based on type
      const reportData = await this.generateReportData(request);
      report.data = reportData;

      // Generate file based on format
      if (request.format !== ReportFormat.JSON) {
        const filePath = await this.generateReportFile(report, reportData);
        report.filePath = filePath;
      }

      report.status = ReportStatus.COMPLETED;
      this.logger.info(`Report generated successfully: ${report.id}`);

      return report;
    } catch (error) {
      this.logger.error(`Failed to generate report ${report.id}:`, error);
      report.status = ReportStatus.FAILED;
      report.error = error instanceof Error ? error.message : 'Unknown error';
      return report;
    }
  }

  private async generateReportData(request: ReportRequest): Promise<any> {
    switch (request.type) {
      case 'performance':
        return this.generatePerformanceReport(request);
      case 'usage':
        return this.generateUsageReport(request);
      case 'billing':
        return this.generateBillingReport(request);
      case 'execution-summary':
        return this.generateExecutionSummaryReport(request);
      case 'workflow-analytics':
        return this.generateWorkflowAnalyticsReport(request);
      case 'user-activity':
        return this.generateUserActivityReport(request);
      case 'system-health':
        return this.generateSystemHealthReport(request);
      default:
        throw new Error(`Unknown report type: ${request.type}`);
    }
  }

  private async generatePerformanceReport(request: ReportRequest): Promise<PerformanceMetrics> {
    const timeRange = request.timeRange || this.getDefaultTimeRange();
    
    // Query execution performance data
    const executionQuery = {
      index: 'orchestrator-executions',
      query: {
        bool: {
          filter: [
            { term: { organizationId: request.organizationId } },
            { range: { timestamp: { gte: timeRange.start, lte: timeRange.end } } }
          ]
        }
      },
      aggregations: {
        avg_duration: { avg: { field: 'duration' } },
        max_duration: { max: { field: 'duration' } },
        min_duration: { min: { field: 'duration' } },
        total_executions: { value_count: { field: 'executionId' } },
        success_rate: {
          filters: {
            filters: {
              successful: { term: { status: 'completed' } },
              failed: { term: { status: 'failed' } }
            }
          }
        },
        duration_histogram: {
          date_histogram: {
            field: 'timestamp',
            interval: '1h'
          },
          aggs: {
            avg_duration: { avg: { field: 'duration' } }
          }
        }
      }
    };

    const result = await this.elasticsearchService.queryData(executionQuery);
    const aggs = result.aggregations;

    if (!aggs) {
      throw new Error('No aggregations returned from performance metrics query');
    }

    return {
      timeRange,
      metrics: {
        executionDuration: {
          current: aggs.avg_duration.value || 0,
          previous: 0, // Would need previous period data
          change: 0,
          changePercent: 0,
          timeSeries: aggs.duration_histogram.buckets.map((bucket: any) => ({
            timestamp: new Date(bucket.key),
            value: bucket.avg_duration.value || 0
          }))
        },
        throughput: {
          current: aggs.total_executions.value || 0,
          previous: 0,
          change: 0,
          changePercent: 0,
          timeSeries: []
        },
        errorRate: {
          current: this.calculateErrorRate(aggs.success_rate),
          previous: 0,
          change: 0,
          changePercent: 0,
          timeSeries: []
        },
        resourceUtilization: {
          current: 0, // Would need system metrics
          previous: 0,
          change: 0,
          changePercent: 0,
          timeSeries: []
        },
        customMetrics: {}
      },
      trends: {
        duration: { direction: 'stable', strength: 'weak', confidence: 0.5 },
        throughput: { direction: 'stable', strength: 'weak', confidence: 0.5 },
        errorRate: { direction: 'stable', strength: 'weak', confidence: 0.5 }
      }
    };
  }

  private async generateUsageReport(request: ReportRequest): Promise<UsageAnalytics> {
    const timeRange = request.timeRange || this.getDefaultTimeRange();
    
    const usageQuery = {
      index: 'orchestrator-executions',
      query: {
        bool: {
          filter: [
            { term: { organizationId: request.organizationId } },
            { range: { timestamp: { gte: timeRange.start, lte: timeRange.end } } }
          ]
        }
      },
      aggregations: {
        total_executions: { value_count: { field: 'executionId' } },
        unique_users: { cardinality: { field: 'userId' } },
        unique_workflows: { cardinality: { field: 'workflowId' } },
        top_workflows: {
          terms: { field: 'workflowId', size: 10 },
          aggs: {
            success_rate: {
              filters: {
                filters: {
                  successful: { term: { status: 'completed' } },
                  total: { match_all: {} }
                }
              }
            },
            avg_duration: { avg: { field: 'duration' } }
          }
        },
        top_users: {
          terms: { field: 'userId', size: 10 },
          aggs: {
            unique_workflows: { cardinality: { field: 'workflowId' } },
            last_activity: { max: { field: 'timestamp' } }
          }
        },
        executions_by_engine: {
          terms: { field: 'engineType' }
        },
        executions_by_status: {
          terms: { field: 'status' }
        },
        executions_over_time: {
          date_histogram: {
            field: 'timestamp',
            interval: '1d'
          }
        }
      }
    };

    const result = await this.elasticsearchService.queryData(usageQuery);
    const aggs = result.aggregations;

    if (!aggs) {
      throw new Error('No aggregations returned from usage analytics query');
    }

    return {
      timeRange,
      totalExecutions: aggs.total_executions.value || 0,
      uniqueUsers: aggs.unique_users.value || 0,
      activeWorkflows: aggs.unique_workflows.value || 0,
      topWorkflows: aggs.top_workflows.buckets.map((bucket: any) => ({
        workflowId: bucket.key,
        workflowName: `Workflow ${bucket.key}`, // Would need to lookup actual name
        executions: bucket.doc_count,
        successRate: this.calculateSuccessRate(bucket.success_rate),
        avgDuration: bucket.avg_duration.value || 0
      })),
      topUsers: aggs.top_users.buckets.map((bucket: any) => ({
        userId: bucket.key,
        userName: `User ${bucket.key}`, // Would need to lookup actual name
        executions: bucket.doc_count,
        workflows: bucket.unique_workflows.value,
        lastActivity: new Date(bucket.last_activity.value)
      })),
      executionsByEngine: this.bucketToRecord(aggs.executions_by_engine.buckets),
      executionsByStatus: this.bucketToRecord(aggs.executions_by_status.buckets),
      timeSeries: aggs.executions_over_time.buckets.map((bucket: any) => ({
        timestamp: new Date(bucket.key),
        value: bucket.doc_count
      }))
    };
  }

  private async generateBillingReport(request: ReportRequest): Promise<BillingMetrics> {
    const timeRange = request.timeRange || this.getDefaultTimeRange();
    
    // This would query billing-specific data
    // For now, returning mock data structure
    return {
      organizationId: request.organizationId,
      timeRange,
      totalCost: 1250.75,
      costByService: {
        'orchestration': 500.25,
        'analytics': 300.50,
        'storage': 200.00,
        'compute': 250.00
      },
      costByUser: {
        'user-1': 400.25,
        'user-2': 350.50,
        'user-3': 500.00
      },
      executionCosts: {
        total: 800.75,
        byEngine: {
          'langflow': 300.25,
          'n8n': 250.50,
          'langsmith': 250.00
        },
        byDuration: []
      },
      resourceCosts: {
        compute: 600.00,
        storage: 400.75,
        network: 250.00
      },
      projectedCost: 1500.00,
      costTrends: { direction: 'up', strength: 'moderate', confidence: 0.8 }
    };
  }

  private async generateExecutionSummaryReport(request: ReportRequest): Promise<any> {
    const timeRange = request.timeRange || this.getDefaultTimeRange();
    
    const query = {
      index: 'orchestrator-executions',
      query: {
        bool: {
          filter: [
            { term: { organizationId: request.organizationId } },
            { range: { timestamp: { gte: timeRange.start, lte: timeRange.end } } }
          ]
        }
      },
      size: 1000,
      sort: [{ timestamp: { order: 'desc' } }]
    };

    const result = await this.elasticsearchService.queryData(query);
    
    return {
      timeRange,
      totalExecutions: result.hits.total.value,
      executions: result.hits.hits.map(hit => hit._source),
      summary: {
        successful: result.hits.hits.filter((hit: any) => hit._source.status === 'completed').length,
        failed: result.hits.hits.filter((hit: any) => hit._source.status === 'failed').length,
        pending: result.hits.hits.filter((hit: any) => hit._source.status === 'pending').length,
        running: result.hits.hits.filter((hit: any) => hit._source.status === 'running').length
      }
    };
  }

  private async generateWorkflowAnalyticsReport(request: ReportRequest): Promise<any> {
    // Implementation for workflow analytics
    return { message: 'Workflow analytics report not yet implemented' };
  }

  private async generateUserActivityReport(request: ReportRequest): Promise<any> {
    // Implementation for user activity
    return { message: 'User activity report not yet implemented' };
  }

  private async generateSystemHealthReport(request: ReportRequest): Promise<any> {
    // Implementation for system health
    return { message: 'System health report not yet implemented' };
  }

  private async generateReportFile(report: Report, data: any): Promise<string> {
    const fileName = `${report.id}.${this.getFileExtension(report.format)}`;
    const filePath = join(this.reportsDir, fileName);

    switch (report.format) {
      case ReportFormat.PDF:
        await this.generatePDFFile(filePath, report, data);
        break;
      case ReportFormat.CSV:
        await this.generateCSVFile(filePath, report, data);
        break;
      case ReportFormat.HTML:
        await this.generateHTMLFile(filePath, report, data);
        break;
      default:
        throw new Error(`Unsupported report format: ${report.format}`);
    }

    return filePath;
  }

  private async generatePDFFile(filePath: string, report: Report, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const stream = require('fs').createWriteStream(filePath);
        
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text(report.name, 50, 50);
        doc.fontSize(12).text(`Generated: ${report.generatedAt.toISOString()}`, 50, 80);
        doc.fontSize(12).text(`Type: ${report.type}`, 50, 100);
        doc.fontSize(12).text(`Organization: ${report.organizationId}`, 50, 120);

        // Content based on report type
        let yPosition = 160;
        
        if (report.type === 'performance') {
          yPosition = this.addPerformanceContentToPDF(doc, data, yPosition);
        } else if (report.type === 'usage') {
          yPosition = this.addUsageContentToPDF(doc, data, yPosition);
        } else if (report.type === 'billing') {
          yPosition = this.addBillingContentToPDF(doc, data, yPosition);
        } else {
          doc.fontSize(12).text(JSON.stringify(data, null, 2), 50, yPosition);
        }

        doc.end();
        
        stream.on('finish', resolve);
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private addPerformanceContentToPDF(doc: any, data: PerformanceMetrics, yPosition: number): number {
    doc.fontSize(16).text('Performance Metrics', 50, yPosition);
    yPosition += 30;

    doc.fontSize(12).text(`Average Execution Duration: ${data.metrics.executionDuration.current.toFixed(2)}ms`, 50, yPosition);
    yPosition += 20;

    doc.fontSize(12).text(`Total Throughput: ${data.metrics.throughput.current}`, 50, yPosition);
    yPosition += 20;

    doc.fontSize(12).text(`Error Rate: ${data.metrics.errorRate.current.toFixed(2)}%`, 50, yPosition);
    yPosition += 20;

    return yPosition;
  }

  private addUsageContentToPDF(doc: any, data: UsageAnalytics, yPosition: number): number {
    doc.fontSize(16).text('Usage Analytics', 50, yPosition);
    yPosition += 30;

    doc.fontSize(12).text(`Total Executions: ${data.totalExecutions}`, 50, yPosition);
    yPosition += 20;

    doc.fontSize(12).text(`Unique Users: ${data.uniqueUsers}`, 50, yPosition);
    yPosition += 20;

    doc.fontSize(12).text(`Active Workflows: ${data.activeWorkflows}`, 50, yPosition);
    yPosition += 30;

    doc.fontSize(14).text('Top Workflows:', 50, yPosition);
    yPosition += 20;

    data.topWorkflows.slice(0, 5).forEach(workflow => {
      doc.fontSize(10).text(`${workflow.workflowName}: ${workflow.executions} executions (${workflow.successRate.toFixed(1)}% success)`, 70, yPosition);
      yPosition += 15;
    });

    return yPosition;
  }

  private addBillingContentToPDF(doc: any, data: BillingMetrics, yPosition: number): number {
    doc.fontSize(16).text('Billing Metrics', 50, yPosition);
    yPosition += 30;

    doc.fontSize(12).text(`Total Cost: $${data.totalCost.toFixed(2)}`, 50, yPosition);
    yPosition += 20;

    doc.fontSize(12).text(`Projected Cost: $${data.projectedCost.toFixed(2)}`, 50, yPosition);
    yPosition += 30;

    doc.fontSize(14).text('Cost by Service:', 50, yPosition);
    yPosition += 20;

    Object.entries(data.costByService).forEach(([service, cost]) => {
      doc.fontSize(10).text(`${service}: $${cost.toFixed(2)}`, 70, yPosition);
      yPosition += 15;
    });

    return yPosition;
  }

  private async generateCSVFile(filePath: string, report: Report, data: any): Promise<void> {
    let records: any[] = [];
    let headers: any[] = [];

    if (report.type === 'execution-summary' && data.executions) {
      headers = [
        { id: 'executionId', title: 'Execution ID' },
        { id: 'workflowId', title: 'Workflow ID' },
        { id: 'status', title: 'Status' },
        { id: 'engineType', title: 'Engine' },
        { id: 'duration', title: 'Duration (ms)' },
        { id: 'timestamp', title: 'Timestamp' }
      ];
      records = data.executions;
    } else if (report.type === 'usage' && data.topWorkflows) {
      headers = [
        { id: 'workflowId', title: 'Workflow ID' },
        { id: 'workflowName', title: 'Workflow Name' },
        { id: 'executions', title: 'Executions' },
        { id: 'successRate', title: 'Success Rate (%)' },
        { id: 'avgDuration', title: 'Avg Duration (ms)' }
      ];
      records = data.topWorkflows;
    } else {
      // Generic CSV for other report types
      headers = [{ id: 'data', title: 'Data' }];
      records = [{ data: JSON.stringify(data) }];
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers
    });

    await csvWriter.writeRecords(records);
  }

  private async generateHTMLFile(filePath: string, report: Report, data: any): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${report.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .metric { margin: 10px 0; }
        .table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.name}</h1>
        <p><strong>Generated:</strong> ${report.generatedAt.toISOString()}</p>
        <p><strong>Type:</strong> ${report.type}</p>
        <p><strong>Organization:</strong> ${report.organizationId}</p>
    </div>
    
    <div class="content">
        ${this.generateHTMLContent(report.type, data)}
    </div>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
  }

  private generateHTMLContent(reportType: string, data: any): string {
    switch (reportType) {
      case 'performance':
        return this.generatePerformanceHTML(data);
      case 'usage':
        return this.generateUsageHTML(data);
      case 'billing':
        return this.generateBillingHTML(data);
      default:
        return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
  }

  private generatePerformanceHTML(data: PerformanceMetrics): string {
    return `
      <h2>Performance Metrics</h2>
      <div class="metric">Average Execution Duration: ${data.metrics.executionDuration.current.toFixed(2)}ms</div>
      <div class="metric">Total Throughput: ${data.metrics.throughput.current}</div>
      <div class="metric">Error Rate: ${data.metrics.errorRate.current.toFixed(2)}%</div>
    `;
  }

  private generateUsageHTML(data: UsageAnalytics): string {
    const workflowsTable = data.topWorkflows.map(w => 
      `<tr><td>${w.workflowName}</td><td>${w.executions}</td><td>${w.successRate.toFixed(1)}%</td></tr>`
    ).join('');

    return `
      <h2>Usage Analytics</h2>
      <div class="metric">Total Executions: ${data.totalExecutions}</div>
      <div class="metric">Unique Users: ${data.uniqueUsers}</div>
      <div class="metric">Active Workflows: ${data.activeWorkflows}</div>
      
      <h3>Top Workflows</h3>
      <table class="table">
        <tr><th>Workflow</th><th>Executions</th><th>Success Rate</th></tr>
        ${workflowsTable}
      </table>
    `;
  }

  private generateBillingHTML(data: BillingMetrics): string {
    const servicesTable = Object.entries(data.costByService).map(([service, cost]) => 
      `<tr><td>${service}</td><td>$${cost.toFixed(2)}</td></tr>`
    ).join('');

    return `
      <h2>Billing Metrics</h2>
      <div class="metric">Total Cost: $${data.totalCost.toFixed(2)}</div>
      <div class="metric">Projected Cost: $${data.projectedCost.toFixed(2)}</div>
      
      <h3>Cost by Service</h3>
      <table class="table">
        <tr><th>Service</th><th>Cost</th></tr>
        ${servicesTable}
      </table>
    `;
  }

  getReportTypes(): ReportType[] {
    return [
      {
        id: 'performance',
        name: 'Performance Report',
        description: 'Detailed performance metrics and trends',
        parameters: [
          { name: 'timeRange', type: 'date', required: true },
          { name: 'includeDetails', type: 'boolean', required: false, defaultValue: true }
        ],
        supportedFormats: [ReportFormat.PDF, ReportFormat.JSON, ReportFormat.HTML]
      },
      {
        id: 'usage',
        name: 'Usage Analytics Report',
        description: 'User and workflow usage statistics',

        parameters: [
          { name: 'timeRange', type: 'date', required: true },
          { name: 'includeUsers', type: 'boolean', required: false, defaultValue: true },
          { name: 'includeWorkflows', type: 'boolean', required: false, defaultValue: true }
        ],
        supportedFormats: [ReportFormat.PDF, ReportFormat.CSV, ReportFormat.JSON, ReportFormat.HTML]
      },
      {
        id: 'billing',
        name: 'Billing Report',
        description: 'Cost analysis and billing metrics',

        parameters: [
          { name: 'timeRange', type: 'date', required: true },
          { name: 'currency', type: 'string', required: false, defaultValue: 'USD' }
        ],
        supportedFormats: [ReportFormat.PDF, ReportFormat.JSON, ReportFormat.HTML]
      },
      {
        id: 'execution-summary',
        name: 'Execution Summary Report',
        description: 'Detailed execution logs and summaries',

        parameters: [
          { name: 'timeRange', type: 'date', required: true },
          { name: 'status', type: 'string', required: false }
        ],
        supportedFormats: [ReportFormat.CSV, ReportFormat.JSON, ReportFormat.HTML]
      }
    ];
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getFileExtension(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.PDF: return 'pdf';
      case ReportFormat.CSV: return 'csv';
      case ReportFormat.HTML: return 'html';
      case ReportFormat.JSON: return 'json';
      default: return 'txt';
    }
  }

  private getDefaultTimeRange(): TimeRange {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30); // Last 30 days
    return { start, end };
  }

  private calculateErrorRate(successRateAgg: any): number {
    const successful = successRateAgg.buckets.successful?.doc_count || 0;
    const failed = successRateAgg.buckets.failed?.doc_count || 0;
    const total = successful + failed;
    return total > 0 ? (failed / total) * 100 : 0;
  }

  private calculateSuccessRate(successRateAgg: any): number {
    const successful = successRateAgg.buckets.successful?.doc_count || 0;
    const total = successRateAgg.buckets.total?.doc_count || 0;
    return total > 0 ? (successful / total) * 100 : 0;
  }

  private bucketToRecord(buckets: any[]): Record<string, number> {
    const record: Record<string, number> = {};
    buckets.forEach(bucket => {
      record[bucket.key] = bucket.doc_count;
    });
    return record;
  }

  async cleanup(): Promise<void> {
    // Cleanup any resources if needed
    this.logger.info('Report generator service cleaned up');
  }
}