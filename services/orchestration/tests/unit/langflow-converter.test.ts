import { describe, it, expect, beforeEach } from 'vitest';
import { LangflowConverter } from '../../src/utils/langflow-converter';

// Local type definitions for testing
enum EngineType {
  LANGFLOW = 'langflow',
  N8N = 'n8n',
  LANGSMITH = 'langsmith'
}

describe('LangflowConverter', () => {
  let converter: LangflowConverter;

  beforeEach(() => {
    converter = new LangflowConverter();
  });

  describe('importWorkflow', () => {
    it('should import a valid Langflow workflow', async () => {
      const langflowData = {
        name: 'Test Workflow',
        description: 'A test workflow',
        data: {
          nodes: [
            {
              id: 'node-1',
              type: 'ChatInput',
              position: { x: 100, y: 100 },
              data: {
                type: 'ChatInput',
                node: {
                  template: {},
                  description: 'Chat input',
                  base_classes: ['Message'],
                  name: 'ChatInput',
                  display_name: 'Chat Input'
                }
              }
            }
          ],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        },
        tweaks: { param1: 'value1' }
      };

      const result = await converter.importWorkflow(langflowData);

      expect(result).toMatchObject({
        name: 'Test Workflow',
        description: 'A test workflow',
        engineType: EngineType.LANGFLOW,
        definition: expect.objectContaining({
          name: 'Test Workflow',
          data: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: 'node-1',
                type: 'ChatInput'
              })
            ])
          }),
          tweaks: { param1: 'value1' }
        }),
        metadata: expect.objectContaining({
          importedAt: expect.any(String),
          originalFormat: 'langflow',
          nodeCount: 1,
          edgeCount: 0
        })
      });
    });

    it('should generate missing IDs when requested', async () => {
      const langflowData = {
        name: 'Test Workflow',
        data: {
          nodes: [
            {
              // Missing ID
              type: 'ChatInput',
              position: { x: 100, y: 100 },
              data: {
                type: 'ChatInput',
                node: {
                  template: {},
                  description: 'Chat input',
                  base_classes: ['Message'],
                  name: 'ChatInput',
                  display_name: 'Chat Input'
                }
              }
            }
          ],
          edges: []
        }
      };

      const result = await converter.importWorkflow(langflowData, {
        generateMissingIds: true
      });

      expect(result.definition.data.nodes[0].id).toBeDefined();
      expect(result.definition.data.nodes[0].id).toMatch(/^lf_\d+_[a-z0-9]+$/);
    });

    it('should apply default tweaks', async () => {
      const langflowData = {
        name: 'Test Workflow',
        data: {
          nodes: [],
          edges: []
        },
        tweaks: { existing: 'value' }
      };

      const defaultTweaks = { default1: 'defaultValue', existing: 'overridden' };

      const result = await converter.importWorkflow(langflowData, {
        defaultTweaks
      });

      expect(result.definition.tweaks).toEqual({
        default1: 'defaultValue',
        existing: 'value' // Original value should be preserved
      });
    });

    it('should handle missing optional fields', async () => {
      const minimalLangflowData = {
        name: 'Minimal Workflow',
        data: {
          nodes: [],
          edges: []
        }
      };

      const result = await converter.importWorkflow(minimalLangflowData);

      expect(result).toMatchObject({
        name: 'Minimal Workflow',
        description: 'Workflow imported from Langflow',
        engineType: EngineType.LANGFLOW,
        definition: expect.objectContaining({
          description: '',
          tweaks: {}
        })
      });
    });

    it('should handle missing fields gracefully with normalization', async () => {
      const invalidData = {
        // Missing name and data - will be normalized
        description: 'Invalid workflow'
      };

      const result = await converter.importWorkflow(invalidData, { validateStructure: false });
      
      expect(result.name).toBe('Untitled Workflow');
      expect(result.description).toBe('Invalid workflow');
      expect(result.definition.data.nodes).toEqual([]);
      expect(result.definition.data.edges).toEqual([]);
    });

    it('should detect custom components', async () => {
      const langflowData = {
        name: 'Custom Workflow',
        data: {
          nodes: [
            {
              id: 'node-1',
              type: 'custom_component',
              position: { x: 100, y: 100 },
              data: {
                type: 'custom_component',
                node: {
                  template: {},
                  description: 'Custom component',
                  base_classes: ['Custom'],
                  name: 'CustomComponent',
                  display_name: 'Custom Component',
                  custom_fields: { field1: 'value1' }
                }
              }
            }
          ],
          edges: []
        }
      };

      const result = await converter.importWorkflow(langflowData);

      expect(result.metadata?.hasCustomComponents).toBe(true);
    });
  });

  describe('exportWorkflow', () => {
    it('should export a workflow to Langflow format', async () => {
      const workflow = {
        name: 'Test Export',
        description: 'Export test workflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          name: 'Test Export',
          description: 'Export test workflow',
          data: {
            nodes: [
              {
                id: 'node-1',
                type: 'ChatInput',
                position: { x: 100, y: 100 },
                data: {
                  type: 'ChatInput',
                  node: {
                    template: {},
                    description: 'Chat input',
                    base_classes: ['Message'],
                    name: 'ChatInput',
                    display_name: 'Chat Input'
                  }
                }
              }
            ],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 }
          },
          tweaks: { param1: 'value1' }
        },
        metadata: {
          nodeCount: 1,
          edgeCount: 0
        }
      };

      const result = await converter.exportWorkflow(workflow);

      expect(result).toMatchObject({
        name: 'Test Export',
        description: 'Export test workflow',
        data: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: 'node-1',
              type: 'ChatInput'
            })
          ]),
          edges: []
        }),
        tweaks: { param1: 'value1' }
      });
    });

    it('should include metadata when requested', async () => {
      const workflow = {
        name: 'Test Export',
        engineType: EngineType.LANGFLOW,
        definition: {
          name: 'Test Export',
          data: { nodes: [], edges: [] },
          tweaks: {}
        },
        metadata: { custom: 'data' }
      };

      const result = await converter.exportWorkflow(workflow, {
        includeMetadata: true
      });

      expect(result._metadata).toBeDefined();
      expect(result._metadata.exportedAt).toBeDefined();
      expect(result._metadata.exportedBy).toBe('RobustAI-Orchestrator');
      expect(result._metadata.originalMetadata).toEqual({ custom: 'data' });
    });

    it('should remove private fields when not requested', async () => {
      const workflow = {
        name: 'Test Export',
        engineType: EngineType.LANGFLOW,
        definition: {
          name: 'Test Export',
          data: {
            nodes: [
              {
                id: 'node-1',
                type: 'ChatInput',
                position: { x: 100, y: 100 },
                data: {
                  type: 'ChatInput',
                  node: {
                    template: {
                      password: 'secret123',
                      api_token: 'token123',
                      normal_field: 'value'
                    },
                    description: 'Chat input',
                    base_classes: ['Message'],
                    name: 'ChatInput',
                    display_name: 'Chat Input'
                  }
                }
              }
            ],
            edges: []
          },
          tweaks: {}
        }
      };

      const result = await converter.exportWorkflow(workflow, {
        includePrivateFields: false
      });

      const nodeTemplate = result.data.nodes[0].data.node.template;
      expect(nodeTemplate.password).toBeUndefined();
      expect(nodeTemplate.api_token).toBeUndefined();
      expect(nodeTemplate.normal_field).toBe('value');
    });

    it('should throw error for non-Langflow workflows', async () => {
      const n8nWorkflow = {
        name: 'N8N Workflow',
        engineType: EngineType.N8N,
        definition: {}
      };

      await expect(
        converter.exportWorkflow(n8nWorkflow)
      ).rejects.toThrow('Cannot export n8n workflow as Langflow format');
    });

    it('should return minified JSON when requested', async () => {
      const workflow = {
        name: 'Test Export',
        engineType: EngineType.LANGFLOW,
        definition: {
          name: 'Test Export',
          data: { nodes: [], edges: [] },
          tweaks: {}
        }
      };

      const result = await converter.exportWorkflow(workflow, {
        minify: true
      });

      expect(typeof result).toBe('string');
      expect(result).not.toContain('\n');
      expect(result).not.toContain('  ');
    });
  });

  describe('validateLangflowStructure', () => {
    it('should validate correct Langflow structure', () => {
      const validData = {
        name: 'Valid Workflow',
        data: {
          nodes: [
            {
              id: 'node-1',
              type: 'ChatInput',
              data: {
                type: 'ChatInput',
                node: {
                  template: {},
                  description: 'Chat input',
                  base_classes: ['Message'],
                  name: 'ChatInput',
                  display_name: 'Chat Input'
                }
              }
            }
          ],
          edges: []
        }
      };

      const result = converter.validateLangflowStructure(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidData = {
        // Missing name
        data: {
          nodes: [],
          edges: []
        }
      };

      const result = converter.validateLangflowStructure(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
    });

    it('should detect invalid node structure', () => {
      const invalidData = {
        name: 'Test Workflow',
        data: {
          nodes: [
            {
              // Missing id
              type: 'ChatInput'
              // Missing data
            }
          ],
          edges: []
        }
      };

      const result = converter.validateLangflowStructure(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_NODE_ID')).toBe(true);
    });

    it('should detect invalid edge structure', () => {
      const invalidData = {
        name: 'Test Workflow',
        data: {
          nodes: [],
          edges: [
            {
              id: 'edge-1'
              // Missing source and target
            }
          ]
        }
      };

      const result = converter.validateLangflowStructure(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_EDGE_SOURCE')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_EDGE_TARGET')).toBe(true);
    });

    it('should warn about empty workflows', () => {
      const emptyData = {
        name: 'Empty Workflow',
        data: {
          nodes: [],
          edges: []
        }
      };

      const result = converter.validateLangflowStructure(emptyData);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'EMPTY_WORKFLOW')).toBe(true);
    });

    it('should warn about disconnected nodes', () => {
      const disconnectedData = {
        name: 'Disconnected Workflow',
        data: {
          nodes: [
            { id: 'node-1', type: 'ChatInput', data: { type: 'ChatInput' } },
            { id: 'node-2', type: 'ChatOutput', data: { type: 'ChatOutput' } }
          ],
          edges: [] // No edges connecting the nodes
        }
      };

      const result = converter.validateLangflowStructure(disconnectedData);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'DISCONNECTED_NODES')).toBe(true);
    });
  });

  describe('validateConnectivity', () => {
    it('should validate connected workflow', () => {
      const connectedWorkflow = {
        name: 'Connected Workflow',
        data: {
          nodes: [
            { id: 'node-1', type: 'ChatInput', position: { x: 0, y: 0 }, data: { type: 'ChatInput', node: {} } },
            { id: 'node-2', type: 'ChatOutput', position: { x: 0, y: 0 }, data: { type: 'ChatOutput', node: {} } }
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'node-1',
              target: 'node-2',
              sourceHandle: 'output',
              targetHandle: 'input'
            }
          ]
        },
        tweaks: {}
      };

      const result = converter.validateConnectivity(connectedWorkflow);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid edge references', () => {
      const invalidWorkflow = {
        name: 'Invalid Workflow',
        data: {
          nodes: [
            { id: 'node-1', type: 'ChatInput', position: { x: 0, y: 0 }, data: { type: 'ChatInput', node: {} } }
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'node-1',
              target: 'non-existent-node', // Invalid target
              sourceHandle: 'output',
              targetHandle: 'input'
            }
          ]
        },
        tweaks: {}
      };

      const result = converter.validateConnectivity(invalidWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_EDGE_TARGET')).toBe(true);
    });

    it('should warn about isolated nodes', () => {
      const isolatedWorkflow = {
        name: 'Isolated Workflow',
        data: {
          nodes: [
            { id: 'node-1', type: 'ChatInput', position: { x: 0, y: 0 }, data: { type: 'ChatInput', node: {} } },
            { id: 'node-2', type: 'ChatOutput', position: { x: 0, y: 0 }, data: { type: 'ChatOutput', node: {} } },
            { id: 'node-3', type: 'Isolated', position: { x: 0, y: 0 }, data: { type: 'Isolated', node: {} } }
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'node-1',
              target: 'node-2',
              sourceHandle: 'output',
              targetHandle: 'input'
            }
          ]
        },
        tweaks: {}
      };

      const result = converter.validateConnectivity(isolatedWorkflow);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'ISOLATED_NODES')).toBe(true);
      expect(result.warnings.find(w => w.code === 'ISOLATED_NODES')?.message).toContain('node-3');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined input gracefully', async () => {
      await expect(
        converter.importWorkflow(null as any)
      ).rejects.toThrow();

      await expect(
        converter.importWorkflow(undefined as any)
      ).rejects.toThrow();
    });

    it('should handle malformed data gracefully with normalization', async () => {
      const malformedData = {
        name: 'Test',
        data: 'not an object'  // Will be normalized to proper structure
      };

      const result = await converter.importWorkflow(malformedData, { validateStructure: false });
      
      expect(result.name).toBe('Test');
      expect(result.definition.data.nodes).toEqual([]);
      expect(result.definition.data.edges).toEqual([]);
    });

    it('should handle circular references in workflow data', async () => {
      const circularData: any = {
        name: 'Circular Workflow',
        data: {
          nodes: [],
          edges: []
        }
      };
      
      // Create circular reference
      circularData.self = circularData;

      // Should not throw due to circular reference
      const result = await converter.importWorkflow(circularData, {
        validateStructure: false
      });

      expect(result.name).toBe('Circular Workflow');
    });

    it('should handle very large workflows', async () => {
      const largeWorkflow = {
        name: 'Large Workflow',
        data: {
          nodes: Array.from({ length: 1000 }, (_, i) => ({
            id: `node-${i}`,
            type: 'ChatInput',
            position: { x: i * 100, y: i * 100 },
            data: {
              type: 'ChatInput',
              node: {
                template: {},
                description: `Node ${i}`,
                base_classes: ['Message'],
                name: 'ChatInput',
                display_name: `Chat Input ${i}`
              }
            }
          })),
          edges: Array.from({ length: 999 }, (_, i) => ({
            id: `edge-${i}`,
            source: `node-${i}`,
            target: `node-${i + 1}`,
            sourceHandle: 'output',
            targetHandle: 'input'
          }))
        }
      };

      const result = await converter.importWorkflow(largeWorkflow);

      expect(result.metadata?.nodeCount).toBe(1000);
      expect(result.metadata?.edgeCount).toBe(999);
    });
  });
});