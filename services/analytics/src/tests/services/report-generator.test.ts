import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { promises as fs } from 'fs';
import winston from 'winston';
import { ReportGeneratorService } from '../../services/report-generator.service';
import { ElasticsearchPipelineService } from '../../services/elasticsearch-pipeline.service';
import { ReportStatus } from '../../interfaces/analytics.interface';
import { ReportFormat } from '@robust-ai-orchestrator/shared';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn()
  }
}));

vi.mock('pdfkit', () => {
  const mockDoc = {
    fontSize: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    pipe: vi.fn(),
    end: vi.fn()
  };
  return {
    default: vi.fn(() => mockDoc)
  };
});

vi.mock('csv-writer', () => ({
  createObjectCsvWriter: vi.fn(() => ({
    writeRecords: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('ReportGeneratorService', () => {
  let service: ReportGeneratorService;
  let mockElasticsearchService: any;
  let logger: winston.Logger;

  beforeEach(() => {
    // Create mock Elasticsearch service
    mockElasticsearchService = {
      queryData: vi.fn()
    };

    // Create test logger
    logger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })]
    });

    service = new ReportGeneratorService(mockElasticsearchService, logger);

    // Mock fs.mkdir
    (fs.mkdir as Mock).mockResolvedValue(undefined);
  });

  describe('generateReport', () => {
    it('should generate performance report successfully', async () => {
      const mockQueryResult = {
        aggregations: {
          avg_duration: { value: 2500 },
          max_duration: { value: 5000 },
          min_duration: { value: 1000 },
          total_executions: { value: 100 },
          success_rate: {
            buckets: {
              successful: { doc_count: 90 },
              failed: { doc_count: 10 }
            }
          },
          duration_histogram: {
            buckets: [
              { key: 1640995200000, avg_duration: { value: 2000 } },
              { key: 1640998800000, avg_duration: { value: 3000 } }
            ]
          }
        }
      };

      mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);

      const reportRequest = {
        type: 'performance',
        name: 'Test Performance Report',
        parameters: {},
        format: ReportFormat.JSON,
        organizationId: 'org-1',
        userId: 'user-1',
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        }
      };

      const report = await service.generateReport(reportRequest);

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.type).toBe('performance');
      expect(report.status).toBe(ReportStatus.COMPLETED);
      expect(report.data).toBeDefined();
      expect(report.data.metrics).toBeDefined();
      expect(report.data.metrics.executionDuration).toBeDefined();
    });

    it('should generate usage report successfully', async () => {
      const mockQueryResult = {
        aggregations: {
          total_executions: { value: 150 },
          unique_users: { value: 25 },
          unique_workflows: { value: 10 },
          top_workflows: {
            buckets: [
              {
                key: 'workflow-1',
                doc_count: 50,
                workflow_name: { buckets: [{ key: 'Test Workflow 1' }] },
                success_count: { doc_count: 45 },
                avg_duration: { value: 2000 }
              }
            ]
          },
          top_users: {
            buckets: [
              {
                key: 'user-1',
                doc_count: 30,
                user_name: { buckets: [{ key: 'Test User 1' }] },
                unique_workflows: { value: 5 },
                last_activity: { value: Date.now() }
              }
            ]
          },
          executions_by_engine: {
            buckets: [
              { key: 'langflow', doc_count: 80 },
              { key: 'n8n', doc_count: 70 }
            ]
          },
          executions_by_status: {
            buckets: [
              { key: 'completed', doc_count: 130 },
              { key: 'failed', doc_count: 20 }
            ]
          },
          executions_over_time: {
            buckets: [
              { key: 1640995200000, doc_count: 75 },
              { key: 1640998800000, doc_count: 75 }
            ]
          }
        }
      };

      mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);

      const reportRequest = {
        type: 'usage',
        name: 'Test Usage Report',
        parameters: {},
        format: ReportFormat.JSON,
        organizationId: 'org-1',
        userId: 'user-1',
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        }
      };

      const report = await service.generateReport(reportRequest);

      expect(report).toBeDefined();
      expect(report.type).toBe('usage');
      expect(report.status).toBe(ReportStatus.COMPLETED);
      expect(report.data).toBeDefined();
      expect(report.data.totalExecutions).toBe(150);
      expect(report.data.uniqueUsers).toBe(25);
      expect(report.data.topWorkflows).toHaveLength(1);
      expect(report.data.topUsers).toHaveLength(1);
    });

    it('should generate billing report successfully', async () => {
      const reportRequest = {
        type: 'billing',
        name: 'Test Billing Report',
        parameters: {},
        format: ReportFormat.JSON,
        organizationId: 'org-1',
        userId: 'user-1',
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        }
      };

      const report = await service.generateReport(reportRequest);

      expect(report).toBeDefined();
      expect(report.type).toBe('billing');
      expect(report.status).toBe(ReportStatus.COMPLETED);
      expect(report.data).toBeDefined();
      expect(report.data.totalCost).toBeGreaterThanOrEqual(0);
      expect(report.data.costByService).toBeDefined();
      expect(report.data.executionCosts).toBeDefined();
    });

    it('should generate execution summary report successfully', async () => {
      const mockQueryResult = {
        hits: {
          total: { value: 50 },
          hits: [
            {
              _source: {
                executionId: 'exec-1',
                workflowId: 'workflow-1',
                status: 'completed',
                engineType: 'langflow',
                duration: 2000,
                timestamp: new Date().toISOString()
              }
            },
            {
              _source: {
                executionId: 'exec-2',
                workflowId: 'workflow-2',
                status: 'failed',
                engineType: 'n8n',
                duration: 1500,
                timestamp: new Date().toISOString()
              }
            }
          ]
        }
      };

      mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);

      const reportRequest = {
        type: 'execution-summary',
        name: 'Test Execution Summary',
        parameters: {},
        format: ReportFormat.JSON,
        organizationId: 'org-1',
        userId: 'user-1',
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        }
      };

      const report = await service.generateReport(reportRequest);

      expect(report).toBeDefined();
      expect(report.type).toBe('execution-summary');
      expect(report.status).toBe(ReportStatus.COMPLETED);
      expect(report.data).toBeDefined();
      expect(report.data.totalExecutions).toBe(50);
      expect(report.data.executions).toHaveLength(2);
      expect(report.data.summary).toBeDefined();
      expect(report.data.summary.successful).toBe(1);
      expect(report.data.summary.failed).toBe(1);
    });

    it('should handle unknown report type', async () => {
      const reportRequest = {
        type: 'unknown-type',
        name: 'Unknown Report',
        parameters: {},
        format: ReportFormat.JSON,
        organizationId: 'org-1',
        userId: 'user-1'
      };

      const report = await service.generateReport(reportRequest);

      expect(report.status).toBe(ReportStatus.FAILED);
      expect(report.error).toContain('Unknown report type');
    });

    it('should handle Elasticsearch query errors', async () => {
      mockElasticsearchService.queryData.mockRejectedValue(new Error('Query failed'));

      const reportRequest = {
        type: 'performance',
        name: 'Test Report',
        parameters: {},
        format: ReportFormat.JSON,
        organizationId: 'org-1',
        userId: 'user-1'
      };

      const report = await service.generateReport(reportRequest);

      expect(report.status).toBe(ReportStatus.FAILED);
      expect(report.error).toContain('Query failed');
    });
  });

  describe('PDF report generation', () => {
    it('should generate PDF file for performance report', async () => {
      const mockQueryResult = {
        aggregations: {
          avg_duration: { value: 2500 },
          total_executions: { value: 100 },
          success_rate: {
            buckets: {
              successful: { doc_count: 90 },
              failed: { doc_count: 10 }
            }
          },
          duration_histogram: { buckets: [] }
        }
      };

      mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);

      // Mock PDF generation
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 10);
          }
        })
      };

      // Mock fs.createWriteStream
      const mockCreateWriteStream = vi.fn(() => mockStream);
      vi.doMock('fs', () => ({
        createWriteStream: mockCreateWriteStream,
        promises: { mkdir: vi.fn() }
      }));

      const reportRequest = {
        type: 'performance',
        name: 'Test PDF Report',
        parameters: {},
        format: ReportFormat.PDF,
        organizationId: 'org-1',
        userId: 'user-1'
      };

      const report = await service.generateReport(reportRequest);

      expect(report.status).toBe(ReportStatus.COMPLETED);
      expect(report.filePath).toBeDefined();
      expect(report.filePath).toContain('.pdf');
    });
  });

  describe('CSV report generation', () => {
    it('should generate CSV file for execution summary', async () => {
      const mockQueryResult = {
        hits: {
          total: { value: 2 },
          hits: [
            {
              _source: {
                executionId: 'exec-1',
                workflowId: 'workflow-1',
                status: 'completed',
                engineType: 'langflow',
                duration: 2000,
                timestamp: new Date().toISOString()
              }
            }
          ]
        }
      };

      mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);

      const reportRequest = {
        type: 'execution-summary',
        name: 'Test CSV Report',
        parameters: {},
        format: ReportFormat.CSV,
        organizationId: 'org-1',
        userId: 'user-1'
      };

      const report = await service.generateReport(reportRequest);

      expect(report.status).toBe(ReportStatus.COMPLETED);
      expect(report.filePath).toBeDefined();
      expect(report.filePath).toContain('.csv');
    });
  });

  describe('HTML report generation', () => {
    it('should generate HTML file for usage report', async () => {
      const mockQueryResult = {
        aggregations: {
          total_executions: { value: 100 },
          unique_users: { value: 10 },
          unique_workflows: { value: 5 },
          top_workflows: { buckets: [] },
          top_users: { buckets: [] },
          executions_by_engine: { buckets: [] },
          executions_by_status: { buckets: [] },
          executions_over_time: { buckets: [] }
        }
      };

      mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
      (fs.writeFile as Mock).mockResolvedValue(undefined);

      const reportRequest = {
        type: 'usage',
        name: 'Test HTML Report',
        parameters: {},
        format: ReportFormat.HTML,
        organizationId: 'org-1',
        userId: 'user-1'
      };

      const report = await service.generateReport(reportRequest);

      expect(report.status).toBe(ReportStatus.COMPLETED);
      expect(report.filePath).toBeDefined();
      expect(report.filePath).toContain('.html');
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('getReportTypes', () => {
    it('should return available report types', () => {
      const reportTypes = service.getReportTypes();

      expect(reportTypes).toBeDefined();
      expect(Array.isArray(reportTypes)).toBe(true);
      expect(reportTypes.length).toBeGreaterThan(0);

      const performanceReport = reportTypes.find(rt => rt.id === 'performance');
      expect(performanceReport).toBeDefined();
      expect(performanceReport?.name).toBe('Performance Report');
      expect(performanceReport?.supportedFormats).toContain(ReportFormat.PDF);
      expect(performanceReport?.supportedFormats).toContain(ReportFormat.JSON);

      const usageReport = reportTypes.find(rt => rt.id === 'usage');
      expect(usageReport).toBeDefined();
      expect(usageReport?.supportedFormats).toContain(ReportFormat.CSV);

      const billingReport = reportTypes.find(rt => rt.id === 'billing');
      expect(billingReport).toBeDefined();

      const executionReport = reportTypes.find(rt => rt.id === 'execution-summary');
      expect(executionReport).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle file system errors during PDF generation', async () => {
      const mockQueryResult = {
        aggregations: {
          avg_duration: { value: 2500 },
          total_executions: { value: 100 },
          success_rate: { buckets: { successful: { doc_count: 90 }, failed: { doc_count: 10 } } },
          duration_histogram: { buckets: [] }
        }
      };

      mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);

      // Mock stream error
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('File write error')), 10);
          }
        })
      };

      const mockCreateWriteStream = vi.fn(() => mockStream);
      vi.doMock('fs', () => ({
        createWriteStream: mockCreateWriteStream,
        promises: { mkdir: vi.fn() }
      }));

      const reportRequest = {
        type: 'performance',
        name: 'Test Error Report',
        parameters: {},
        format: ReportFormat.PDF,
        organizationId: 'org-1',
        userId: 'user-1'
      };

      const report = await service.generateReport(reportRequest);

      expect(report.status).toBe(ReportStatus.FAILED);
      expect(report.error).toBeDefined();
    });

    it('should handle unsupported report format', async () => {
      const mockQueryResult = {
        aggregations: {
          avg_duration: { value: 2500 },
          total_executions: { value: 100 },
          success_rate: { buckets: { successful: { doc_count: 90 }, failed: { doc_count: 10 } } },
          duration_histogram: { buckets: [] }
        }
      };

      mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);

      const reportRequest = {
        type: 'performance',
        name: 'Test Unsupported Format',
        parameters: {},
        format: 'UNSUPPORTED' as ReportFormat,
        organizationId: 'org-1',
        userId: 'user-1'
      };

      const report = await service.generateReport(reportRequest);

      expect(report.status).toBe(ReportStatus.FAILED);
      expect(report.error).toContain('Unsupported report format');
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', async () => {
      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });
});