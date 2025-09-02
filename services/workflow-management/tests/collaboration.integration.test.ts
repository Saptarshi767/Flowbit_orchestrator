import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { Server } from 'socket.io'
import { createServer } from 'http'
import { AddressInfo } from 'net'
import { io as Client, Socket } from 'socket.io-client'
import { createWorkflowManagementApp } from '../src/app'
import {
  EngineType,
  WorkflowVisibility,
  CollaboratorRole,
  WorkspaceRole,
  MergeRequestStatus
} from '../src/types/workflow.types'

describe('Collaboration Integration Tests', () => {
  let prisma: PrismaClient
  let app: any
  let server: any
  let ioServer: Server
  let port: number
  let authToken: string

  // Test data
  let testUserId: string
  let testUser2Id: string
  let testOrganizationId: string
  let testWorkflowId: string
  let testWorkspaceId: string

  beforeAll(async () => {
    // Initialize test database
    prisma = new PrismaClient()

    // Create app with WebSocket support
    const appResult = createWorkflowManagementApp(prisma)
    app = appResult.app
    server = appResult.server
    ioServer = appResult.io

    // Start server on random port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port
        resolve()
      })
    })

    authToken = 'Bearer test-token'

    // Setup test data
    await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
    server.close()
    ioServer.close()
  })

  beforeEach(async () => {
    // Clean up any test-specific data
    await prisma.workflowComment.deleteMany({})
    await prisma.workflowFork.deleteMany({})
    await prisma.mergeRequest.deleteMany({})
  })

  async function setupTestData() {
    testUserId = 'test-user-1'
    testUser2Id = 'test-user-2'
    testOrganizationId = 'test-org-1'

    // Create test users
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: 'test1@example.com',
        name: 'Test User 1',
        organizationId: testOrganizationId
      }
    })

    await prisma.user.upsert({
      where: { id: testUser2Id },
      update: {},
      create: {
        id: testUser2Id,
        email: 'test2@example.com',
        name: 'Test User 2',
        organizationId: testOrganizationId
      }
    })

    // Create test organization
    await prisma.organization.upsert({
      where: { id: testOrganizationId },
      update: {},
      create: {
        id: testOrganizationId,
        name: 'Test Organization'
      }
    })

    // Create test workflow
    const workflow = await prisma.workflow.create({
      data: {
        id: 'test-workflow-1',
        name: 'Test Workflow',
        description: 'A test workflow for collaboration',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] },
        version: 1,
        visibility: WorkflowVisibility.PRIVATE,
        tags: ['test'],
        createdBy: testUserId,
        organizationId: testOrganizationId
      }
    })
    testWorkflowId = workflow.id

    // Create test workspace
    const workspace = await prisma.teamWorkspace.create({
      data: {
        id: 'test-workspace-1',
        name: 'Test Workspace',
        description: 'A test workspace',
        organizationId: testOrganizationId,
        createdBy: testUserId
      }
    })
    testWorkspaceId = workspace.id

    // Add creator as admin member
    await prisma.workspaceMember.create({
      data: {
        id: 'test-member-1',
        workspaceId: testWorkspaceId,
        userId: testUserId,
        role: WorkspaceRole.ADMIN
      }
    })
  }

  async function cleanupTestData() {
    await prisma.workspaceMember.deleteMany({})
    await prisma.teamWorkspace.deleteMany({})
    await prisma.workflowCollaborator.deleteMany({})
    await prisma.workflowVersion.deleteMany({})
    await prisma.workflow.deleteMany({})
    await prisma.user.deleteMany({})
    await prisma.organization.deleteMany({})
  }

  describe('Real-time Collaboration', () => {
    it('should handle user joining and leaving workflow sessions', (done) => {
      const client1 = Client(`http://localhost:${port}`)
      const client2 = Client(`http://localhost:${port}`)

      let joinedCount = 0
      let leftCount = 0

      client1.on('connect', () => {
        client1.emit('join-workflow', {
          workflowId: testWorkflowId,
          userId: testUserId,
          userName: 'Test User 1'
        })
      })

      client2.on('connect', () => {
        client2.emit('join-workflow', {
          workflowId: testWorkflowId,
          userId: testUser2Id,
          userName: 'Test User 2'
        })
      })

      client1.on('user-joined', (data) => {
        expect(data.data.userId).toBe(testUser2Id)
        joinedCount++
        if (joinedCount === 1) {
          client2.emit('leave-workflow', {
            workflowId: testWorkflowId,
            userId: testUser2Id
          })
        }
      })

      client1.on('user-left', (data) => {
        expect(data.data.userId).toBe(testUser2Id)
        leftCount++
        if (leftCount === 1) {
          client1.disconnect()
          client2.disconnect()
          done()
        }
      })
    })

    it('should broadcast cursor updates to other users', (done) => {
      const client1 = Client(`http://localhost:${port}`)
      const client2 = Client(`http://localhost:${port}`)

      client1.on('connect', () => {
        client1.emit('join-workflow', {
          workflowId: testWorkflowId,
          userId: testUserId,
          userName: 'Test User 1'
        })
      })

      client2.on('connect', () => {
        client2.emit('join-workflow', {
          workflowId: testWorkflowId,
          userId: testUser2Id,
          userName: 'Test User 2'
        })

        // Send cursor update after joining
        setTimeout(() => {
          client2.emit('cursor-update', {
            workflowId: testWorkflowId,
            userId: testUser2Id,
            cursor: { x: 100, y: 200 }
          })
        }, 100)
      })

      client1.on('cursor-update', (data) => {
        expect(data.data.userId).toBe(testUser2Id)
        expect(data.data.cursor.x).toBe(100)
        expect(data.data.cursor.y).toBe(200)
        client1.disconnect()
        client2.disconnect()
        done()
      })
    })

    it('should handle collaborative operations with operational transform', (done) => {
      const client1 = Client(`http://localhost:${port}`)
      const client2 = Client(`http://localhost:${port}`)

      client1.on('connect', () => {
        client1.emit('join-workflow', {
          workflowId: testWorkflowId,
          userId: testUserId,
          userName: 'Test User 1'
        })
      })

      client2.on('connect', () => {
        client2.emit('join-workflow', {
          workflowId: testWorkflowId,
          userId: testUser2Id,
          userName: 'Test User 2'
        })

        // Send operation after joining
        setTimeout(() => {
          client2.emit('operation', {
            workflowId: testWorkflowId,
            operation: {
              id: 'op-1',
              workflowId: testWorkflowId,
              userId: testUser2Id,
              operation: 'NODE_ADD',
              data: { nodeId: 'node-1', position: { x: 50, y: 50 } },
              timestamp: new Date(),
              applied: false
            }
          })
        }, 100)
      })

      client1.on('operation', (data) => {
        expect(data.data.operation).toBe('NODE_ADD')
        expect(data.data.userId).toBe(testUser2Id)
        client1.disconnect()
        client2.disconnect()
        done()
      })
    })
  })

  describe('Workflow Comments', () => {
    it('should create and retrieve workflow comments', async () => {
      // Create a comment
      const createResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/comments`)
        .set('Authorization', authToken)
        .send({
          content: 'This is a test comment'
        })

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.content).toBe('This is a test comment')
      expect(createResponse.body.workflowId).toBe(testWorkflowId)

      // Retrieve comments
      const getResponse = await request(app)
        .get(`/api/workflows/${testWorkflowId}/comments`)
        .set('Authorization', authToken)

      expect(getResponse.status).toBe(200)
      expect(getResponse.body).toHaveLength(1)
      expect(getResponse.body[0].content).toBe('This is a test comment')
    })

    it('should create threaded comments (replies)', async () => {
      // Create parent comment
      const parentResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/comments`)
        .set('Authorization', authToken)
        .send({
          content: 'Parent comment'
        })

      const parentId = parentResponse.body.id

      // Create reply
      const replyResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/comments`)
        .set('Authorization', authToken)
        .send({
          content: 'Reply comment',
          parentId: parentId
        })

      expect(replyResponse.status).toBe(201)
      expect(replyResponse.body.parentId).toBe(parentId)

      // Retrieve comments with replies
      const getResponse = await request(app)
        .get(`/api/workflows/${testWorkflowId}/comments`)
        .set('Authorization', authToken)

      expect(getResponse.status).toBe(200)
      expect(getResponse.body).toHaveLength(1) // Only parent comment at top level
      expect(getResponse.body[0].replies).toHaveLength(1)
      expect(getResponse.body[0].replies[0].content).toBe('Reply comment')
    })

    it('should update and delete comments', async () => {
      // Create comment
      const createResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/comments`)
        .set('Authorization', authToken)
        .send({
          content: 'Original content'
        })

      const commentId = createResponse.body.id

      // Update comment
      const updateResponse = await request(app)
        .put(`/api/workflows/${testWorkflowId}/comments/${commentId}`)
        .set('Authorization', authToken)
        .send({
          content: 'Updated content'
        })

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content).toBe('Updated content')

      // Delete comment
      const deleteResponse = await request(app)
        .delete(`/api/workflows/${testWorkflowId}/comments/${commentId}`)
        .set('Authorization', authToken)

      expect(deleteResponse.status).toBe(204)

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/workflows/${testWorkflowId}/comments`)
        .set('Authorization', authToken)

      expect(getResponse.status).toBe(200)
      expect(getResponse.body).toHaveLength(0)
    })
  })

  describe('Workflow Forking and Merging', () => {
    it('should fork a workflow', async () => {
      const forkResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/fork`)
        .set('Authorization', authToken)
        .send({
          name: 'Forked Workflow',
          description: 'A fork of the original workflow'
        })

      expect(forkResponse.status).toBe(201)
      expect(forkResponse.body.fork.originalWorkflowId).toBe(testWorkflowId)
      expect(forkResponse.body.workflow.name).toBe('Forked Workflow')
      expect(forkResponse.body.workflow.visibility).toBe(WorkflowVisibility.PRIVATE)
    })

    it('should list forks of a workflow', async () => {
      // Create a fork first
      await request(app)
        .post(`/api/workflows/${testWorkflowId}/fork`)
        .set('Authorization', authToken)
        .send({
          name: 'Test Fork',
          description: 'Test fork description'
        })

      // List forks
      const forksResponse = await request(app)
        .get(`/api/workflows/${testWorkflowId}/forks`)
        .set('Authorization', authToken)

      expect(forksResponse.status).toBe(200)
      expect(forksResponse.body).toHaveLength(1)
      expect(forksResponse.body[0].originalWorkflowId).toBe(testWorkflowId)
    })

    it('should create and manage merge requests', async () => {
      // Create a fork first
      const forkResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/fork`)
        .set('Authorization', authToken)
        .send({
          name: 'Source Fork',
          description: 'Source for merge request'
        })

      const sourceWorkflowId = forkResponse.body.workflow.id

      // Create merge request
      const mergeRequestResponse = await request(app)
        .post(`/api/workflows/${sourceWorkflowId}/merge-requests`)
        .set('Authorization', authToken)
        .send({
          targetWorkflowId: testWorkflowId,
          title: 'Test Merge Request',
          description: 'Testing merge functionality'
        })

      expect(mergeRequestResponse.status).toBe(201)
      expect(mergeRequestResponse.body.sourceWorkflowId).toBe(sourceWorkflowId)
      expect(mergeRequestResponse.body.targetWorkflowId).toBe(testWorkflowId)
      expect(mergeRequestResponse.body.status).toBe(MergeRequestStatus.OPEN)

      const mergeRequestId = mergeRequestResponse.body.id

      // List merge requests
      const listResponse = await request(app)
        .get(`/api/workflows/${testWorkflowId}/merge-requests`)
        .set('Authorization', authToken)

      expect(listResponse.status).toBe(200)
      expect(listResponse.body).toHaveLength(1)

      // Update merge request status
      const statusResponse = await request(app)
        .put(`/api/workflows/merge-requests/${mergeRequestId}/status`)
        .set('Authorization', authToken)
        .send({
          status: MergeRequestStatus.MERGED
        })

      expect(statusResponse.status).toBe(200)
      expect(statusResponse.body.status).toBe(MergeRequestStatus.MERGED)
    })
  })

  describe('Team Workspaces', () => {
    it('should create and manage team workspaces', async () => {
      // Create workspace
      const createResponse = await request(app)
        .post('/api/workflows/workspaces')
        .set('Authorization', authToken)
        .send({
          name: 'New Test Workspace',
          description: 'A new workspace for testing'
        })

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.name).toBe('New Test Workspace')
      expect(createResponse.body.members).toHaveLength(1)
      expect(createResponse.body.members[0].role).toBe(WorkspaceRole.ADMIN)

      const workspaceId = createResponse.body.id

      // Get workspace
      const getResponse = await request(app)
        .get(`/api/workflows/workspaces/${workspaceId}`)
        .set('Authorization', authToken)

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.name).toBe('New Test Workspace')

      // Update workspace
      const updateResponse = await request(app)
        .put(`/api/workflows/workspaces/${workspaceId}`)
        .set('Authorization', authToken)
        .send({
          name: 'Updated Workspace Name'
        })

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.name).toBe('Updated Workspace Name')
    })

    it('should manage workspace members', async () => {
      // Add member to existing workspace
      const addMemberResponse = await request(app)
        .post(`/api/workflows/workspaces/${testWorkspaceId}/members`)
        .set('Authorization', authToken)
        .send({
          userId: testUser2Id,
          role: WorkspaceRole.MEMBER
        })

      expect(addMemberResponse.status).toBe(201)
      expect(addMemberResponse.body.userId).toBe(testUser2Id)
      expect(addMemberResponse.body.role).toBe(WorkspaceRole.MEMBER)

      // Update member role
      const updateRoleResponse = await request(app)
        .put(`/api/workflows/workspaces/${testWorkspaceId}/members/${testUser2Id}/role`)
        .set('Authorization', authToken)
        .send({
          role: WorkspaceRole.ADMIN
        })

      expect(updateRoleResponse.status).toBe(200)
      expect(updateRoleResponse.body.role).toBe(WorkspaceRole.ADMIN)

      // Remove member
      const removeMemberResponse = await request(app)
        .delete(`/api/workflows/workspaces/${testWorkspaceId}/members/${testUser2Id}`)
        .set('Authorization', authToken)

      expect(removeMemberResponse.status).toBe(204)
    })

    it('should list user workspaces', async () => {
      const listResponse = await request(app)
        .get('/api/workflows/workspaces')
        .set('Authorization', authToken)

      expect(listResponse.status).toBe(200)
      expect(listResponse.body).toHaveLength(1)
      expect(listResponse.body[0].id).toBe(testWorkspaceId)
    })
  })

  describe('Collaboration Sessions', () => {
    it('should track active collaboration sessions', async () => {
      const client = Client(`http://localhost:${port}`)

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.emit('join-workflow', {
            workflowId: testWorkflowId,
            userId: testUserId,
            userName: 'Test User 1'
          })
          resolve()
        })
      })

      // Get active sessions
      const sessionsResponse = await request(app)
        .get(`/api/workflows/${testWorkflowId}/sessions`)
        .set('Authorization', authToken)

      expect(sessionsResponse.status).toBe(200)
      expect(sessionsResponse.body).toHaveLength(1)
      expect(sessionsResponse.body[0].userId).toBe(testUserId)

      client.disconnect()
    })
  })

  describe('Error Handling', () => {
    it('should handle unauthorized access to collaboration features', async () => {
      // Try to create comment without auth
      const commentResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/comments`)
        .send({
          content: 'Unauthorized comment'
        })

      expect(commentResponse.status).toBe(401)

      // Try to fork workflow without auth
      const forkResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/fork`)
        .send({
          name: 'Unauthorized fork'
        })

      expect(forkResponse.status).toBe(401)
    })

    it('should handle invalid workflow IDs', async () => {
      const invalidWorkflowId = 'invalid-workflow-id'

      const commentResponse = await request(app)
        .post(`/api/workflows/${invalidWorkflowId}/comments`)
        .set('Authorization', authToken)
        .send({
          content: 'Comment on invalid workflow'
        })

      expect(commentResponse.status).toBe(400)
    })

    it('should handle invalid merge request operations', async () => {
      // Try to create merge request with same source and target
      const mergeRequestResponse = await request(app)
        .post(`/api/workflows/${testWorkflowId}/merge-requests`)
        .set('Authorization', authToken)
        .send({
          targetWorkflowId: testWorkflowId,
          title: 'Invalid Merge Request'
        })

      expect(mergeRequestResponse.status).toBe(400)
    })
  })
})