import { describe, it, expect, vi } from 'vitest';
import { WorkflowConverter } from '../../src/utils/workflow-converter';
import { EngineType, WorkflowDefinition } from './test-types';

// Mock the logger
vi.mock('../../src/utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('WorkflowConverter', () => {
  describe('convertWorkflow', () => {
    it('should return same workflow if source and target engines are the same', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const result = await WorkflowConverter.convertWorkflow(workflow, EngineType.LANGFLOW);

      expect(result).toEqual(workflow);
      expect(result).not.toBe(workflow); // Should be a copy
    });

    it('should convert Langflow to N8N', async () => {
      const langflowWorkflow: WorkflowDefinition = {
        name: 'Langflow Workflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          nodes: [
            {
              id: 'node1',
              data: {
                display_name: 'Chat Input',
                type: 'ChatInput'
              },
              position: { x: 100, y: 100 }
            }
          ],
          edges: [
            {
              id: 'edge1',
              source: 'node1',
              target: 'node2'
            }
          ]
        }
      };

      const result = await WorkflowConverter.convertWorkflow(langflowWorkflow, EngineType.N8N);

      expect(result.engineType).toBe(EngineType.N8N);
      expect(result.definition.nodes).toBeDefined();
      expect(result.definition.connections).toBeDefined();
      expect(result.definition.active).toBe(true);
    });

    it('should convert Langflow to LangSmith', async () => {
      const langflowWorkflow: WorkflowDefinition = {
        name: 'Langflow Workflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          nodes: [
            {
              id: 'node1',
              data: {
                display_name: 'Chat Input',
                type: 'ChatInput'
              }
            }
          ],
          edges: []
        }
      };

      const result = await WorkflowConverter.convertWorkflow(langflowWorkflow, EngineType.LANGSMITH);

      expect(result.engineType).toBe(EngineType.LANGSMITH);
      expect(result.definition.components).toBeDefined();
      expect(result.definition.steps).toBeDefined();
      expect(result.definition.chain_type).toBe('sequential');
    });

    it('should convert N8N to Langflow', async () => {
      const n8nWorkflow: WorkflowDefinition = {
        name: 'N8N Workflow',
        engineType: EngineType.N8N,
        definition: {
          nodes: [
            {
              id: 'node1',
              name: 'Start Node',
              type: 'n8n-nodes-base.start',
              position: [100, 100]
            }
          ],
          connections: {
            'node1': {
              main: [[{ node: 'node2', type: 'main', index: 0 }]]
            }
          }
        }
      };

      const result = await WorkflowConverter.convertWorkflow(n8nWorkflow, EngineType.LANGFLOW);

      expect(result.engineType).toBe(EngineType.LANGFLOW);
      expect(result.definition.nodes).toBeDefined();
      expect(result.definition.edges).toBeDefined();
      expect(result.definition.viewport).toBeDefined();
    });

    it('should convert N8N to LangSmith', async () => {
      const n8nWorkflow: WorkflowDefinition = {
        name: 'N8N Workflow',
        engineType: EngineType.N8N,
        definition: {
          nodes: [
            {
              id: 'node1',
              name: 'HTTP Request',
              type: 'n8n-nodes-base.httpRequest'
            }
          ],
          connections: {}
        }
      };

      const result = await WorkflowConverter.convertWorkflow(n8nWorkflow, EngineType.LANGSMITH);

      expect(result.engineType).toBe(EngineType.LANGSMITH);
      expect(result.definition.steps).toBeDefined();
      expect(result.definition.chain_type).toBe('sequential');
    });

    it('should convert LangSmith to Langflow', async () => {
      const langsmithWorkflow: WorkflowDefinition = {
        name: 'LangSmith Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          steps: [
            {
              name: 'prompt_step',
              component: 'ChatPromptTemplate',
              config: { template: 'Hello {input}' }
            },
            {
              name: 'llm_step',
              component: 'LLMChain',
              config: {}
            }
          ]
        }
      };

      const result = await WorkflowConverter.convertWorkflow(langsmithWorkflow, EngineType.LANGFLOW);

      expect(result.engineType).toBe(EngineType.LANGFLOW);
      expect(result.definition.nodes).toBeDefined();
      expect(result.definition.edges).toBeDefined();
      expect(result.definition.nodes).toHaveLength(2);
      expect(result.definition.edges).toHaveLength(1); // Sequential connection
    });

    it('should convert LangSmith to N8N', async () => {
      const langsmithWorkflow: WorkflowDefinition = {
        name: 'LangSmith Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          steps: [
            {
              name: 'step1',
              component: 'CustomComponent',
              config: {}
            }
          ]
        }
      };

      const result = await WorkflowConverter.convertWorkflow(langsmithWorkflow, EngineType.N8N);

      expect(result.engineType).toBe(EngineType.N8N);
      expect(result.definition.nodes).toBeDefined();
      expect(result.definition.connections).toBeDefined();
    });

    it('should throw error for unsupported conversion', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: 'unsupported' as EngineType,
        definition: {}
      };

      await expect(
        WorkflowConverter.convertWorkflow(workflow, EngineType.LANGFLOW)
      ).rejects.toThrow('Conversion from unsupported to langflow is not supported');
    });
  });

  describe('getConversionMatrix', () => {
    it('should return correct conversion matrix', () => {
      const matrix = WorkflowConverter.getConversionMatrix();

      expect(matrix[EngineType.LANGFLOW]).toContain(EngineType.N8N);
      expect(matrix[EngineType.LANGFLOW]).toContain(EngineType.LANGSMITH);
      expect(matrix[EngineType.N8N]).toContain(EngineType.LANGFLOW);
      expect(matrix[EngineType.N8N]).toContain(EngineType.LANGSMITH);
      expect(matrix[EngineType.LANGSMITH]).toContain(EngineType.LANGFLOW);
      expect(matrix[EngineType.LANGSMITH]).toContain(EngineType.N8N);
    });
  });

  describe('isConversionSupported', () => {
    it('should return true for supported conversions', () => {
      expect(WorkflowConverter.isConversionSupported(EngineType.LANGFLOW, EngineType.N8N)).toBe(true);
      expect(WorkflowConverter.isConversionSupported(EngineType.LANGFLOW, EngineType.LANGSMITH)).toBe(true);
      expect(WorkflowConverter.isConversionSupported(EngineType.N8N, EngineType.LANGFLOW)).toBe(true);
      expect(WorkflowConverter.isConversionSupported(EngineType.N8N, EngineType.LANGSMITH)).toBe(true);
      expect(WorkflowConverter.isConversionSupported(EngineType.LANGSMITH, EngineType.LANGFLOW)).toBe(true);
      expect(WorkflowConverter.isConversionSupported(EngineType.LANGSMITH, EngineType.N8N)).toBe(true);
    });

    it('should return false for same engine conversion', () => {
      expect(WorkflowConverter.isConversionSupported(EngineType.LANGFLOW, EngineType.LANGFLOW)).toBe(false);
      expect(WorkflowConverter.isConversionSupported(EngineType.N8N, EngineType.N8N)).toBe(false);
      expect(WorkflowConverter.isConversionSupported(EngineType.LANGSMITH, EngineType.LANGSMITH)).toBe(false);
    });

    it('should handle unsupported engine types gracefully', () => {
      const unsupportedEngine = 'unsupported' as EngineType;
      expect(WorkflowConverter.isConversionSupported(unsupportedEngine, EngineType.LANGFLOW)).toBe(false);
      expect(WorkflowConverter.isConversionSupported(EngineType.LANGFLOW, unsupportedEngine)).toBe(false);
    });
  });

  describe('node conversion methods', () => {
    it('should convert Langflow ChatInput node to LangSmith component', async () => {
      const langflowNode = {
        id: 'node1',
        data: {
          type: 'ChatInput',
          node: {
            template: {
              input_value: { value: 'Hello {input}' }
            }
          }
        }
      };

      const component = await WorkflowConverter['convertLangflowNodeToLangSmith'](langflowNode);

      expect(component._type).toBe('ChatPromptTemplate');
      expect(component.config.template).toBe('Hello {input}');
    });

    it('should convert Langflow LLMChain node to LangSmith component', async () => {
      const langflowNode = {
        id: 'node1',
        data: {
          type: 'LLMChain',
          node: {
            template: {
              llm: { value: 'gpt-3.5-turbo' },
              prompt: { value: 'test prompt' }
            }
          }
        }
      };

      const component = await WorkflowConverter['convertLangflowNodeToLangSmith'](langflowNode);

      expect(component._type).toBe('LLMChain');
      expect(component.config.llm).toEqual({ value: 'gpt-3.5-turbo' });
      expect(component.config.prompt).toEqual({ value: 'test prompt' });
    });

    it('should convert unknown Langflow node to custom component', async () => {
      const langflowNode = {
        id: 'node1',
        data: {
          type: 'UnknownNode',
          node: {
            template: {
              param1: { value: 'test' }
            }
          }
        }
      };

      const component = await WorkflowConverter['convertLangflowNodeToLangSmith'](langflowNode);

      expect(component._type).toBe('CustomComponent');
      expect(component.config.original_type).toBe('UnknownNode');
      expect(component.config.parameters).toEqual({
        param1: { value: 'test' }
      });
    });
  });
});