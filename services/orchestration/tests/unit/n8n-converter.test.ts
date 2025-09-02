import { describe, it, expect, beforeEach } from 'vitest';
import { N8NConverter } from '../../src/utils/n8n-converter';
// Local type definitions - normally would import from shared package
enum EngineType {
  LANGFLOW = 'langflow',
  N8N = 'n8n',
  LANGSMITH = 'langsmith'
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

describe('N8NConverter Unit Tests', () => {
  let converter: N8NConverter;

  beforeEach(() => {
    converter = new N8NConverter();
  });

  describe('Langflow to N8N Conversion', () => {
    const mockLangflowWorkflow: WorkflowDefinition = {
      name: 'Test Langflow Workflow',
      engineType: EngineType.LANGFLOW,
      definition: {
        name: 'Test Langflow Workflow',
        data: {
          nodes: [
            {
              id: 'textinput-1',
              type: 'genericNode',
              position: { x: 100, y: 100 },
              data: {
                type: 'TextInput',
                node: {
                  template: {
                    value: { value: 'Hello World' }
                  },
                  description: 'Text input component',
                  base_classes: ['Component'],
                  name: 'TextInput',
                  display_name: 'Text Input'
                }
              }
            },
            {
              id: 'openai-1',
              type: 'genericNode',
              position: { x: 300, y: 100 },
              data: {
                type: 'ChatOpenAI',
                node: {
                  template: {
                    model: { value: 'gpt-3.5-turbo' },
                    temperature: { value: 0.7 },
                    max_tokens: { value: 1000 },
                    api_key: { value: 'sk-...' }
                  },
                  description: 'OpenAI Chat model',
                  base_classes: ['LLM'],
                  name: 'ChatOpenAI',
                  display_name: 'Chat OpenAI'
                }
              }
            }
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'textinput-1',
              target: 'openai-1',
              sourceHandle: 'output',
              targetHandle: 'input'
            }
          ],
          viewport: { x: 0, y: 0, zoom: 1 }
        },
        tweaks: {}
      }
    };

    it('should convert Langflow workflow to N8N format', async () => {
      const result = await converter.convertToN8N(mockLangflowWorkflow, EngineType.LANGFLOW);

      expect(result.engineType).toBe(EngineType.N8N);
      expect(result.definition.name).toBe(mockLangflowWorkflow.name);
      expect(result.definition.nodes).toHaveLength(2);
      expect(result.definition.connections).toBeDefined();

      // Check node conversion
      const textInputNode = result.definition.nodes.find((n: any) => n.name === 'Text Input');
      expect(textInputNode).toBeDefined();
      expect(textInputNode.type).toBe('n8n-nodes-base.set');
      expect(textInputNode.position).toEqual([100, 100]);

      const openaiNode = result.definition.nodes.find((n: any) => n.name === 'Chat OpenAI');
      expect(openaiNode).toBeDefined();
      expect(openaiNode.type).toBe('n8n-nodes-base.openAi');
      expect(openaiNode.parameters.model).toBe('gpt-3.5-turbo');
      expect(openaiNode.parameters.temperature).toBe(0.7);
    });

    it('should handle Langflow workflow with credentials', async () => {
      const workflowWithCredentials = {
        ...mockLangflowWorkflow,
        definition: {
          ...mockLangflowWorkflow.definition,
          data: {
            ...mockLangflowWorkflow.definition.data,
            nodes: [
              {
                ...mockLangflowWorkflow.definition.data.nodes[1],
                data: {
                  ...mockLangflowWorkflow.definition.data.nodes[1].data,
                  node: {
                    ...mockLangflowWorkflow.definition.data.nodes[1].data.node,
                    template: {
                      ...mockLangflowWorkflow.definition.data.nodes[1].data.node.template,
                      credentials: { value: { openAiApi: 'openai_credentials' } }
                    }
                  }
                }
              }
            ]
          }
        }
      };

      const result = await converter.convertToN8N(workflowWithCredentials, EngineType.LANGFLOW);

      const openaiNode = result.definition.nodes.find((n: any) => n.name === 'Chat OpenAI');
      expect(openaiNode.credentials).toBeDefined();
      expect(openaiNode.credentials.openAiApi).toBe('openai_credentials');
    });

    it('should throw error for invalid Langflow structure', async () => {
      const invalidWorkflow = {
        ...mockLangflowWorkflow,
        definition: {
          name: 'Invalid',
          // Missing data property
        }
      };

      await expect(
        converter.convertToN8N(invalidWorkflow, EngineType.LANGFLOW)
      ).rejects.toThrow('Invalid Langflow workflow structure');
    });
  });

  describe('LangSmith to N8N Conversion', () => {
    const mockLangSmithWorkflow: WorkflowDefinition = {
      name: 'Test LangSmith Workflow',
      engineType: EngineType.LANGSMITH,
      definition: {
        name: 'Test LangSmith Workflow',
        chain: [
          {
            type: 'prompt',
            name: 'Initial Prompt',
            parameters: {
              template: 'Hello, {input}!',
              input_variables: ['input']
            }
          },
          {
            type: 'llm',
            name: 'OpenAI LLM',
            parameters: {
              model: 'gpt-3.5-turbo',
              temperature: 0.7,
              max_tokens: 1000
            }
          },
          {
            type: 'parser',
            name: 'Output Parser',
            parameters: {
              format: 'json'
            }
          }
        ]
      }
    };

    it('should convert LangSmith workflow to N8N format', async () => {
      const result = await converter.convertToN8N(mockLangSmithWorkflow, EngineType.LANGSMITH);

      expect(result.engineType).toBe(EngineType.N8N);
      expect(result.definition.name).toBe(mockLangSmithWorkflow.name);
      expect(result.definition.nodes).toHaveLength(4); // Start + 3 chain steps

      // Check start node
      const startNode = result.definition.nodes.find((n: any) => n.name === 'Start');
      expect(startNode).toBeDefined();
      expect(startNode.type).toBe('n8n-nodes-base.start');

      // Check chain step conversion
      const promptNode = result.definition.nodes.find((n: any) => n.name === 'Step_1');
      expect(promptNode).toBeDefined();
      expect(promptNode.type).toBe('n8n-nodes-base.set');

      const llmNode = result.definition.nodes.find((n: any) => n.name === 'Step_2');
      expect(llmNode).toBeDefined();
      expect(llmNode.type).toBe('n8n-nodes-base.openAi');

      // Check connections
      expect(result.definition.connections['Start']).toBeDefined();
      expect(result.definition.connections['Step_1']).toBeDefined();
      expect(result.definition.connections['Step_2']).toBeDefined();
    });

    it('should handle empty LangSmith chain', async () => {
      const emptyChainWorkflow = {
        ...mockLangSmithWorkflow,
        definition: {
          name: 'Empty Chain',
          chain: []
        }
      };

      const result = await converter.convertToN8N(emptyChainWorkflow, EngineType.LANGSMITH);

      expect(result.definition.nodes).toHaveLength(1); // Only start node
      expect(result.definition.nodes[0].name).toBe('Start');
    });
  });

  describe('N8N to Langflow Conversion', () => {
    const mockN8NWorkflow: WorkflowDefinition = {
      name: 'Test N8N Workflow',
      engineType: EngineType.N8N,
      definition: {
        name: 'Test N8N Workflow',
        active: false,
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
            id: 'openai',
            name: 'OpenAI',
            type: 'n8n-nodes-base.openAi',
            typeVersion: 1,
            position: [300, 100],
            parameters: {
              model: 'gpt-4',
              temperature: 0.8,
              maxTokens: 2000
            }
          },
          {
            id: 'set',
            name: 'Set Data',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [500, 100],
            parameters: {
              values: {
                string: [
                  {
                    name: 'result',
                    value: '={{$json.choices[0].message.content}}'
                  }
                ]
              }
            }
          }
        ],
        connections: {
          'Start': {
            main: [
              [
                {
                  node: 'OpenAI',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          },
          'OpenAI': {
            main: [
              [
                {
                  node: 'Set Data',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          }
        },
        settings: {},
        staticData: {},
        tags: [],
        pinData: {}
      }
    };

    it('should convert N8N workflow to Langflow format', async () => {
      const result = await converter.convertFromN8N(mockN8NWorkflow, EngineType.LANGFLOW);

      expect(result.engineType).toBe(EngineType.LANGFLOW);
      expect(result.definition.name).toBe(mockN8NWorkflow.name);
      expect(result.definition.data.nodes).toHaveLength(3);
      expect(result.definition.data.edges).toHaveLength(2);

      // Check node conversion
      const openaiNode = result.definition.data.nodes.find((n: any) => n.id === 'openai');
      expect(openaiNode).toBeDefined();
      expect(openaiNode.data.type).toBe('ChatOpenAI');
      expect(openaiNode.position).toEqual({ x: 300, y: 100 });

      const setNode = result.definition.data.nodes.find((n: any) => n.id === 'set');
      expect(setNode).toBeDefined();
      expect(setNode.data.type).toBe('TextInput');
    });

    it('should convert N8N connections to Langflow edges', async () => {
      const result = await converter.convertFromN8N(mockN8NWorkflow, EngineType.LANGFLOW);

      const edges = result.definition.data.edges;
      expect(edges).toHaveLength(2);

      const firstEdge = edges.find((e: any) => e.source === 'Start');
      expect(firstEdge).toBeDefined();
      expect(firstEdge.target).toBe('OpenAI');

      const secondEdge = edges.find((e: any) => e.source === 'OpenAI');
      expect(secondEdge).toBeDefined();
      expect(secondEdge.target).toBe('Set Data');
    });
  });

  describe('N8N to LangSmith Conversion', () => {
    const mockN8NWorkflow: WorkflowDefinition = {
      name: 'Test N8N Workflow',
      engineType: EngineType.N8N,
      definition: {
        name: 'Test N8N Workflow',
        active: false,
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
            id: 'set',
            name: 'Set Prompt',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [300, 100],
            parameters: {
              values: {
                string: [
                  {
                    name: 'prompt',
                    value: 'Analyze this text: {{$json.input}}'
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
              model: 'gpt-4',
              temperature: 0.5,
              maxTokens: 1500
            }
          }
        ],
        connections: {
          'Start': {
            main: [
              [
                {
                  node: 'Set Prompt',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          },
          'Set Prompt': {
            main: [
              [
                {
                  node: 'OpenAI',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          }
        },
        settings: {},
        staticData: {},
        tags: [],
        pinData: {}
      }
    };

    it('should convert N8N workflow to LangSmith format', async () => {
      const result = await converter.convertFromN8N(mockN8NWorkflow, EngineType.LANGSMITH);

      expect(result.engineType).toBe(EngineType.LANGSMITH);
      expect(result.definition.name).toBe(mockN8NWorkflow.name);
      expect(result.definition.chain).toHaveLength(2); // Excluding start node

      // Check chain steps
      const promptStep = result.definition.chain[0];
      expect(promptStep.type).toBe('prompt');
      expect(promptStep.name).toBe('Set Prompt');

      const llmStep = result.definition.chain[1];
      expect(llmStep.type).toBe('llm');
      expect(llmStep.name).toBe('OpenAI');
      expect(llmStep.parameters.model).toBe('gpt-4');
      expect(llmStep.parameters.temperature).toBe(0.5);
    });

    it('should handle N8N workflow without start node', async () => {
      const workflowWithoutStart = {
        ...mockN8NWorkflow,
        definition: {
          ...mockN8NWorkflow.definition,
          nodes: mockN8NWorkflow.definition.nodes.slice(1), // Remove start node
          connections: {
            'Set Prompt': {
              main: [
                [
                  {
                    node: 'OpenAI',
                    type: 'main',
                    index: 0
                  }
                ]
              ]
            }
          }
        }
      };

      const result = await converter.convertFromN8N(workflowWithoutStart, EngineType.LANGSMITH);

      expect(result.definition.chain).toHaveLength(0); // No chain built without start node
    });
  });

  describe('Node Type Mapping', () => {
    it('should map Langflow node types to N8N correctly', async () => {
      const testCases = [
        { langflow: 'TextInput', n8n: 'n8n-nodes-base.set' },
        { langflow: 'ChatOpenAI', n8n: 'n8n-nodes-base.openAi' },
        { langflow: 'LLMChain', n8n: 'n8n-nodes-base.httpRequest' },
        { langflow: 'VectorStore', n8n: 'n8n-nodes-base.pinecone' },
        { langflow: 'UnknownType', n8n: 'n8n-nodes-base.function' }
      ];

      for (const testCase of testCases) {
        const mockWorkflow: WorkflowDefinition = {
          name: 'Test',
          engineType: EngineType.LANGFLOW,
          definition: {
            name: 'Test',
            data: {
              nodes: [
                {
                  id: 'test-node',
                  type: 'genericNode',
                  position: { x: 100, y: 100 },
                  data: {
                    type: testCase.langflow,
                    node: {
                      template: {},
                      description: 'Test node',
                      base_classes: ['Component'],
                      name: testCase.langflow,
                      display_name: testCase.langflow
                    }
                  }
                }
              ],
              edges: [],
              viewport: { x: 0, y: 0, zoom: 1 }
            }
          }
        };

        const result = await converter.convertToN8N(mockWorkflow, EngineType.LANGFLOW);
        expect(result.definition.nodes[0].type).toBe(testCase.n8n);
      }
    });

    it('should map N8N node types to Langflow correctly', async () => {
      const testCases = [
        { n8n: 'n8n-nodes-base.openAi', langflow: 'ChatOpenAI' },
        { n8n: 'n8n-nodes-base.httpRequest', langflow: 'LLMChain' },
        { n8n: 'n8n-nodes-base.set', langflow: 'TextInput' },
        { n8n: 'n8n-nodes-base.pinecone', langflow: 'VectorStore' },
        { n8n: 'n8n-nodes-base.unknownType', langflow: 'CustomComponent' }
      ];

      for (const testCase of testCases) {
        const mockWorkflow: WorkflowDefinition = {
          name: 'Test',
          engineType: EngineType.N8N,
          definition: {
            name: 'Test',
            nodes: [
              {
                id: 'test-node',
                name: 'Test Node',
                type: testCase.n8n,
                typeVersion: 1,
                position: [100, 100],
                parameters: {}
              }
            ],
            connections: {},
            settings: {},
            staticData: {},
            tags: [],
            pinData: {}
          }
        };

        const result = await converter.convertFromN8N(mockWorkflow, EngineType.LANGFLOW);
        expect(result.definition.data.nodes[0].data.type).toBe(testCase.langflow);
      }
    });
  });

  describe('Parameter Conversion', () => {
    it('should convert Langflow parameters to N8N parameters for OpenAI node', async () => {
      const mockWorkflow: WorkflowDefinition = {
        name: 'Test',
        engineType: EngineType.LANGFLOW,
        definition: {
          name: 'Test',
          data: {
            nodes: [
              {
                id: 'openai-node',
                type: 'genericNode',
                position: { x: 100, y: 100 },
                data: {
                  type: 'ChatOpenAI',
                  node: {
                    template: {
                      model: { value: 'gpt-4' },
                      temperature: { value: 0.9 },
                      max_tokens: { value: 2000 }
                    },
                    description: 'OpenAI node',
                    base_classes: ['LLM'],
                    name: 'ChatOpenAI',
                    display_name: 'Chat OpenAI'
                  }
                }
              }
            ],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 }
          }
        }
      };

      const result = await converter.convertToN8N(mockWorkflow, EngineType.LANGFLOW);
      const node = result.definition.nodes[0];

      expect(node.parameters.model).toBe('gpt-4');
      expect(node.parameters.temperature).toBe(0.9);
      expect(node.parameters.maxTokens).toBe(2000);
    });

    it('should convert N8N parameters to Langflow parameters for OpenAI node', async () => {
      const mockWorkflow: WorkflowDefinition = {
        name: 'Test',
        engineType: EngineType.N8N,
        definition: {
          name: 'Test',
          nodes: [
            {
              id: 'openai-node',
              name: 'OpenAI',
              type: 'n8n-nodes-base.openAi',
              typeVersion: 1,
              position: [100, 100],
              parameters: {
                model: 'gpt-4',
                temperature: 0.9,
                maxTokens: 2000
              }
            }
          ],
          connections: {},
          settings: {},
          staticData: {},
          tags: [],
          pinData: {}
        }
      };

      const result = await converter.convertFromN8N(mockWorkflow, EngineType.LANGFLOW);
      const node = result.definition.data.nodes[0];

      expect(node.data.node.template.model.value).toBe('gpt-4');
      expect(node.data.node.template.temperature.value).toBe(0.9);
      expect(node.data.node.template.max_tokens.value).toBe(2000);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported source engine', async () => {
      const mockWorkflow: WorkflowDefinition = {
        name: 'Test',
        engineType: EngineType.N8N,
        definition: {}
      };

      await expect(
        converter.convertToN8N(mockWorkflow, 'unsupported' as EngineType)
      ).rejects.toThrow('Conversion from unsupported to N8N is not supported');
    });

    it('should throw error for unsupported target engine', async () => {
      const mockWorkflow: WorkflowDefinition = {
        name: 'Test',
        engineType: EngineType.N8N,
        definition: {}
      };

      await expect(
        converter.convertFromN8N(mockWorkflow, 'unsupported' as EngineType)
      ).rejects.toThrow('Conversion from N8N to unsupported is not supported');
    });

    it('should return same workflow for N8N to N8N conversion', async () => {
      const mockWorkflow: WorkflowDefinition = {
        name: 'Test',
        engineType: EngineType.N8N,
        definition: {
          name: 'Test',
          nodes: [],
          connections: {}
        }
      };

      const result = await converter.convertToN8N(mockWorkflow, EngineType.N8N);
      expect(result).toEqual(mockWorkflow);

      const result2 = await converter.convertFromN8N(mockWorkflow, EngineType.N8N);
      expect(result2).toEqual(mockWorkflow);
    });
  });
});