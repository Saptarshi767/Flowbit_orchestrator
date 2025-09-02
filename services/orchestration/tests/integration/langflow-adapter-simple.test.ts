import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { LangflowAdapter } from '../../src/adapters/langflow-adapter';
import { EngineAdapterConfig } from '../../src/interfaces/engine-adapter.interface';

// Local type definitions for testing
enum EngineType {
  LANGFLOW = 'langflow',
  N8N = 'n8n',
  LANGSMITH = 'langsmith'
}

enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  engineType: EngineType;
  definition: any;
  version?: number;
  metadata?: Record<string, any>;
}

interface WorkflowParameters {
  [key: string]: any;
}

describe('LangflowAdapter Simple Integration Tests', () => {
  let mockServer: Server;
  let adapter: LangflowAdapter;
  let mockPort: number;
  let mockBaseUrl: string;

  beforeAll(async () => {
    mockPort = 3002;
    mockBaseUrl = `http://localhost:${mockPort}`;

    // Create simple mock server
    const app = express();
    app.use(express.json());

    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    app.get('/api/v1/version', (req, res) => {
      res.json({ version: '1.0.0' });
    });

    app.post('/api/v1/validate', (req, res) => {
      res.json({ valid: true });
    });

    app.post('/api/v1/run/:flowId', (req, res) => {
      res.json({
        session_id: 'test-session',
        outputs: [{ outputs: [{ results: { message: 'Success' } }] }]
      });
    });

    app.get('/api/v1/status/:sessionId', (req, res) => {
      res.json({ status: 'completed', result: { message: 'Success' } });
    });

    app.get('/api/v1/logs/:sessionId', (req, res) => {
      res.json({ logs: [{ message: 'Test log', level: 'info', timestamp: new Date().toISOString() }] });
    });

    app.get('/api/v1/all', (req, res) => {
      res.json({ TestComponent: { name: 'TestComponent' } });
    });

    mockServer = app.listen(mockPort);
    await new Promise<void>((resolve) => {
      mockServer.on('listening', resolve);
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    const config: EngineAdapterConfig = {
      baseUrl: mockBaseUrl,
      apiKey: 'test-key',
      timeout: 5000,
      retryConfig: {
        maxAttempts: 2,
        initialDelay: 100,
        maxDelay: 500,
        backoffFactor: 2
      }
    };

    adapter = new LangflowAdapter(config);
  });

  it('should test connection successfully', async () => {
    const result = await adapter.testConnection();
    expect(result).toBe(true);
  });

  it('should get capabilities', async () => {
    const capabilities = await adapter.getCapabilities();
    expect(capabilities.version).toBe('1.0.0');
    expect(capabilities.supportedNodeTypes).toContain('TestComponent');
  });

  it('should validate workflow', async () => {
    const workflow: WorkflowDefinition = {
      name: 'Test Workflow',
      engineType: EngineType.LANGFLOW,
      definition: {
        data: {
          nodes: [{ id: 'node1', type: 'test', data: { type: 'test', node: {} } }],
          edges: []
        }
      }
    };

    const result = await adapter.validateWorkflow(workflow);
    expect(result.isValid).toBe(true);
  });

  it('should execute workflow', async () => {
    const workflow: WorkflowDefinition = {
      name: 'Test Workflow',
      engineType: EngineType.LANGFLOW,
      definition: {
        data: { nodes: [], edges: [] }
      }
    };

    const parameters: WorkflowParameters = {
      input_value: 'test input'
    };

    const result = await adapter.executeWorkflow(workflow, parameters);
    expect(result.status).toBe(ExecutionStatus.COMPLETED);
    expect(result.id).toBeDefined();
  });

  it('should get execution status', async () => {
    const result = await adapter.getExecutionStatus('test-session');
    expect(result.status).toBe(ExecutionStatus.COMPLETED);
    expect(result.result).toBeDefined();
  });

  it('should get execution logs', async () => {
    const logs = await adapter.getExecutionLogs('test-session');
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('Test log');
    expect(logs[0].level).toBe('info');
  });
});