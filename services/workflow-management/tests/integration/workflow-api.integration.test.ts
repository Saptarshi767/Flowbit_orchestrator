import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createWorkflowManagementApp } from '../../src/app'
import { EngineType, WorkflowVisibility } from '../../src/types/workflow.types'

const prisma = new PrismaClient()
const app = createWorkflowManagementApp(prisma)

describe('Workflow Management API Integration Tests', () => {
  const testUserId = 'test-user-123'
  const testOrgId = 'test-org-123'
  const authToken = 'Bearer test-token'
  let createdWorkflowId: string

  beforeAll(async () => {
    // Setup test database
    await prisma.$connect()
  })

  afterAll(async () => {
    // Cleanup
    if (createdWorkflowId) {
      try {
        await request(app)
          .delete(`/api/workflows/${createdWorkflowId}`)
          .set('Authorization', authToken)
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.workflowCollaborator.deleteMany({
      where: { userId: testUserId }
    })
    await prisma.workflowVersion.deleteMany({
      where: { createdBy: testUserId }
    })
    await prisma.workflow.deleteMany({
      where: { createdBy: testUserId }
    })
  })

  describe('Workflow CRUD API Endpoints', () => {
    it('should create a new workflow via POST /api/workflows', async () => {
      const workflowData = {
        name: 'Test Workflow API',
        description: 'A test workflow via API',
        engineType: EngineType.LANGFLOW,
        definition: {
          nodes: [
            { id: 'node1', type: 'input', position: { x: 0, y: 0 }, data: {} }
          ],
          edges: []
        },
        visibility: WorkflowVisibility.PRIVATE,
        tags: ['test', 'api']
      }

      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', authToken)
        .send(workflowData)
        .expect(201)

      expect(response.body).toBeDefined()
      expect(response.body.name).toBe(workflowData.name)
      expect(response.body.engineType).toBe(workflowData.engineType)
      expect(response.body.createdBy).toBe(testUserId)
      expect(response.body.organizationId).toBe(testOrgId)

      createdWorkflowId = response.body.id
    })

    it('should retrieve a workflow via GET /api/workflows/:id', async () => {
      // First create a workflow
      const workflowData = {
        name: 'Test Workflow for GET',
        engineType: EngineType.N8N,
        definition: { nodes: [], edges: [] }
      }

      const createResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', authToken)
        .send(workflowData)
        .expect(201)

      // Then retrieve it
      const getResponse = await request(app)
        .get(`/api/workflows/${createResponse.body.id}`)
        .set('Authorization', authToken)
        .expect(200)

      expect(getResponse.body.id).toBe(createResponse.body.id)
      expect(getResponse.body.name).toBe(workflowData.name)
    })

    it('should update a workflow via PUT /api/workflows/:id', async () => {
      // Create workflow
      const workflowData = {
        name: 'Original Name API',
        engineType: EngineType.LANGSMITH,
        definition: { nodes: [], edges: [] }
      }

      const createResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', authToken)
        .send(workflowData)
        .expect(201)

      // Update workflow
      const updateData = {
        name: 'Updated Name API',
        description: 'Updated description via API',
        tags: ['updated', 'api']
      }

      const updateResponse = await request(app)
        .put(`/api/workflows/${createResponse.body.id}`)
        .set('Authorization', authToken)
        .send(updateData)
        .expect(200)

      expect(updateResponse.body.name).toBe(updateData.name)
      expect(updateResponse.body.description).toBe(updateData.description)
      expect(updateResponse.body.tags).toEqual(updateData.tags)
    })

    it('should delete a workflow via DELETE /api/workflows/:id', async () => {
      // Create workflow
      const workflowData = {
        name: 'Workflow to Delete API',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      }

      const createResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', authToken)
        .send(workflowData)
        .expect(201)

      // Delete workflow
      await request(app)
        .delete(`/api/workflows/${createResponse.body.id}`)
        .set('Authorization', authToken)
        .expect(204)

      // Verify deletion
      await request(app)
        .get(`/api/workflows/${createResponse.body.id}`)
        .set('Authorization', authToken)
        .expect(404)
    })
  })

  describe('Workflow Search API', () => {
    beforeEach(async () => {
      // Create test workflows
      const workflows = [
        {
          name: 'Data Processing Workflow API',
          engineType: EngineType.N8N,
          definition: { nodes: [], edges: [] },
          tags: ['data', 'processing']
        },
        {
          name: 'AI Classification Workflow API',
          engineType: EngineType.LANGFLOW,
          definition: { nodes: [], edges: [] },
          tags: ['ai', 'classification']
        }
      ]

      for (const workflowData of workflows) {
        await request(app)
          .post('/api/workflows')
          .set('Authorization', authToken)
          .send(workflowData)
      }
    })

    it('should search workflows via GET /api/workflows', async () => {
      const response = await request(app)
        .get('/api/workflows')
        .query({ query: 'Data Processing' })
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body.workflows).toHaveLength(1)
      expect(response.body.workflows[0].name).toContain('Data Processing')
    })

    it('should filter workflows by engine type', async () => {
      const response = await request(app)
        .get('/api/workflows')
        .query({ engineType: EngineType.LANGFLOW })
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body.workflows).toHaveLength(1)
      expect(response.body.workflows[0].engineType).toBe(EngineType.LANGFLOW)
    })
  })

  describe('Workflow Version API', () => {
    let workflowId: string

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', authToken)
        .send({
          name: 'Versioned Workflow API',
          engineType: EngineType.LANGFLOW,
          definition: { nodes: [], edges: [] }
        })
      workflowId = response.body.id
    })

    it('should create a new workflow version via POST /api/workflows/:id/versions', async () => {
      const versionData = {
        definition: {
          nodes: [
            { id: 'node1', type: 'input', position: { x: 0, y: 0 }, data: {} }
          ],
          edges: []
        },
        changeLog: 'Added input node via API'
      }

      const response = await request(app)
        .post(`/api/workflows/${workflowId}/versions`)
        .set('Authorization', authToken)
        .send(versionData)
        .expect(201)

      expect(response.body.version).toBe(2)
      expect(response.body.changeLog).toBe(versionData.changeLog)
    })

    it('should retrieve workflow versions via GET /api/workflows/:id/versions', async () => {
      // Create additional version
      await request(app)
        .post(`/api/workflows/${workflowId}/versions`)
        .set('Authorization', authToken)
        .send({
          definition: { nodes: [], edges: [] },
          changeLog: 'Version 2 API'
        })

      const response = await request(app)
        .get(`/api/workflows/${workflowId}/versions`)
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body).toHaveLength(2)
    })
  })

  describe('Workflow Collaboration API', () => {
    let workflowId: string
    const collaboratorUserId = 'collaborator-api-123'

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', authToken)
        .send({
          name: 'Collaborative Workflow API',
          engineType: EngineType.N8N,
          definition: { nodes: [], edges: [] }
        })
      workflowId = response.body.id
    })

    it('should share workflow via POST /api/workflows/:id/collaborators', async () => {
      const shareData = {
        userId: collaboratorUserId,
        role: 'editor'
      }

      const response = await request(app)
        .post(`/api/workflows/${workflowId}/collaborators`)
        .set('Authorization', authToken)
        .send(shareData)
        .expect(201)

      expect(response.body.userId).toBe(collaboratorUserId)
      expect(response.body.role).toBe('editor')
    })

    it('should get collaborators via GET /api/workflows/:id/collaborators', async () => {
      // Add collaborator first
      await request(app)
        .post(`/api/workflows/${workflowId}/collaborators`)
        .set('Authorization', authToken)
        .send({
          userId: collaboratorUserId,
          role: 'viewer'
        })

      const response = await request(app)
        .get(`/api/workflows/${workflowId}/collaborators`)
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body).toHaveLength(1)
      expect(response.body[0].userId).toBe(collaboratorUserId)
    })
  })

  describe('Workflow Import API', () => {
    it('should import Langflow workflow via POST /api/workflows/import', async () => {
      const importData = {
        engineType: EngineType.LANGFLOW,
        source: {
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
          name: 'Imported Langflow Workflow'
        },
        name: 'My Imported Workflow'
      }

      const response = await request(app)
        .post('/api/workflows/import')
        .set('Authorization', authToken)
        .send(importData)
        .expect(201)

      expect(response.body.name).toBe(importData.name)
      expect(response.body.engineType).toBe(EngineType.LANGFLOW)
    })

    it('should validate import via POST /api/workflows/import/validate', async () => {
      const validateData = {
        engineType: EngineType.N8N,
        source: {
          nodes: [
            {
              name: 'Start',
              type: 'n8n-nodes-base.start',
              position: [250, 300]
            }
          ]
        }
      }

      const response = await request(app)
        .post('/api/workflows/import/validate')
        .set('Authorization', authToken)
        .send(validateData)
        .expect(200)

      expect(response.body.isValid).toBeDefined()
    })
  })

  describe('Template API', () => {
    let workflowId: string

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', authToken)
        .send({
          name: 'Template Source Workflow',
          engineType: EngineType.LANGFLOW,
          definition: { nodes: [], edges: [] }
        })
      workflowId = response.body.id
    })

    it('should create template via POST /api/templates', async () => {
      const templateData = {
        workflowId,
        category: 'data-processing',
        difficulty: 'beginner',
        estimatedTime: 15
      }

      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', authToken)
        .send(templateData)
        .expect(201)

      expect(response.body.category).toBe(templateData.category)
      expect(response.body.difficulty).toBe(templateData.difficulty)
    })

    it('should search templates via GET /api/templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .query({ category: 'data-processing' })
        .expect(200)

      expect(response.body.templates).toBeDefined()
      expect(Array.isArray(response.body.templates)).toBe(true)
    })

    it('should get template categories via GET /api/template-categories', async () => {
      const response = await request(app)
        .get('/api/template-categories')
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .get('/api/workflows')
        .expect(401)
    })

    it('should return 404 for non-existent workflow', async () => {
      await request(app)
        .get('/api/workflows/non-existent-id')
        .set('Authorization', authToken)
        .expect(404)
    })

    it('should return 400 for invalid workflow data', async () => {
      const invalidData = {
        name: '', // Empty name should be invalid
        engineType: 'INVALID_ENGINE'
      }

      await request(app)
        .post('/api/workflows')
        .set('Authorization', authToken)
        .send(invalidData)
        .expect(400)
    })
  })

  describe('Health Check', () => {
    it('should return health status via GET /health', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body.status).toBe('healthy')
      expect(response.body.service).toBe('workflow-management')
    })
  })
})