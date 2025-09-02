"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGeneratorService = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const csv_writer_1 = require("csv-writer");
const fs_1 = require("fs");
const path_1 = require("path");
const analytics_interface_1 = require("../interfaces/analytics.interface");
const shared_1 = require("@robust-ai-orchestrator/shared");
class ReportGeneratorService {
    constructor(elasticsearchService, logger) {
        this.elasticsearchService = elasticsearchService;
        this.logger = logger;
        this.reportsDir = process.env.REPORTS_DIR || './reports';
        this.ensureReportsDirectory();
    }
    async ensureReportsDirectory() {
        try {
            await fs_1.promises.mkdir(this.reportsDir, { recursive: true });
        }
        catch (error) {
            this.logger.error('Failed to create reports directory:', error);
        }
    }
    async generateReport(request) {
        const report = {
            id: this.generateReportId(),
            type: request.type,
            name: request.name,
            generatedAt: new Date(),
            parameters: request.parameters,
            format: request.format,
            organizationId: request.organizationId,
            userId: request.userId,
            status: analytics_interface_1.ReportStatus.GENERATING,
            data: null
        };
        try {
            this.logger.info(`Generating report: ${report.id} (${request.type})`);
            // Generate report data based on type
            const reportData = await this.generateReportData(request);
            report.data = reportData;
            // Generate file based on format
            if (request.format !== shared_1.ReportFormat.JSON) {
                const filePath = await this.generateReportFile(report, reportData);
                report.filePath = filePath;
            }
            report.status = analytics_interface_1.ReportStatus.COMPLETED;
            this.logger.info(`Report generated successfully: ${report.id}`);
            return report;
        }
        catch (error) {
            this.logger.error(`Failed to generate report ${report.id}:`, error);
            report.status = analytics_interface_1.ReportStatus.FAILED;
            report.error = error instanceof Error ? error.message : 'Unknown error';
            return report;
        }
    }
    async generateReportData(request) {
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
    async generatePerformanceReport(request) {
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
        return {
            timeRange,
            metrics: {
                executionDuration: {
                    current: aggs.avg_duration.value || 0,
                    previous: 0, // Would need previous period data
                    change: 0,
                    changePercent: 0,
                    timeSeries: aggs.duration_histogram.buckets.map((bucket) => ({
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
    async generateUsageReport(request) {
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
        return {
            timeRange,
            totalExecutions: aggs.total_executions.value || 0,
            uniqueUsers: aggs.unique_users.value || 0,
            activeWorkflows: aggs.unique_workflows.value || 0,
            topWorkflows: aggs.top_workflows.buckets.map((bucket) => ({
                workflowId: bucket.key,
                workflowName: `Workflow ${bucket.key}`, // Would need to lookup actual name
                executions: bucket.doc_count,
                successRate: this.calculateSuccessRate(bucket.success_rate),
                avgDuration: bucket.avg_duration.value || 0
            })),
            topUsers: aggs.top_users.buckets.map((bucket) => ({
                userId: bucket.key,
                userName: `User ${bucket.key}`, // Would need to lookup actual name
                executions: bucket.doc_count,
                workflows: bucket.unique_workflows.value,
                lastActivity: new Date(bucket.last_activity.value)
            })),
            executionsByEngine: this.bucketToRecord(aggs.executions_by_engine.buckets),
            executionsByStatus: this.bucketToRecord(aggs.executions_by_status.buckets),
            timeSeries: aggs.executions_over_time.buckets.map((bucket) => ({
                timestamp: new Date(bucket.key),
                value: bucket.doc_count
            }))
        };
    }
    async generateBillingReport(request) {
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
    async generateExecutionSummaryReport(request) {
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
                successful: result.hits.hits.filter((hit) => hit._source.status === 'completed').length,
                failed: result.hits.hits.filter((hit) => hit._source.status === 'failed').length,
                pending: result.hits.hits.filter((hit) => hit._source.status === 'pending').length,
                running: result.hits.hits.filter((hit) => hit._source.status === 'running').length
            }
        };
    }
    async generateWorkflowAnalyticsReport(request) {
        // Implementation for workflow analytics
        return { message: 'Workflow analytics report not yet implemented' };
    }
    async generateUserActivityReport(request) {
        // Implementation for user activity
        return { message: 'User activity report not yet implemented' };
    }
    async generateSystemHealthReport(request) {
        // Implementation for system health
        return { message: 'System health report not yet implemented' };
    }
    async generateReportFile(report, data) {
        const fileName = `${report.id}.${this.getFileExtension(report.format)}`;
        const filePath = (0, path_1.join)(this.reportsDir, fileName);
        switch (report.format) {
            case shared_1.ReportFormat.PDF:
                await this.generatePDFFile(filePath, report, data);
                break;
            case shared_1.ReportFormat.CSV:
                await this.generateCSVFile(filePath, report, data);
                break;
            case shared_1.ReportFormat.HTML:
                await this.generateHTMLFile(filePath, report, data);
                break;
            default:
                throw new Error(`Unsupported report format: ${report.format}`);
        }
        return filePath;
    }
    async generatePDFFile(filePath, report, data) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new pdfkit_1.default();
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
                }
                else if (report.type === 'usage') {
                    yPosition = this.addUsageContentToPDF(doc, data, yPosition);
                }
                else if (report.type === 'billing') {
                    yPosition = this.addBillingContentToPDF(doc, data, yPosition);
                }
                else {
                    doc.fontSize(12).text(JSON.stringify(data, null, 2), 50, yPosition);
                }
                doc.end();
                stream.on('finish', resolve);
                stream.on('error', reject);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    addPerformanceContentToPDF(doc, data, yPosition) {
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
    addUsageContentToPDF(doc, data, yPosition) {
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
    addBillingContentToPDF(doc, data, yPosition) {
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
    async generateCSVFile(filePath, report, data) {
        let records = [];
        let headers = [];
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
        }
        else if (report.type === 'usage' && data.topWorkflows) {
            headers = [
                { id: 'workflowId', title: 'Workflow ID' },
                { id: 'workflowName', title: 'Workflow Name' },
                { id: 'executions', title: 'Executions' },
                { id: 'successRate', title: 'Success Rate (%)' },
                { id: 'avgDuration', title: 'Avg Duration (ms)' }
            ];
            records = data.topWorkflows;
        }
        else {
            // Generic CSV for other report types
            headers = [{ id: 'data', title: 'Data' }];
            records = [{ data: JSON.stringify(data) }];
        }
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: headers
        });
        await csvWriter.writeRecords(records);
    }
    async generateHTMLFile(filePath, report, data) {
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
        await fs_1.promises.writeFile(filePath, html, 'utf8');
    }
    generateHTMLContent(reportType, data) {
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
    generatePerformanceHTML(data) {
        return `
      <h2>Performance Metrics</h2>
      <div class="metric">Average Execution Duration: ${data.metrics.executionDuration.current.toFixed(2)}ms</div>
      <div class="metric">Total Throughput: ${data.metrics.throughput.current}</div>
      <div class="metric">Error Rate: ${data.metrics.errorRate.current.toFixed(2)}%</div>
    `;
    }
    generateUsageHTML(data) {
        const workflowsTable = data.topWorkflows.map(w => `<tr><td>${w.workflowName}</td><td>${w.executions}</td><td>${w.successRate.toFixed(1)}%</td></tr>`).join('');
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
    generateBillingHTML(data) {
        const servicesTable = Object.entries(data.costByService).map(([service, cost]) => `<tr><td>${service}</td><td>$${cost.toFixed(2)}</td></tr>`).join('');
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
    getReportTypes() {
        return [
            {
                id: 'performance',
                name: 'Performance Report',
                description: 'Detailed performance metrics and trends',
                template: 'performance-template',
                parameters: [
                    { name: 'timeRange', type: 'date', required: true },
                    { name: 'includeDetails', type: 'boolean', required: false, defaultValue: true }
                ],
                supportedFormats: [shared_1.ReportFormat.PDF, shared_1.ReportFormat.JSON, shared_1.ReportFormat.HTML]
            },
            {
                id: 'usage',
                name: 'Usage Analytics Report',
                description: 'User and workflow usage statistics',
                template: 'usage-template',
                parameters: [
                    { name: 'timeRange', type: 'date', required: true },
                    { name: 'includeUsers', type: 'boolean', required: false, defaultValue: true },
                    { name: 'includeWorkflows', type: 'boolean', required: false, defaultValue: true }
                ],
                supportedFormats: [shared_1.ReportFormat.PDF, shared_1.ReportFormat.CSV, shared_1.ReportFormat.JSON, shared_1.ReportFormat.HTML]
            },
            {
                id: 'billing',
                name: 'Billing Report',
                description: 'Cost analysis and billing metrics',
                template: 'billing-template',
                parameters: [
                    { name: 'timeRange', type: 'date', required: true },
                    { name: 'currency', type: 'string', required: false, defaultValue: 'USD' }
                ],
                supportedFormats: [shared_1.ReportFormat.PDF, shared_1.ReportFormat.JSON, shared_1.ReportFormat.HTML]
            },
            {
                id: 'execution-summary',
                name: 'Execution Summary Report',
                description: 'Detailed execution logs and summaries',
                template: 'execution-template',
                parameters: [
                    { name: 'timeRange', type: 'date', required: true },
                    { name: 'status', type: 'string', required: false }
                ],
                supportedFormats: [shared_1.ReportFormat.CSV, shared_1.ReportFormat.JSON, shared_1.ReportFormat.HTML]
            }
        ];
    }
    generateReportId() {
        return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getFileExtension(format) {
        switch (format) {
            case shared_1.ReportFormat.PDF: return 'pdf';
            case shared_1.ReportFormat.CSV: return 'csv';
            case shared_1.ReportFormat.HTML: return 'html';
            case shared_1.ReportFormat.JSON: return 'json';
            default: return 'txt';
        }
    }
    getDefaultTimeRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30); // Last 30 days
        return { start, end };
    }
    calculateErrorRate(successRateAgg) {
        const successful = successRateAgg.buckets.successful?.doc_count || 0;
        const failed = successRateAgg.buckets.failed?.doc_count || 0;
        const total = successful + failed;
        return total > 0 ? (failed / total) * 100 : 0;
    }
    calculateSuccessRate(successRateAgg) {
        const successful = successRateAgg.buckets.successful?.doc_count || 0;
        const total = successRateAgg.buckets.total?.doc_count || 0;
        return total > 0 ? (successful / total) * 100 : 0;
    }
    bucketToRecord(buckets) {
        const record = {};
        buckets.forEach(bucket => {
            record[bucket.key] = bucket.doc_count;
        });
        return record;
    }
    async cleanup() {
        // Cleanup any resources if needed
        this.logger.info('Report generator service cleaned up');
    }
}
exports.ReportGeneratorService = ReportGeneratorService;
//# sourceMappingURL=report-generator.service.js.map