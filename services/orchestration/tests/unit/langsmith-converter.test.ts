import { LangSmithConverter } from '../../src/utils/langsmith-converter';
import {
  WorkflowDefinition,
  EngineType
} from '@robust-ai-orchestrator/shared';

describe('LangSmithConverter', () => {
  let converter: LangSmithConverter;

  beforeEach(() => {
    converter = new LangSmithConverter();
  });

  describe('convertToLangSmith', () => {
    it('should convert Langflow workflow to LangSmith format', async () => {
      const langflowWorkflow: WorkflowDefinition = {
        name: 'Langflow to LangSmith Test',
        description: 'Test conversion from Langflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          name: 'Langflow to LangSmith Test',
          data: {
            nodes: [
              {
                id: 'prompt_node',
                type: 'genericNode',
                position: { x: 100, y: 100 },
                data: {
                  type: 'PromptTemplate',
                  node: {
                    template: {
                      template: { value: 'Hello {name}' },
                      input_variables: { value: ['name'] }
                    },
                    name: 'prompt_template',
                    display_name: 'Prompt Template'
                  }
                }
              },
              {
                id: 'llm_node',
                type: 'genericNode',
                position: { x: 300, y: 100 },
                data: {
                  type: 'ChatOpenAI',
                  node: {
                    template: {
                      model: { value: 'gpt-3.5-turbo' },
                      temperature: { value: 0.7 },
                      max_tokens: { value: 100 }
                    },
                    name: 'chat_openai',
                    display_name: 'Chat OpenAI'
                  }
                }
              }
            ],
            edges: [
              {
                id: 'edge1',
                source: 'prompt_node',
                target: 'llm_node',
                sourceHandle: 'output',
                targetHandle: 'input'
              }
            ]
          }
        }
      };

      const result = await converter.convertToLangSmith(langflowWorkflow, EngineType.LANGFLOW);

      expect(result.engineType).toBe(EngineType.LANGSMITH);
      expect(result.definition.chain).toBeDefined();
      expect(result.definition.chain).toHaveLength(2);
      
      const promptStep = result.definition.chain.find((step: any) => step.type === 'prompt');
      expect(promptStep).toBeDefined();
      expect(promptStep.parameters.template).toBe('Hello {name}');
      
      const llmStep = result.definition.chain.find((step: any) => step.type === 'llm');
      expect(llmStep).toBeDefined();
      expect(llmStep.parameters.model).toBe('gpt-3.5-turbo');
      expect(llmStep.dependencies).toContain('prompt_node');
    });

    it('should convert N8N workflow to LangSmith format', async () => {
      const n8nWorkflow: WorkflowDefinition = {
        name: 'N8N to LangSmith Test',
        description: 'Test conversion from N8N',
        engineType: EngineType.N8N,
        definition: {
          name: 'N8N to LangSmith Test',
          nodes: [
            {
              id: 'start',
              name: 'Start',
              type: 'n8n-nodes-base.start',
              typeVersion: 1,
              position: [100, 100],
              parameters: {}
            },
            {
              id: 'set_prompt',
              name: 'Set Prompt',
              type: 'n8n-nodes-base.set',
              typeVersion: 1,
              position: [300, 100],
              parameters: {
                values: {
                  string: [
                    {
                      name: 'prompt',
                      value: 'Hello world'
                    }
                  ]
                }
              }
            },
            {
              id: 'openai',
              name: 'OpenAI',
              type: 'n8n-nodes-base.openAi',
              typeVersion: 1,
              position: [500, 100],
              parameters: {
                model: 'gpt-3.5-turbo',
                temperature: 0.8,
                maxTokens: 150
              }
            }
          ],
          connections: {
            'Start': {
              main: [[{ node: 'Set Prompt', type: 'main', index: 0 }]]
            },
            'Set Prompt': {
              main: [[{ node: 'OpenAI', type: 'main', index: 0 }]]
            }
          }
        }
      };

      const result = await converter.convertToLangSmith(n8nWorkflow, EngineType.N8N);

      expect(result.engineType).toBe(EngineType.LANGSMITH);
      expect(result.definition.chain).toBeDefined();
      expect(result.definition.chain).toHaveLength(2); // Excluding start node
      
      const promptStep = result.definition.chain.find((step: any) => step.name === 'Set Prompt');
      expect(promptStep).toBeDefined();
      expect(promptStep.type).toBe('prompt');
      
      const llmStep = result.definition.chain.find((step: any) => step.name === 'OpenAI');
      expect(llmStep).toBeDefined();
      expect(llmStep.type).toBe('llm');
      expect(llmStep.parameters.model).toBe('gpt-3.5-turbo');
    });

    it('should return workflow unchanged if already LangSmith format', async () => {
      const langsmithWorkflow: WorkflowDefinition = {
        name: 'Already LangSmith',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Already LangSmith',
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

      const result = await converter.convertToLangSmith(langsmithWorkflow, EngineType.LANGSMITH);

      expect(result).toEqual(langsmithWorkflow);
    });

    it('should throw error for unsupported source engine', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Unsupported Engine',
        engineType: 'unsupported' as EngineType,
        definition: {}
      };

      await expect(converter.convertToLangSmith(workflow, 'unsupported' as EngineType))
        .rejects.toThrow('Conversion from unsupported to LangSmith is not supported');
    });
  });

  describe('convertFromLangSmith', () => {
    it('should convert LangSmith workflow to Langflow format', async () => {
      const langsmithWorkflow: WorkflowDefinition = {
        name: 'LangSmith to Langflow Test',
        description: 'Test conversion to Langflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'LangSmith to Langflow Test',
          chain: [
            {
              id: 'prompt_step',
              type: 'prompt',
              name: 'Create Prompt',
              parameters: {
                template: 'Hello {name}',
                input_variables: ['name']
              }
            },
            {
              id: 'llm_step',
              type: 'llm',
              name: 'Generate Response',
              parameters: {
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                max_tokens: 100
              },
              dependencies: ['prompt_step']
            }
          ]
        }
      };

      const result = await converter.convertFromLangSmith(langsmithWorkflow, EngineType.LANGFLOW);

      expect(result.engineType).toBe(EngineType.LANGFLOW);
      expect(result.definition.data.nodes).toBeDefined();
      expect(result.definition.data.nodes).toHaveLength(2);
      expect(result.definition.data.edges).toBeDefined();
      expect(result.definition.data.edges).toHaveLength(1);
      
      const promptNode = result.definition.data.nodes.find((node: any) => node.id === 'prompt_step');
      expect(promptNode).toBeDefined();
      expect(promptNode.data.type).toBe('PromptTemplate');
      
      const llmNode = result.definition.data.nodes.find((node: any) => node.id === 'llm_step');
      expect(llmNode).toBeDefined();
      expect(llmNode.data.type).toBe('ChatOpenAI');
      
      const edge = result.definition.data.edges[0];
      expect(edge.source).toBe('prompt_step');
      expect(edge.target).toBe('llm_step');
    });

    it('should convert LangSmith workflow to N8N format', async () => {
      const langsmithWorkflow: WorkflowDefinition = {
        name: 'LangSmith to N8N Test',
        description: 'Test conversion to N8N',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'LangSmith to N8N Test',
          chain: [
            {
              id: 'prompt_step',
              type: 'prompt',
              name: 'Create Prompt',
              parameters: {
                template: 'Hello world'
              }
            },
            {
              id: 'llm_step',
              type: 'llm',
              name: 'Generate Response',
              parameters: {
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                max_tokens: 100
              },
              dependencies: ['prompt_step']
            }
          ]
        }
      };

      const result = await converter.convertFromLangSmith(langsmithWorkflow, EngineType.N8N);

      expect(result.engineType).toBe(EngineType.N8N);
      expect(result.definition.nodes).toBeDefined();
      expect(result.definition.nodes).toHaveLength(3); // Including start node
      expect(result.definition.connections).toBeDefined();
      
      const startNode = result.definition.nodes.find((node: any) => node.type === 'n8n-nodes-base.start');
      expect(startNode).toBeDefined();
      
      const promptNode = result.definition.nodes.find((node: any) => node.name === 'Create Prompt');
      expect(promptNode).toBeDefined();
      expect(promptNode.type).toBe('n8n-nodes-base.set');
      
      const llmNode = result.definition.nodes.find((node: any) => node.name === 'Generate Response');
      expect(llmNode).toBeDefined();
      expect(llmNode.type).toBe('n8n-nodes-base.openAi');
      expect(llmNode.parameters.model).toBe('gpt-3.5-turbo');
    });

    it('should return workflow unchanged if already target format', async () => {
      const langsmithWorkflow: WorkflowDefinition = {
        name: 'Already LangSmith',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Already LangSmith',
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

      const result = await converter.convertFromLangSmith(langsmithWorkflow, EngineType.LANGSMITH);

      expect(result).toEqual(langsmithWorkflow);
    });

    it('should throw error for unsupported target engine', async () => {
      const workflow: WorkflowDefinition = {
        name: 'LangSmith Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          chain: []
        }
      };

      await expect(converter.convertFromLangSmith(workflow, 'unsupported' as EngineType))
        .rejects.toThrow('Conversion from LangSmith to unsupported is not supported');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Langflow workflow structure', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        name: 'Invalid Langflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          // Missing data property
          name: 'Invalid Langflow'
        }
      };

      await expect(converter.convertToLangSmith(invalidWorkflow, EngineType.LANGFLOW))
        .rejects.toThrow('Invalid Langflow workflow structure');
    });

    it('should handle invalid N8N workflow structure', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        name: 'Invalid N8N',
        engineType: EngineType.N8N,
        definition: {
          // Missing nodes property
          name: 'Invalid N8N'
        }
      };

      await expect(converter.convertToLangSmith(invalidWorkflow, EngineType.N8N))
        .rejects.toThrow('Invalid N8N workflow structure');
    });

    it('should handle invalid LangSmith workflow structure for Langflow conversion', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        name: 'Invalid LangSmith',
        engineType: EngineType.LANGSMITH,
        definition: {
          // Missing chain property
          name: 'Invalid LangSmith'
        }
      };

      await expect(converter.convertFromLangSmith(invalidWorkflow, EngineType.LANGFLOW))
        .rejects.toThrow('Invalid LangSmith workflow structure');
    });

    it('should handle invalid LangSmith workflow structure for N8N conversion', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        name: 'Invalid LangSmith',
        engineType: EngineType.LANGSMITH,
        definition: {
          // Missing chain property
          name: 'Invalid LangSmith'
        }
      };

      await expect(converter.convertFromLangSmith(invalidWorkflow, EngineType.N8N))
        .rejects.toThrow('Invalid LangSmith workflow structure');
    });
  });

  describe('Type Mapping', () => {
    it('should map LangSmith step types to Langflow node types correctly', async () => {
      const langsmithWorkflow: WorkflowDefinition = {
        name: 'Type Mapping Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Type Mapping Test',
          chain: [
            { id: 'llm1', type: 'llm', name: 'LLM', parameters: {} },
            { id: 'prompt1', type: 'prompt', name: 'Prompt', parameters: {} },
            { id: 'chain1', type: 'chain', name: 'Chain', parameters: {} },
            { id: 'retriever1', type: 'retriever', name: 'Retriever', parameters: {} },
            { id: 'memory1', type: 'memory', name: 'Memory', parameters: {} },
            { id: 'parser1', type: 'parser', name: 'Parser', parameters: {} },
            { id: 'tool1', type: 'tool', name: 'Tool', parameters: {} },
            { id: 'custom1', type: 'custom', name: 'Custom', parameters: {} }
          ]
        }
      };

      const result = await converter.convertFromLangSmith(langsmithWorkflow, EngineType.LANGFLOW);

      const nodeTypes = result.definition.data.nodes.map((node: any) => node.data.type);
      expect(nodeTypes).toContain('ChatOpenAI');
      expect(nodeTypes).toContain('PromptTemplate');
      expect(nodeTypes).toContain('LLMChain');
      expect(nodeTypes).toContain('VectorStoreRetriever');
      expect(nodeTypes).toContain('ConversationBufferMemory');
      expect(nodeTypes).toContain('OutputParser');
      expect(nodeTypes).toContain('Tool');
      expect(nodeTypes).toContain('CustomComponent');
    });

    it('should map LangSmith step types to N8N node types correctly', async () => {
      const langsmithWorkflow: WorkflowDefinition = {
        name: 'Type Mapping Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Type Mapping Test',
          chain: [
            { id: 'llm1', type: 'llm', name: 'LLM', parameters: {} },
            { id: 'prompt1', type: 'prompt', name: 'Prompt', parameters: {} },
            { id: 'chain1', type: 'chain', name: 'Chain', parameters: {} },
            { id: 'retriever1', type: 'retriever', name: 'Retriever', parameters: {} },
            { id: 'memory1', type: 'memory', name: 'Memory', parameters: {} },
            { id: 'parser1', type: 'parser', name: 'Parser', parameters: {} },
            { id: 'tool1', type: 'tool', name: 'Tool', parameters: {} },
            { id: 'custom1', type: 'custom', name: 'Custom', parameters: {} }
          ]
        }
      };

      const result = await converter.convertFromLangSmith(langsmithWorkflow, EngineType.N8N);

      const nodeTypes = result.definition.nodes
        .filter((node: any) => node.type !== 'n8n-nodes-base.start')
        .map((node: any) => node.type);
      
      expect(nodeTypes).toContain('n8n-nodes-base.openAi');
      expect(nodeTypes).toContain('n8n-nodes-base.set');
      expect(nodeTypes).toContain('n8n-nodes-base.httpRequest');
      expect(nodeTypes).toContain('n8n-nodes-base.pinecone');
      expect(nodeTypes).toContain('n8n-nodes-base.code');
      expect(nodeTypes).toContain('n8n-nodes-base.function');
    });
  });
});