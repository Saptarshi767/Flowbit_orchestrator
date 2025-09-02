import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WorkflowService } from '../../src/services/workflow.service'
import { EngineType, WorkflowVisibility } from '../../src/types/workflow.types'
import type {
  IWorkflowRepository,
  IWorkflowVersionRepository,
  IWorkflowCollaboratorRepository
} from '../../src/repositories/interfaces/workflow.repository.interface'

// Mock repositories
const mockWorkflowRepository: IWorkflowRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByIdWithVersions: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  search: vi.fn(),
  findByOrganization: vi.fn(),
  findByUser: vi.fn(),
  findByTags: vi.fn(),
  getStats: vi.fn(),
  getWorkflowCount: vi.fn(),
  hasAccess: vi.fn(),
  isOwner: vi.fn()
}

const mockWorkflowVersionRepository: IWorkflowVersionRepository = {
  create: vi.fn(),
  findByWorkflowId: vi.fn(),
  findByVersion: vi.fn(),
  getLatestVersion: vi.fn(),
  getNextVersionNumber: vi.fn(),
  compareVersions: vi.fn(),
  getVersionHistory: vi.fn()
}

const mockWorkflowCollaboratorRepository: IWorkflowCollaboratorRepository = {
  addCollaborator: vi.fn(),
  removeCollaborator: vi.fn(),
  updateCollaboratorRole: vi.fn(),
  findByWorkflowId: vi.fn(),
  findByUserId: vi.fn(),
  getCollaboratorRole: vi.fn(),
  canRead: vi.fn(),
  canWrite: vi.fn(),
  canDelete: vi.fn()
}

describe('WorkflowService', () => {
  let service: WorkflowService
  const userId = 'user-123'
  const organizationId = 'org-123'
  const workflowId = 'workflow-123'

  beforeEach(() => {
    service = new WorkflowService(
      mockWorkflowRepository,
      mockWorkflowVersionRepository,
      mockWorkflowCollaboratorRepository
    )

    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('createWorkflow', () => {
    const validRequest = {
      name: 'Test Workflow',
      description: 'A test workflow',
      engineType: EngineType.LANGFLOW,
      definition: {
        nodes: [
          {
            id: 'node1',
            type: 'input',
            position: { x: 0, y: 0 },
            data: { value: 'test' }
          }
        ],
        edges: []
      },
      visibility: WorkflowVisibility.PRIVATE,
      tags: ['test']
    }

    it('should create workflow successfully with valid input', async () => {
      const expectedWorkflow = {
        id: workflowId,
        ...validRequest,
        version: 1,
        createdBy: userId,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(mockWorkflowRepository.create).mockResolvedValue(expectedWorkflow)

      const result = await service.createWorkflow(validRequest, userId, organizationId)

      expect(mockWorkflowRepository.create).toHaveBeenCalledWith(
        validRequest,
        userId,
        organizationId
      )
      expect(result).toEqual(expectedWorkflow)
    })

    it('should reject workflow with invalid name', async () => {
      const invalidRequest = {
        ...validRequest,
        name: '' // Empty name
      }

      await expect(
        service.createWorkflow(invalidRequest, userId, organizationId)
      ).rejects.toThrow('Invalid workflow name')

      expect(mockWorkflowRepository.create).not.toHaveBeenCalled()
    })

    it('should reject workflow with invalid tags', async () => {
      const invalidRequest = {
        ...validRequest,
        tags: ['invalid@tag']
      }

      await expect(
        service.createWorkflow(invalidRequest, userId, organizationId)
      ).rejects.toThrow('Invalid workflow tags')

      expect(mockWorkflowRepository.create).not.toHaveBeenCalled()
    })

    it('should reject workflow with invalid definition', async () => {
      const invalidRequest = {
        ...validRequest,
        definition: {
          nodes: [
            {
              id: 'node1'
              // Missing required fields
            }
          ]
        }
      }

      await expect(
        service.createWorkflow(invalidRequest, userId, organizationId)
      ).rejects.toThrow('Invalid workflow definition')

      expect(mockWorkflowRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('getWorkflow', () => {
    it('should return workflow when user has access', async () => {
      const workflow = {
        id: workflowId,
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] },
        version: 1,
        visibility: WorkflowVisibility.PRIVATE,
        tags: [],
        createdBy: userId,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(mockWorkflowRepository.findById).mockResolvedValue(workflow)
      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(true)

      const result = await service.getWorkflow(workflowId, userId)

      expect(mockWorkflowRepository.findById).toHaveBeenCalledWith(workflowId)
      expect(mockWorkflowRepository.hasAccess).toHaveBeenCalledWith(workflowId, userId, 'read')
      expect(result).toEqual(workflow)
    })

    it('should return null for non-existent workflow', async () => {
      vi.mocked(mockWorkflowRepository.findById).mockResolvedValue(null)

      const result = await service.getWorkflow(workflowId, userId)

      expect(result).toBeNull()
      expect(mockWorkflowRepository.hasAccess).not.toHaveBeenCalled()
    })

    it('should throw error when user lacks access', async () => {
      const workflow = {
        id: workflowId,
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] },
        version: 1,
        visibility: WorkflowVisibility.PRIVATE,
        tags: [],
        createdBy: 'other-user',
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(mockWorkflowRepository.findById).mockResolvedValue(workflow)
      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(false)

      await expect(
        service.getWorkflow(workflowId, userId)
      ).rejects.toThrow('Insufficient permissions to access this workflow')
    })
  })

  describe('updateWorkflow', () => {
    const updateRequest = {
      name: 'Updated Workflow',
      description: 'Updated description'
    }

    it('should update workflow when user has write access', async () => {
      const updatedWorkflow = {
        id: workflowId,
        name: updateRequest.name,
        description: updateRequest.description,
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] },
        version: 1,
        visibility: WorkflowVisibility.PRIVATE,
        tags: [],
        createdBy: userId,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(true)
      vi.mocked(mockWorkflowRepository.update).mockResolvedValue(updatedWorkflow)

      const result = await service.updateWorkflow(workflowId, updateRequest, userId)

      expect(mockWorkflowRepository.hasAccess).toHaveBeenCalledWith(workflowId, userId, 'write')
      expect(mockWorkflowRepository.update).toHaveBeenCalledWith(workflowId, updateRequest, userId)
      expect(result).toEqual(updatedWorkflow)
    })

    it('should throw error when user lacks write access', async () => {
      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(false)

      await expect(
        service.updateWorkflow(workflowId, updateRequest, userId)
      ).rejects.toThrow('Insufficient permissions to update this workflow')

      expect(mockWorkflowRepository.update).not.toHaveBeenCalled()
    })

    it('should validate name when updating', async () => {
      const invalidUpdate = {
        name: '' // Invalid name
      }

      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(true)

      await expect(
        service.updateWorkflow(workflowId, invalidUpdate, userId)
      ).rejects.toThrow('Invalid workflow name')

      expect(mockWorkflowRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteWorkflow', () => {
    it('should delete workflow when user has delete access', async () => {
      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(true)
      vi.mocked(mockWorkflowRepository.delete).mockResolvedValue(undefined)

      await service.deleteWorkflow(workflowId, userId)

      expect(mockWorkflowRepository.hasAccess).toHaveBeenCalledWith(workflowId, userId, 'delete')
      expect(mockWorkflowRepository.delete).toHaveBeenCalledWith(workflowId, userId)
    })

    it('should throw error when user lacks delete access', async () => {
      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(false)

      await expect(
        service.deleteWorkflow(workflowId, userId)
      ).rejects.toThrow('Insufficient permissions to delete this workflow')

      expect(mockWorkflowRepository.delete).not.toHaveBeenCalled()
    })
  })

  describe('shareWorkflow', () => {
    const shareRequest = {
      userId: 'collaborator-123',
      role: 'editor' as const
    }

    it('should share workflow when user is owner', async () => {
      const collaborator = {
        id: 'collab-123',
        workflowId,
        userId: shareRequest.userId,
        role: shareRequest.role,
        createdAt: new Date()
      }

      vi.mocked(mockWorkflowRepository.isOwner).mockResolvedValue(true)
      vi.mocked(mockWorkflowCollaboratorRepository.addCollaborator).mockResolvedValue(collaborator)

      const result = await service.shareWorkflow(workflowId, shareRequest, userId)

      expect(mockWorkflowRepository.isOwner).toHaveBeenCalledWith(workflowId, userId)
      expect(mockWorkflowCollaboratorRepository.addCollaborator).toHaveBeenCalledWith(
        workflowId,
        shareRequest
      )
      expect(result).toEqual(collaborator)
    })

    it('should throw error when user is not owner', async () => {
      vi.mocked(mockWorkflowRepository.isOwner).mockResolvedValue(false)

      await expect(
        service.shareWorkflow(workflowId, shareRequest, userId)
      ).rejects.toThrow('Only workflow owners can share workflows')

      expect(mockWorkflowCollaboratorRepository.addCollaborator).not.toHaveBeenCalled()
    })
  })

  describe('createWorkflowVersion', () => {
    const versionRequest = {
      definition: {
        nodes: [
          {
            id: 'node1',
            type: 'input',
            position: { x: 0, y: 0 },
            data: { value: 'updated' }
          }
        ],
        edges: []
      },
      changeLog: 'Updated node configuration'
    }

    it('should create version when user has write access', async () => {
      const workflow = {
        id: workflowId,
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [] },
        version: 1,
        visibility: WorkflowVisibility.PRIVATE,
        tags: [],
        createdBy: userId,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const newVersion = {
        id: 'version-123',
        workflowId,
        version: 2,
        definition: versionRequest.definition,
        changeLog: versionRequest.changeLog,
        createdBy: userId,
        createdAt: new Date()
      }

      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(true)
      vi.mocked(mockWorkflowRepository.findById).mockResolvedValue(workflow)
      vi.mocked(mockWorkflowVersionRepository.create).mockResolvedValue(newVersion)

      const result = await service.createWorkflowVersion(workflowId, versionRequest, userId)

      expect(mockWorkflowRepository.hasAccess).toHaveBeenCalledWith(workflowId, userId, 'write')
      expect(mockWorkflowRepository.findById).toHaveBeenCalledWith(workflowId)
      expect(mockWorkflowVersionRepository.create).toHaveBeenCalledWith(
        workflowId,
        versionRequest,
        userId
      )
      expect(result).toEqual(newVersion)
    })

    it('should throw error when user lacks write access', async () => {
      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(false)

      await expect(
        service.createWorkflowVersion(workflowId, versionRequest, userId)
      ).rejects.toThrow('Insufficient permissions to create workflow version')

      expect(mockWorkflowVersionRepository.create).not.toHaveBeenCalled()
    })

    it('should throw error for non-existent workflow', async () => {
      vi.mocked(mockWorkflowRepository.hasAccess).mockResolvedValue(true)
      vi.mocked(mockWorkflowRepository.findById).mockResolvedValue(null)

      await expect(
        service.createWorkflowVersion(workflowId, versionRequest, userId)
      ).rejects.toThrow('Workflow not found')

      expect(mockWorkflowVersionRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('validateWorkflowDefinition', () => {
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

      const result = service.validateWorkflowDefinition(definition, EngineType.LANGFLOW)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid definition', () => {
      const definition = {
        nodes: [
          {
            id: 'node1'
            // Missing required fields
          }
        ]
      }

      const result = service.validateWorkflowDefinition(definition, EngineType.LANGFLOW)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})