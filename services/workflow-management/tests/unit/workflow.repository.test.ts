import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma } from '../setup'
import { WorkflowRepository } from '../../src/repositories/workflow.repository'
import { EngineType, WorkflowVisibility } from '../../src/types/workflow.types'

describe('WorkflowRepository', () => {
  let repository: WorkflowRepository
  let testOrganization: any
  let testUser: any

  beforeEach(async () => {
    repository = new WorkflowRepository(testPrisma)

    // Create test organization
    testOrganization = await testPrisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org',
        plan: 'PROFESSIONAL'
      }
    })

    // Create test user
    testUser = await testPrisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        organizationId: testOrganization.id,
        role: 'DEVELOPER'
      }
    })
  })

  describe('create', () => {
    it('should create a workflow successfully', async () => {
      const request = {
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
        tags: ['test', 'example']
      }

      const workflow = await repository.create(request, testUser.id, testOrganization.id)

      expect(workflow.id).toBeDefined()
      expect(workflow.name).toBe(request.name)
      expect(workflow.description).toBe(request.description)
      expect(workflow.engineType).toBe(request.engineType)
      expect(workflow.visibility).toBe(request.visibility)
      expect(workflow.tags).toEqual(request.tags)
      expect(workflow.createdBy).toBe(testUser.id)
      expect(workflow.organizationId).toBe(testOrganization.id)
      expect(workflow.version).toBe(1)

      // Verify initial version was created
      const versions = await testPrisma.workflowVersion.findMany({
        where: { workflowId: workflow.id }
      })
      expect(versions).toHaveLength(1)
      expect(versions[0].version).toBe(1)
    })

    it('should create workflow with default values', async () => {
      const request = {
        name: 'Minimal Workflow',
        engineType: EngineType.N8N,
        definition: {
          nodes: [
            {
              id: 'node1',
              name: 'Start',
              type: 'n8n-nodes-base.start',
              position: [0, 0]
            }
          ]
        }
      }

      const workflow = await repository.create(request, testUser.id, testOrganization.id)

      expect(workflow.visibility).toBe(WorkflowVisibility.PRIVATE)
      expect(workflow.tags).toEqual([])
      expect(workflow.description).toBeNull()
    })
  })

  describe('findById', () => {
    it('should find workflow by ID', async () => {
      const created = await testPrisma.workflow.create({
        data: {
          name: 'Test Workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [] },
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      const found = await repository.findById(created.id)

      expect(found).toBeDefined()
      expect(found!.id).toBe(created.id)
      expect(found!.name).toBe(created.name)
    })

    it('should return null for non-existent workflow', async () => {
      const found = await repository.findById('non-existent-id')
      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('should update workflow and create new version when definition changes', async () => {
      const workflow = await testPrisma.workflow.create({
        data: {
          name: 'Original Workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [{ id: 'node1' }] },
          version: 1,
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      await testPrisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          definition: { nodes: [{ id: 'node1' }] },
          createdBy: testUser.id
        }
      })

      const updateRequest = {
        name: 'Updated Workflow',
        definition: { nodes: [{ id: 'node1' }, { id: 'node2' }] }
      }

      const updated = await repository.update(workflow.id, updateRequest, testUser.id)

      expect(updated.name).toBe('Updated Workflow')
      expect(updated.version).toBe(2)

      // Verify new version was created
      const versions = await testPrisma.workflowVersion.findMany({
        where: { workflowId: workflow.id }
      })
      expect(versions).toHaveLength(2)
    })

    it('should update workflow without creating new version when definition unchanged', async () => {
      const workflow = await testPrisma.workflow.create({
        data: {
          name: 'Original Workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [{ id: 'node1' }] },
          version: 1,
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      const updateRequest = {
        name: 'Updated Name Only'
      }

      const updated = await repository.update(workflow.id, updateRequest, testUser.id)

      expect(updated.name).toBe('Updated Name Only')
      expect(updated.version).toBe(1) // Version should not change
    })

    it('should throw error for non-existent workflow', async () => {
      const updateRequest = { name: 'Updated' }

      await expect(
        repository.update('non-existent-id', updateRequest, testUser.id)
      ).rejects.toThrow('Workflow not found')
    })
  })

  describe('delete', () => {
    it('should delete workflow when user is owner', async () => {
      const workflow = await testPrisma.workflow.create({
        data: {
          name: 'Test Workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [] },
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      await repository.delete(workflow.id, testUser.id)

      const found = await testPrisma.workflow.findUnique({
        where: { id: workflow.id }
      })
      expect(found).toBeNull()
    })

    it('should throw error when user is not owner', async () => {
      const otherUser = await testPrisma.user.create({
        data: {
          name: 'Other User',
          email: 'other@example.com',
          organizationId: testOrganization.id,
          role: 'DEVELOPER'
        }
      })

      const workflow = await testPrisma.workflow.create({
        data: {
          name: 'Test Workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [] },
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      await expect(
        repository.delete(workflow.id, otherUser.id)
      ).rejects.toThrow('Insufficient permissions to delete workflow')
    })

    it('should throw error for non-existent workflow', async () => {
      await expect(
        repository.delete('non-existent-id', testUser.id)
      ).rejects.toThrow('Workflow not found')
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      // Create test workflows
      await testPrisma.workflow.createMany({
        data: [
          {
            name: 'Data Processing Workflow',
            description: 'Processes customer data',
            engineType: 'LANGFLOW',
            definition: { nodes: [] },
            visibility: 'PUBLIC',
            tags: ['data', 'processing'],
            createdBy: testUser.id,
            organizationId: testOrganization.id
          },
          {
            name: 'Email Automation',
            description: 'Automates email campaigns',
            engineType: 'N8N',
            definition: { nodes: [] },
            visibility: 'PRIVATE',
            tags: ['email', 'automation'],
            createdBy: testUser.id,
            organizationId: testOrganization.id
          },
          {
            name: 'AI Chat Bot',
            description: 'Customer service chatbot',
            engineType: 'LANGSMITH',
            definition: { nodes: [] },
            visibility: 'ORGANIZATION',
            tags: ['ai', 'chat'],
            createdBy: testUser.id,
            organizationId: testOrganization.id
          }
        ]
      })
    })

    it('should search workflows by query', async () => {
      const result = await repository.search({ query: 'data' })

      expect(result.workflows).toHaveLength(1)
      expect(result.workflows[0].name).toBe('Data Processing Workflow')
      expect(result.total).toBe(1)
      expect(result.hasMore).toBe(false)
    })

    it('should filter workflows by engine type', async () => {
      const result = await repository.search({ engineType: EngineType.N8N })

      expect(result.workflows).toHaveLength(1)
      expect(result.workflows[0].engineType).toBe(EngineType.N8N)
    })

    it('should filter workflows by visibility', async () => {
      const result = await repository.search({ visibility: WorkflowVisibility.PUBLIC })

      expect(result.workflows).toHaveLength(1)
      expect(result.workflows[0].visibility).toBe(WorkflowVisibility.PUBLIC)
    })

    it('should filter workflows by tags', async () => {
      const result = await repository.search({ tags: ['automation'] })

      expect(result.workflows).toHaveLength(1)
      expect(result.workflows[0].tags).toContain('automation')
    })

    it('should support pagination', async () => {
      const result = await repository.search({ limit: 2, offset: 0 })

      expect(result.workflows).toHaveLength(2)
      expect(result.total).toBe(3)
      expect(result.hasMore).toBe(true)
    })

    it('should sort workflows', async () => {
      const result = await repository.search({
        sortBy: 'name',
        sortOrder: 'asc'
      })

      expect(result.workflows[0].name).toBe('AI Chat Bot')
      expect(result.workflows[1].name).toBe('Data Processing Workflow')
      expect(result.workflows[2].name).toBe('Email Automation')
    })
  })

  describe('hasAccess', () => {
    it('should grant access to workflow owner', async () => {
      const workflow = await testPrisma.workflow.create({
        data: {
          name: 'Test Workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [] },
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      const hasAccess = await repository.hasAccess(workflow.id, testUser.id, 'read')
      expect(hasAccess).toBe(true)
    })

    it('should grant access to collaborators based on role', async () => {
      const collaborator = await testPrisma.user.create({
        data: {
          name: 'Collaborator',
          email: 'collaborator@example.com',
          organizationId: testOrganization.id,
          role: 'DEVELOPER'
        }
      })

      const workflow = await testPrisma.workflow.create({
        data: {
          name: 'Test Workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [] },
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      await testPrisma.workflowCollaborator.create({
        data: {
          workflowId: workflow.id,
          userId: collaborator.id,
          role: 'editor'
        }
      })

      const canRead = await repository.hasAccess(workflow.id, collaborator.id, 'read')
      const canWrite = await repository.hasAccess(workflow.id, collaborator.id, 'write')
      const canDelete = await repository.hasAccess(workflow.id, collaborator.id, 'delete')

      expect(canRead).toBe(true)
      expect(canWrite).toBe(true)
      expect(canDelete).toBe(false) // Only owners can delete
    })

    it('should deny access to non-collaborators', async () => {
      const otherUser = await testPrisma.user.create({
        data: {
          name: 'Other User',
          email: 'other@example.com',
          organizationId: testOrganization.id,
          role: 'DEVELOPER'
        }
      })

      const workflow = await testPrisma.workflow.create({
        data: {
          name: 'Test Workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [] },
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      const hasAccess = await repository.hasAccess(workflow.id, otherUser.id, 'read')
      expect(hasAccess).toBe(false)
    })
  })

  describe('getStats', () => {
    beforeEach(async () => {
      // Create test workflows and executions
      const workflow1 = await testPrisma.workflow.create({
        data: {
          name: 'Workflow 1',
          engineType: 'LANGFLOW',
          definition: { nodes: [] },
          visibility: 'PUBLIC',
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      const workflow2 = await testPrisma.workflow.create({
        data: {
          name: 'Workflow 2',
          engineType: 'N8N',
          definition: { nodes: [] },
          visibility: 'PRIVATE',
          createdBy: testUser.id,
          organizationId: testOrganization.id
        }
      })

      await testPrisma.execution.createMany({
        data: [
          {
            workflowId: workflow1.id,
            workflowVersion: 1,
            status: 'COMPLETED',
            userId: testUser.id,
            organizationId: testOrganization.id,
            startTime: new Date('2024-01-01T10:00:00Z'),
            endTime: new Date('2024-01-01T10:05:00Z')
          },
          {
            workflowId: workflow2.id,
            workflowVersion: 1,
            status: 'FAILED',
            userId: testUser.id,
            organizationId: testOrganization.id,
            startTime: new Date('2024-01-01T11:00:00Z'),
            endTime: new Date('2024-01-01T11:02:00Z')
          }
        ]
      })
    })

    it('should return workflow statistics', async () => {
      const stats = await repository.getStats(testOrganization.id)

      expect(stats.totalWorkflows).toBe(2)
      expect(stats.workflowsByEngine[EngineType.LANGFLOW]).toBe(1)
      expect(stats.workflowsByEngine[EngineType.N8N]).toBe(1)
      expect(stats.workflowsByEngine[EngineType.LANGSMITH]).toBe(0)
      expect(stats.workflowsByVisibility[WorkflowVisibility.PUBLIC]).toBe(1)
      expect(stats.workflowsByVisibility[WorkflowVisibility.PRIVATE]).toBe(1)
      expect(stats.totalExecutions).toBe(2)
      expect(stats.executionsByStatus.COMPLETED).toBe(1)
      expect(stats.executionsByStatus.FAILED).toBe(1)
      expect(stats.averageExecutionTime).toBeGreaterThan(0)
    })

    it('should return global statistics when no organization specified', async () => {
      const stats = await repository.getStats()

      expect(stats.totalWorkflows).toBeGreaterThanOrEqual(2)
      expect(stats.totalExecutions).toBeGreaterThanOrEqual(2)
    })
  })
})