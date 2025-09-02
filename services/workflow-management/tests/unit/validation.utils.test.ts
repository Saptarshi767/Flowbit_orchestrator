import { describe, it, expect } from 'vitest'
import {
  validateWorkflowDefinition,
  validateWorkflowName,
  validateWorkflowTags
} from '../../src/utils/validation.utils'
import { EngineType } from '../../src/types/workflow.types'

describe('Validation Utils', () => {
  describe('validateWorkflowName', () => {
    it('should validate correct workflow names', () => {
      const result = validateWorkflowName('My Workflow')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty names', () => {
      const result = validateWorkflowName('')
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('EMPTY_NAME')
    })

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(101)
      const result = validateWorkflowName(longName)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('NAME_TOO_LONG')
    })

    it('should reject names with invalid characters', () => {
      const result = validateWorkflowName('My Workflow @#$')
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('INVALID_NAME_CHARACTERS')
    })
  })

  describe('validateWorkflowTags', () => {
    it('should validate correct tags', () => {
      const result = validateWorkflowTags(['tag1', 'tag-2', 'tag_3'])
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should warn about too many tags', () => {
      const manyTags = Array.from({ length: 11 }, (_, i) => `tag${i}`)
      const result = validateWorkflowTags(manyTags)
      expect(result.isValid).toBe(true)
      expect(result.warnings[0].code).toBe('TOO_MANY_TAGS')
    })

    it('should reject tags that are too long', () => {
      const longTag = 'a'.repeat(51)
      const result = validateWorkflowTags([longTag])
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('TAG_TOO_LONG')
    })

    it('should reject tags with invalid characters', () => {
      const result = validateWorkflowTags(['tag@invalid'])
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('INVALID_TAG_CHARACTERS')
    })
  })

  describe('validateWorkflowDefinition', () => {
    describe('Langflow validation', () => {
      it('should validate correct Langflow definition', () => {
        const definition = {
          nodes: [
            {
              id: 'node1',
              type: 'input',
              position: { x: 0, y: 0 },
              data: { value: 'test' }
            }
          ],
          edges: []
        }

        const result = validateWorkflowDefinition(definition, EngineType.LANGFLOW)
        expect(result.isValid).toBe(true)
      })

      it('should reject Langflow definition without required fields', () => {
        const definition = {
          nodes: [
            {
              id: 'node1',
              // missing type, position, data
            }
          ]
        }

        const result = validateWorkflowDefinition(definition, EngineType.LANGFLOW)
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })

      it('should detect circular dependencies', () => {
        const definition = {
          nodes: [
            { id: 'node1', type: 'input', position: { x: 0, y: 0 }, data: {} },
            { id: 'node2', type: 'output', position: { x: 100, y: 0 }, data: {} }
          ],
          edges: [
            { id: 'edge1', source: 'node1', target: 'node2' },
            { id: 'edge2', source: 'node2', target: 'node1' }
          ]
        }

        const result = validateWorkflowDefinition(definition, EngineType.LANGFLOW)
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.code === 'CIRCULAR_DEPENDENCY')).toBe(true)
      })

      it('should warn about disconnected nodes', () => {
        const definition = {
          nodes: [
            { id: 'node1', type: 'input', position: { x: 0, y: 0 }, data: {} },
            { id: 'node2', type: 'output', position: { x: 100, y: 0 }, data: {} }
          ],
          edges: []
        }

        const result = validateWorkflowDefinition(definition, EngineType.LANGFLOW)
        expect(result.isValid).toBe(true)
        expect(result.warnings.some(w => w.code === 'DISCONNECTED_NODE')).toBe(true)
      })
    })

    describe('N8N validation', () => {
      it('should validate correct N8N definition', () => {
        const definition = {
          nodes: [
            {
              id: 'node1',
              name: 'Start',
              type: 'n8n-nodes-base.start',
              position: [0, 0],
              parameters: {}
            }
          ]
        }

        const result = validateWorkflowDefinition(definition, EngineType.N8N)
        expect(result.isValid).toBe(true)
      })

      it('should warn about missing trigger nodes', () => {
        const definition = {
          nodes: [
            {
              id: 'node1',
              name: 'HTTP Request',
              type: 'n8n-nodes-base.httpRequest',
              position: [0, 0],
              parameters: {}
            }
          ]
        }

        const result = validateWorkflowDefinition(definition, EngineType.N8N)
        expect(result.isValid).toBe(true)
        expect(result.warnings.some(w => w.code === 'NO_TRIGGER_NODE')).toBe(true)
      })
    })

    describe('LangSmith validation', () => {
      it('should validate correct LangSmith definition', () => {
        const definition = {
          nodes: [
            {
              id: 'node1',
              type: 'llm',
              config: { model: 'gpt-3.5-turbo' }
            }
          ]
        }

        const result = validateWorkflowDefinition(definition, EngineType.LANGSMITH)
        expect(result.isValid).toBe(true)
      })

      it('should reject LLM nodes without model configuration', () => {
        const definition = {
          nodes: [
            {
              id: 'node1',
              type: 'llm',
              config: {}
            }
          ]
        }

        const result = validateWorkflowDefinition(definition, EngineType.LANGSMITH)
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.code === 'MISSING_LLM_MODEL')).toBe(true)
      })

      it('should reject chains with invalid node references', () => {
        const definition = {
          nodes: [
            {
              id: 'node1',
              type: 'llm',
              config: { model: 'gpt-3.5-turbo' }
            }
          ],
          chains: [
            {
              id: 'chain1',
              type: 'sequential',
              steps: ['node1', 'nonexistent-node']
            }
          ]
        }

        const result = validateWorkflowDefinition(definition, EngineType.LANGSMITH)
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.code === 'INVALID_CHAIN_REFERENCE')).toBe(true)
      })
    })

    it('should reject unsupported engine types', () => {
      const definition = { nodes: [] }
      const result = validateWorkflowDefinition(definition, 'UNSUPPORTED' as EngineType)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('INVALID_ENGINE_TYPE')
    })
  })
})