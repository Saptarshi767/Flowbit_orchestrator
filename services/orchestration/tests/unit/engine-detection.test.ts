import { describe, it, expect } from 'vitest';
import { EngineDetection } from '../../src/utils/engine-detection';
import { EngineType, WorkflowDefinition } from './test-types';

describe('EngineDetection', () => {
  describe('detectEngineType', () => {
    it('should return null for invalid input', () => {
      expect(EngineDetection.detectEngineType(null)).toBeNull();
      expect(EngineDetection.detectEngineType(undefined)).toBeNull();
      expect(EngineDetection.detectEngineType('string')).toBeNull();
      expect(EngineDetection.detectEngineType(123)).toBeNull();
    });

    it('should return explicit engine type when set', () => {
      const workflow = {
        engineType: EngineType.LANGFLOW,
        definition: {}
      };

      expect(EngineDetection.detectEngineType(workflow)).toBe(EngineType.LANGFLOW);
    });

    it('should detect Langflow from structure', () => {
      const langflowWorkflow = {
        nodes: [
          {
            id: 'node1',
            data: {
              type: 'ChatInput',
              node: {
                template: {},
                base_classes: ['BaseComponent']
              }
            }
          }
        ],
        edges: []
      };

      expect(EngineDetection.detectEngineType(langflowWorkflow)).toBe(EngineType.LANGFLOW);
    });

    it('should detect Langflow from node types', () => {
      const langflowWorkflow = {
        nodes: [
          {
            id: 'node1',
            data: {
              type: 'LLMChain'
            }
          }
        ],
        edges: []
      };

      expect(EngineDetection.detectEngineType(langflowWorkflow)).toBe(EngineType.LANGFLOW);
    });

    it('should detect N8N from structure', () => {
      const n8nWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'n8n-nodes-base.start',
            parameters: {},
            typeVersion: 1
          }
        ],
        connections: {}
      };

      expect(EngineDetection.detectEngineType(n8nWorkflow)).toBe(EngineType.N8N);
    });

    it('should detect N8N from node types', () => {
      const n8nWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'n8n-nodes-base.httpRequest',
            parameters: {}
          }
        ],
        connections: {}
      };

      expect(EngineDetection.detectEngineType(n8nWorkflow)).toBe(EngineType.N8N);
    });

    it('should detect LangSmith from chain structure', () => {
      const langsmithWorkflow = {
        chain: {
          type: 'sequential',
          steps: []
        }
      };

      expect(EngineDetection.detectEngineType(langsmithWorkflow)).toBe(EngineType.LANGSMITH);
    });

    it('should detect LangSmith from runnable structure', () => {
      const langsmithWorkflow = {
        runnable: {
          invoke: true,
          stream: true
        }
      };

      expect(EngineDetection.detectEngineType(langsmithWorkflow)).toBe(EngineType.LANGSMITH);
    });

    it('should detect LangSmith from components', () => {
      const langsmithWorkflow = {
        components: [
          {
            _type: 'ChatPromptTemplate',
            config: {}
          }
        ]
      };

      expect(EngineDetection.detectEngineType(langsmithWorkflow)).toBe(EngineType.LANGSMITH);
    });

    it('should return null for unrecognizable structure', () => {
      const unknownWorkflow = {
        someProperty: 'value',
        anotherProperty: 123
      };

      expect(EngineDetection.detectEngineType(unknownWorkflow)).toBeNull();
    });
  });

  describe('validateEngineCompatibility', () => {
    it('should validate compatible Langflow workflow', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          nodes: [
            {
              id: 'node1',
              data: { type: 'ChatInput' }
            }
          ],
          edges: []
        }
      };

      const result = EngineDetection.validateEngineCompatibility(workflow, EngineType.LANGFLOW);

      expect(result.isCompatible).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect incompatible engine type', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.N8N,
        definition: {
          nodes: [
            {
              type: 'n8n-nodes-base.start'
            }
          ],
          connections: {}
        }
      };

      const result = EngineDetection.validateEngineCompatibility(workflow, EngineType.LANGFLOW);

      expect(result.isCompatible).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.issues).toContain('Workflow appears to be designed for n8n, not langflow');
      expect(result.suggestions).toContain('Consider using the n8n adapter instead');
    });

    it('should validate N8N workflow structure', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.N8N,
        definition: {
          nodes: [],
          connections: {}
        }
      };

      const result = EngineDetection.validateEngineCompatibility(workflow, EngineType.N8N);

      expect(result.isCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify missing N8N structure', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.N8N,
        definition: {
          someOtherProperty: 'value'
        }
      };

      const result = EngineDetection.validateEngineCompatibility(workflow, EngineType.N8N);

      expect(result.isCompatible).toBe(false);
      expect(result.issues).toContain('N8N workflows must have a nodes array');
      expect(result.issues).toContain('N8N workflows must have a connections object');
    });

    it('should validate LangSmith workflow structure', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          chain: {
            type: 'sequential'
          }
        }
      };

      const result = EngineDetection.validateEngineCompatibility(workflow, EngineType.LANGSMITH);

      expect(result.isCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify missing LangSmith structure', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          someOtherProperty: 'value'
        }
      };

      const result = EngineDetection.validateEngineCompatibility(workflow, EngineType.LANGSMITH);

      expect(result.isCompatible).toBe(false);
      expect(result.issues).toContain('LangSmith workflows must have chain, runnable, steps, or components definition');
    });

    it('should handle unknown workflow type with medium confidence', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          unknownStructure: 'value'
        }
      };

      const result = EngineDetection.validateEngineCompatibility(workflow, EngineType.LANGFLOW);

      expect(result.confidence).toBe(0.5);
      expect(result.issues).toContain('Unable to definitively detect workflow engine type');
      expect(result.suggestions).toContain('Ensure workflow definition follows the expected format');
    });
  });

  describe('getSupportedEngineTypes', () => {
    it('should return all supported engine types', () => {
      const supportedTypes = EngineDetection.getSupportedEngineTypes();

      expect(supportedTypes).toContain(EngineType.LANGFLOW);
      expect(supportedTypes).toContain(EngineType.N8N);
      expect(supportedTypes).toContain(EngineType.LANGSMITH);
      expect(supportedTypes).toHaveLength(3);
    });
  });

  describe('isEngineTypeSupported', () => {
    it('should return true for supported engine types', () => {
      expect(EngineDetection.isEngineTypeSupported('langflow')).toBe(true);
      expect(EngineDetection.isEngineTypeSupported('n8n')).toBe(true);
      expect(EngineDetection.isEngineTypeSupported('langsmith')).toBe(true);
    });

    it('should return false for unsupported engine types', () => {
      expect(EngineDetection.isEngineTypeSupported('unknown')).toBe(false);
      expect(EngineDetection.isEngineTypeSupported('zapier')).toBe(false);
      expect(EngineDetection.isEngineTypeSupported('')).toBe(false);
    });
  });
});