import { LangSmithAdapter } from '../../src/adapters/langsmith-adapter';
import { EngineAdapterConfig } from '../../src/interfaces/engine-adapter.interface';
import {
  WorkflowDefinition,
  EngineType,
  ExecutionStatus
} from '@robust-ai-orchestrator/shared';

describe('LangSmithAdapter Simple Tests', () => {
  let adapter: LangSmithAdapter;
  let config: EngineAdapterConfig;

  beforeEach(() => {
    config = {
      baseUrl: 'https://api.langsmith.test',
      apiKey: 'test-api-key',
      timeout: 5000,
      retryConfig: {
        maxAttempts: 1,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2
      }
    };

    adapter = new LangSmithAdapter(config);
  });

  describe('Basic Functionality', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(LangSmithAdapter);
      expect(adapter.engineType).toBe(EngineType.LANGSMITH);
    });

    it('should validate workflow structure', async () => {
      const validWorkflow: WorkflowDefinition = {
        name: 'Simple LangSmith Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Simple LangSmith Workflow',
          chain: [
            {
              id: 'step1',
              type: 'llm',
              name: 'LLM Step',
              parameters: {
                model: 'gpt-3.5-turbo',
                temperature: 0.7
              }
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(validWorkflow);
      
      // Should pass basic validation even without API call
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        name: 'Invalid Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Invalid Workflow',
          chain: [
            {
              // Missing id
              type: 'llm',
              name: 'LLM Step',
              parameters: {
                // Missing model for LLM
                temperature: 0.7
              }
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(invalidWorkflow);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const errorCodes = result.errors.map(e => e.code);
      expect(errorCodes).toContain('MISSING_STEP_ID');
      expect(errorCodes).toContain('MISSING_LLM_MODEL');
    });

    it('should handle empty chain', async () => {
      const emptyWorkflow: WorkflowDefinition = {
        name: 'Empty Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Empty Workflow',
          chain: []
        }
      };

      const result = await adapter.validateWorkflow(emptyWorkflow);
      
      expect(result.isValid).toBe(true); // Empty chain is valid but generates warning
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('EMPTY_CHAIN');
    });

    it('should validate step types', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Step Type Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Step Type Test',
          chain: [
            {
              id: 'valid_step',
              type: 'llm',
              name: 'Valid Step',
              parameters: { model: 'gpt-3.5-turbo' }
            },
            {
              id: 'invalid_step',
              type: 'invalid_type',
              name: 'Invalid Step',
              parameters: {}
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(workflow);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_STEP_TYPE')).toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Network Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Network Test',
          chain: [
            {
              id: 'step1',
              type: 'llm',
              name: 'LLM Step',
              parameters: { model: 'gpt-3.5-turbo' }
            }
          ]
        }
      };

      // This will fail due to network error, but should be handled gracefully
      const result = await adapter.executeWorkflow(workflow, {});
      
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBeDefined();
    });

    it('should return default capabilities on connection failure', async () => {
      const capabilities = await adapter.getCapabilities();
      
      // Should return default capabilities when API is not available
      expect(capabilities.version).toBe('unknown');
      expect(capabilities.supportedFeatures).toContain('chain_execution');
      expect(capabilities.maxConcurrentExecutions).toBe(1);
      expect(capabilities.supportedNodeTypes).toContain('llm');
    });

    it('should handle connection test failure', async () => {
      const result = await adapter.testConnection();
      
      // Should return false when connection fails
      expect(result).toBe(false);
    });

    it('should handle execution status for non-existent execution', async () => {
      const result = await adapter.getExecutionStatus('non-existent-id');
      
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
    });

    it('should handle logs retrieval for non-existent execution', async () => {
      const logs = await adapter.getExecutionLogs('non-existent-id');
      
      expect(logs).toEqual([]);
    });

    it('should handle cancellation for non-existent execution', async () => {
      const result = await adapter.cancelExecution('non-existent-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Workflow Validation Edge Cases', () => {
    it('should detect duplicate step IDs', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Duplicate ID Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Duplicate ID Test',
          chain: [
            {
              id: 'duplicate_id',
              type: 'prompt',
              name: 'Step 1',
              parameters: { template: 'test' }
            },
            {
              id: 'duplicate_id',
              type: 'llm',
              name: 'Step 2',
              parameters: { model: 'gpt-3.5-turbo' }
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(workflow);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_STEP_ID')).toBe(true);
    });

    it('should validate prompt step parameters', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Prompt Validation Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Prompt Validation Test',
          chain: [
            {
              id: 'prompt_step',
              type: 'prompt',
              name: 'Prompt Step',
              parameters: {
                // Missing template and messages
                input_variables: ['name']
              }
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(workflow);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_PROMPT_TEMPLATE')).toBe(true);
    });

    it('should validate retriever step parameters', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Retriever Validation Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Retriever Validation Test',
          chain: [
            {
              id: 'retriever_step',
              type: 'retriever',
              name: 'Retriever Step',
              parameters: {
                // Missing index and vectorstore
                search_type: 'similarity'
              }
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(workflow);
      
      expect(result.isValid).toBe(true); // Should be valid but with warnings
      expect(result.warnings.some(w => w.code === 'MISSING_RETRIEVER_CONFIG')).toBe(true);
    });

    it('should handle missing chain in definition', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Missing Chain Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Missing Chain Test'
          // Missing chain property
        }
      };

      const result = await adapter.validateWorkflow(workflow);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_CHAIN')).toBe(true);
    });

    it('should handle invalid dependency references', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Invalid Dependency Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Invalid Dependency Test',
          chain: [
            {
              id: 'step1',
              type: 'llm',
              name: 'Step 1',
              parameters: { model: 'gpt-3.5-turbo' },
              dependencies: ['nonexistent_step']
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(workflow);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_DEPENDENCY')).toBe(true);
    });
  });
});