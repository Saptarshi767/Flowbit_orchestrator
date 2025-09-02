import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma } from '../setup'
import { RepositoryFactory } from '../../src/repositories/repository.factory'
import { WorkflowService } from '../../src/services/workflow.service'
import { EngineType, WorkflowVisibility, CollaboratorRole } from '../../src/types/workflow.types'

describe('Workflow Management Integration', () => {
  let repositoryFactory: RepositoryFactory
  let workflowService: WorkflowService
  let testOrganization: any
  let testUser: any
  let collaboratorUser: any

  beforeEach(async () => {
    repositoryFactory = RepositoryFactory.getInstance(testPrisma)
    workflowService = new WorkflowService(
      repositoryFactory.getWorkflowRepository(),
      repositoryFactory.getWorkflowVersionRepository(),
      repositoryFactory.getWorkflowCollaboratorRepository()
    )

    // Create test organization
    testOrganization = await testPrisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org',
        plan: 'PROFESSIONAL'
      }
    })

    // Create test users
    testUser = await testPrisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        organizationId: testOrganization.id,
        role: 'DEVELOPER'
      }
    })

    collaboratorUser = await testPrisma.user.create({
      data: {
        name: 'Collaborator User',
        email: 'collaborator@example.com',
        organizationId: testOrganization.id,
        role: 'DEVELOPER'
      }
    })
  })

  describe('Complete Workflow Lifecycle', () => {
    it('should handle complete workflow lifecycle with versioning and collaboration', async () => {
      // 1. Create initial workflow
      const createRequest = {
        name: 'Integration Test Workflow',
        description: 'A comprehensive integration test workflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          nodes: [
            {
              id: 'input-node',
              type: 'input',
              position: { x: 0, y: 0 },
              data: { value: 'initial' }
            }
          ],
          edges: []
        },
        visibility: WorkflowVisibility.PRIVATE,
        tags: ['integration', 'test']
      }

      const workflow = await workflowService.createWorkflow(
        createRequest,
        testUser.id,
        testOrganization.id
      )

      expect(workflow.id).toBeDefined()
      expect(workflow.name).toBe(createRequest.name)
      expect(workflow.version).toBe(1)

      // 2. Verify initial version was created
      const versions = await workflowService.getWorkflowVersions(workflow.id, testUser.id)
      expect(versions).toHaveLength(1)
      expect(versions[0].version).toBe(1)

      // 3. Share workflow with collaborator
      const shareRequest = {
        userId: collaboratorUser.id,
        role: CollaboratorRole.EDITOR
      }

      const collaborator = await workflowService.shareWorkflow(
        workflow.id,
        shareRequest,
        testUser.id
      )

      expect(collaborator.userId).toBe(collaboratorUser.id)
      expect(collaborator.role).toBe(CollaboratorRole.EDITOR)

      // 4. Collaborator should be able to read and write
      const workflowAsCollaborator = await workflowService.getWorkflow(
        workflow.id,
        collaboratorUser.id
      )
      expect(workflowAsCollaborator).toBeDefined()

      // 5. Update workflow (should create new version)
      const updateRequest = {
        name: 'Updated Integration Test Workflow',
        definition: {
          nodes: [
            {
              id: 'input-node',
              type: 'input',
              position: { x: 0, y: 0 },
              data: { value: 'updated' }
            },
            {
              id: 'output-node',
              type: 'output',
              position: { x: 200, y: 0 },
              data: { value: 'result' }
            }
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'input-node',
              target: 'output-node'
            }
          ]
        }
      }

      const updatedWorkflow = await workflowService.updateWorkflow(
        workflow.id,
        updateRequest,
        collaboratorUser.id
      )

      expect(updatedWorkflow.name).toBe(updateRequest.name)
      expect(updatedWorkflow.version).toBe(2)

      // 6. Verify new version was created
      const updatedVersions = await workflowService.getWorkflowVersions(
        workflow.id,
        testUser.id
      )
      expect(updatedVersions).toHaveLength(2)
      expect(updatedVersions[0].version).toBe(2) // Latest first

      // 7. Compare versions
      const comparison = await workflowService.compareWorkflowVersions(
        workflow.id,
        1,
        2,
        testUser.id
      )

      expect(comparison.version1.version).toBe(1)
      expect(comparison.version2.version).toBe(2)
      expect(comparison.differences.added).toHaveLength(1) // New output node
      expect(comparison.differences.modified).toHaveLength(1) // Updated input node

      // 8. Create explicit version
      const versionRequest = {
        definition: {
          nodes: [
            {
              id: 'input-node',
              type: 'input',
              position: { x: 0, y: 0 },
              data: { value: 'final' }
            },
            {
              id: 'processing-node',
              type: 'processor',
              position: { x: 100, y: 0 },
              data: { operation: 'transform' }
            },
            {
              id: 'output-node',
              type: 'output',
              position: { x: 200, y: 0 },
              data: { value: 'result' }
            }
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'input-node',
              target: 'processing-node'
            },
            {
              id: 'edge-2',
              source: 'processing-node',
              target: 'output-node'
            }
          ]
        },
        changeLog: 'Added processing node for data transformation'
      }

      const newVersion = await workflowService.createWorkflowVersion(
        workflow.id,
        versionRequest,
        testUser.id
      )

      expect(newVersion.version).toBe(3)
      expect(newVersion.changeLog).toBe(versionRequest.changeLog)

      // 9. Get workflow collaborators
      const collaborators = await workflowService.getWorkflowCollaborators(
        workflow.id,
        testUser.id
      )
      expect(collaborators).toHaveLength(1)
      expect(collaborators[0].userId).toBe(collaboratorUser.id)

      // 10. Update collaborator role
      const updatedCollaborator = await workflowService.updateCollaboratorRole(
        workflow.id,
        collaboratorUser.id,
        CollaboratorRole.VIEWER,
        testUser.id
      )
      expect(updatedCollaborator.role).toBe(CollaboratorRole.VIEWER)

      // 11. Collaborator should no longer be able to write
      await expect(
        workflowService.updateWorkflow(
          workflow.id,
          { name: 'Should fail' },
          collaboratorUser.id
        )
      ).rejects.toThrow('Insufficient permissions to update this workflow')

      // 12. Search workflows
      const searchResult = await workflowService.searchWorkflows({
        query: 'integration',
        organizationId: testOrganization.id
      })

      expect(searchResult.workflows).toHaveLength(1)
      expect(searchResult.workflows[0].id).toBe(workflow.id)

      // 13. Get workflow statistics
      const stats = await workflowService.getWorkflowStats(testOrganization.id)
      expect(stats.totalWorkflows).toBe(1)
      expect(stats.workflowsByEngine[EngineType.LANGFLOW]).toBe(1)
      expect(stats.workflowsByVisibility[WorkflowVisibility.PRIVATE]).toBe(1)

      // 14. Remove collaborator
      await workflowService.removeCollaborator(
        workflow.id,
        collaboratorUser.id,
        testUser.id
      )

      const finalCollaborators = await workflowService.getWorkflowCollaborators(
        workflow.id,
        testUser.id
      )
      expect(finalCollaborators).toHaveLength(0)

      // 15. Collaborator should no longer have access
      await expect(
        workflowService.getWorkflow(workflow.id, collaboratorUser.id)
      ).rejects.toThrow('Insufficient permissions to access this workflow')

      // 16. Delete workflow (only owner can do this)
      await workflowService.deleteWorkflow(workflow.id, testUser.id)

      // 17. Verify workflow is deleted
      const deletedWorkflow = await workflowService.getWorkflow(workflow.id, testUser.id)
      expect(deletedWorkflow).toBeNull()
    })
  })

  describe('Multi-Engine Workflow Support', () => {
    it('should handle workflows from different engines', async () => {
      // Create Langflow workflow
      const langflowWorkflow = await workflowService.createWorkflow(
        {
          name: 'Langflow Workflow',
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
          }
        },
        testUser.id,
        testOrganization.id
      )

      // Create N8N workflow
      const n8nWorkflow = await workflowService.createWorkflow(
        {
          name: 'N8N Workflow',
          engineType: EngineType.N8N,
          definition: {
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
        },
        testUser.id,
        testOrganization.id
      )

      // Create LangSmith workflow
      const langsmithWorkflow = await workflowService.createWorkflow(
        {
          name: 'LangSmith Workflow',
          engineType: EngineType.LANGSMITH,
          definition: {
            nodes: [
              {
                id: 'node1',
                type: 'llm',
                config: { model: 'gpt-3.5-turbo' }
              }
            ]
          }
        },
        testUser.id,
        testOrganization.id
      )

      // Search by engine type
      const langflowResults = await workflowService.searchWorkflows({
        engineType: EngineType.LANGFLOW,
        organizationId: testOrganization.id
      })
      expect(langflowResults.workflows).toHaveLength(1)
      expect(langflowResults.workflows[0].engineType).toBe(EngineType.LANGFLOW)

      const n8nResults = await workflowService.searchWorkflows({
        engineType: EngineType.N8N,
        organizationId: testOrganization.id
      })
      expect(n8nResults.workflows).toHaveLength(1)
      expect(n8nResults.workflows[0].engineType).toBe(EngineType.N8N)

      const langsmithResults = await workflowService.searchWorkflows({
        engineType: EngineType.LANGSMITH,
        organizationId: testOrganization.id
      })
      expect(langsmithResults.workflows).toHaveLength(1)
      expect(langsmithResults.workflows[0].engineType).toBe(EngineType.LANGSMITH)

      // Get statistics
      const stats = await workflowService.getWorkflowStats(testOrganization.id)
      expect(stats.totalWorkflows).toBe(3)
      expect(stats.workflowsByEngine[EngineType.LANGFLOW]).toBe(1)
      expect(stats.workflowsByEngine[EngineType.N8N]).toBe(1)
      expect(stats.workflowsByEngine[EngineType.LANGSMITH]).toBe(1)
    })
  })

  describe('Workflow Validation', () => {
    it('should validate workflow definitions for different engines', () => {
      // Valid Langflow definition
      const langflowResult = workflowService.validateWorkflowDefinition(
        {
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
        EngineType.LANGFLOW
      )
      expect(langflowResult.isValid).toBe(true)

      // Valid N8N definition
      const n8nResult = workflowService.validateWorkflowDefinition(
        {
          nodes: [
            {
              id: 'node1',
              name: 'Start',
              type: 'n8n-nodes-base.start',
              position: [0, 0],
              parameters: {}
            }
          ]
        },
        EngineType.N8N
      )
      expect(n8nResult.isValid).toBe(true)

      // Valid LangSmith definition
      const langsmithResult = workflowService.validateWorkflowDefinition(
        {
          nodes: [
            {
              id: 'node1',
              type: 'llm',
              config: { model: 'gpt-3.5-turbo' }
            }
          ]
        },
        EngineType.LANGSMITH
      )
      expect(langsmithResult.isValid).toBe(true)

      // Invalid definition (missing required fields)
      const invalidResult = workflowService.validateWorkflowDefinition(
        {
          nodes: [
            {
              id: 'node1'
              // Missing required fields
            }
          ]
        },
        EngineType.LANGFLOW
      )
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors.length).toBeGreaterThan(0)
    })
  })
})