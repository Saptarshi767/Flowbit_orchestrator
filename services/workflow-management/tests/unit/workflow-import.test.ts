import { describe, it, expect, vi } from 'vitest'
import { WorkflowImportService } from '../../src/services/workflow-import.service'
import { WorkflowService } from '../../src/services/workflow.service'
import { EngineType } from '../../src/types/workflow.types'

// Mock the WorkflowService
const mockWorkflowService = {
  createWorkflow: vi.fn()
} as any

describe('WorkflowImportService', () => {
  const importService = new WorkflowImportService(mockWorkflowService)

  describe('getSupportedFormats', () => {
    it('should return correct formats for Langflow', () => {
      const formats = importService.getSupportedFormats(EngineType.LANGFLOW)
      expect(formats).toEqual(['json', 'langflow'])
    })

    it('should return correct formats for N8N', () => {
      const formats = importService.getSupportedFormats(EngineType.N8N)
      expect(formats).toEqual(['json', 'n8n'])
    })

    it('should return correct formats for LangSmith', () => {
      const formats = importService.getSupportedFormats(EngineType.LANGSMITH)
      expect(formats).toEqual(['json', 'yaml', 'langsmith'])
    })
  })

  describe('validateImportedWorkflow', () => {
    it('should validate Langflow workflow format', async () => {
      const langflowSource = {
        data: {
          nodes: [
            {
              id: 'node1',
              data: { type: 'TextInput' },
              position: { x: 100, y: 100 }
            }
          ],
          edges: []
        },
        name: 'Test Langflow Workflow'
      }

      const result = await importService.validateImportedWorkflow(
        langflowSource,
        EngineType.LANGFLOW
      )

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate N8N workflow format', async () => {
      const n8nSource = {
        nodes: [
          {
            name: 'Start',
            type: 'n8n-nodes-base.start',
            position: [250, 300],
            parameters: {}
          }
        ],
        connections: {}
      }

      const result = await importService.validateImportedWorkflow(
        n8nSource,
        EngineType.N8N
      )

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate LangSmith workflow format', async () => {
      const langsmithSource = {
        steps: [
          {
            id: 'step1',
            type: 'llm',
            config: { model: 'gpt-3.5-turbo' }
          }
        ]
      }

      const result = await importService.validateImportedWorkflow(
        langsmithSource,
        EngineType.LANGSMITH
      )

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return validation errors for invalid format', async () => {
      const invalidSource = {
        // Missing required fields
      }

      const result = await importService.validateImportedWorkflow(
        invalidSource,
        EngineType.LANGFLOW
      )

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('IMPORT_ERROR')
    })
  })
})