import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createCollaborationRoutes } from '../src/routes/collaboration.routes'
import {
  CollaboratorRole,
  WorkspaceRole,
  MergeRequestStatus
} from '../src/types/workflow.types'

// Mock services
const mockWorkflowService = {
  shareWorkflow: vi.fn(),
  getWorkflowCollaborators: vi.fn(),
  updateCollaboratorRole: vi.fn(),
  removeCollaborator: vi.fn(),
  getCollaboratedWorkflows: vi.fn()
}

const mockCollaborationService = {
  getWorkflowSessions: vi.fn(),
  broadcastToWorkflow: vi.fn()
}

const mockCommentRepository = {
  create: vi.fn(),
  findByWorkflowId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
}

const mockForkRepository = {
  forkWorkflow: vi.fn(),
  findForksByOriginalWorkflow: vi.fn(),
  createMergeRequest: vi.fn(),
  findMergeRequestsByWorkflow: vi.fn(),
  updateMergeRequestStatus: vi.fn(),
  mergeBranch: vi.fn()
}

const mockWorkspaceRepository = {
  create: vi.fn(),
  findByUser: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  updateMemberRole: vi.fn(),
  canAccess: vi.fn()
}

describe('Collaboration Routes Tests', () => {
  let app: express.Application

  beforeAll(() => {
    app = express()
    app.use(express.json())

    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'test-user-123',
        organizationId: 'test-org-123',
        email: 'test@example.com',
        role: 'admin'
      }
      next()
    })

    // Add collaboration routes
    app.use('/api/workflows', createCollaborationRoutes(
      mockWorkflowService as any,
      mockCollaborationService as any,
      mockCommentRepository as any,
      mockForkRepository as any,
      mockWorkspaceRepository as any
    ))
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  describe('Comment Routes', () => {
    it('should create a workflow comment', async () => {
      const mockComment = {
        id: 'comment-123',
        workflowId: 'workflow-123',
        userId: 'test-user-123',
        content: 'Test comment',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockCommentRepository.create.mockResolvedValue(mockComment)

      const response = await request(app)
        .post('/api/workflows/workflow-123/comments')
        .send({
          content: 'Test comment'
        })

      expect(response.status).toBe(201)
      expect(response.body.content).toBe('Test comment')
      expect(mockCommentRepository.create).toHaveBeenCalledWith(
        'workflow-123',
        'test-user-123',
        { content: 'Test comment' }
      )
      expect(mockCollaborationService.broadcastToWorkflow).toHaveBeenCalledWith(
        'workflow-123',
        'comment-added',
        mockComment
      )
    })

    it('should get workflow comments', async () => {
      const mockComments = [
        {
          id: 'comment-123',
          workflowId: 'workflow-123',
          userId: 'test-user-123',
          content: 'Test comment',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockCommentRepository.findByWorkflowId.mockResolvedValue(mockComments)

      const response = await request(app)
        .get('/api/workflows/workflow-123/comments')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(1)
      expect(response.body[0].content).toBe('Test comment')
    })

    it('should update a comment', async () => {
      const mockUpdatedComment = {
        id: 'comment-123',
        workflowId: 'workflow-123',
        userId: 'test-user-123',
        content: 'Updated comment',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockCommentRepository.update.mockResolvedValue(mockUpdatedComment)

      const response = await request(app)
        .put('/api/workflows/workflow-123/comments/comment-123')
        .send({
          content: 'Updated comment'
        })

      expect(response.status).toBe(200)
      expect(response.body.content).toBe('Updated comment')
      expect(mockCollaborationService.broadcastToWorkflow).toHaveBeenCalledWith(
        'workflow-123',
        'comment-updated',
        mockUpdatedComment
      )
    })

    it('should delete a comment', async () => {
      mockCommentRepository.delete.mockResolvedValue(undefined)

      const response = await request(app)
        .delete('/api/workflows/workflow-123/comments/comment-123')

      expect(response.status).toBe(204)
      expect(mockCommentRepository.delete).toHaveBeenCalledWith(
        'comment-123',
        'test-user-123'
      )
      expect(mockCollaborationService.broadcastToWorkflow).toHaveBeenCalledWith(
        'workflow-123',
        'comment-deleted',
        { commentId: 'comment-123' }
      )
    })
  })

  describe('Fork and Merge Routes', () => {
    it('should fork a workflow', async () => {
      const mockForkResult = {
        fork: {
          id: 'fork-123',
          originalWorkflowId: 'workflow-123',
          forkedWorkflowId: 'forked-workflow-123',
          userId: 'test-user-123',
          createdAt: new Date()
        },
        workflow: {
          id: 'forked-workflow-123',
          name: 'Forked Workflow',
          description: 'A forked workflow',
          engineType: 'LANGFLOW',
          definition: { nodes: [], edges: [] },
          version: 1,
          visibility: 'PRIVATE',
          tags: [],
          createdBy: 'test-user-123',
          organizationId: 'test-org-123',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }

      mockForkRepository.forkWorkflow.mockResolvedValue(mockForkResult)

      const response = await request(app)
        .post('/api/workflows/workflow-123/fork')
        .send({
          name: 'Forked Workflow',
          description: 'A forked workflow'
        })

      expect(response.status).toBe(201)
      expect(response.body.fork.originalWorkflowId).toBe('workflow-123')
      expect(response.body.workflow.name).toBe('Forked Workflow')
    })

    it('should get workflow forks', async () => {
      const mockForks = [
        {
          id: 'fork-123',
          originalWorkflowId: 'workflow-123',
          forkedWorkflowId: 'forked-workflow-123',
          userId: 'test-user-123',
          createdAt: new Date()
        }
      ]

      mockForkRepository.findForksByOriginalWorkflow.mockResolvedValue(mockForks)

      const response = await request(app)
        .get('/api/workflows/workflow-123/forks')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(1)
      expect(response.body[0].originalWorkflowId).toBe('workflow-123')
    })

    it('should create a merge request', async () => {
      const mockMergeRequest = {
        id: 'merge-123',
        sourceWorkflowId: 'source-workflow-123',
        targetWorkflowId: 'target-workflow-123',
        title: 'Test Merge Request',
        description: 'Testing merge functionality',
        status: MergeRequestStatus.OPEN,
        createdBy: 'test-user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockForkRepository.createMergeRequest.mockResolvedValue(mockMergeRequest)

      const response = await request(app)
        .post('/api/workflows/source-workflow-123/merge-requests')
        .send({
          targetWorkflowId: 'target-workflow-123',
          title: 'Test Merge Request',
          description: 'Testing merge functionality'
        })

      expect(response.status).toBe(201)
      expect(response.body.title).toBe('Test Merge Request')
      expect(response.body.status).toBe(MergeRequestStatus.OPEN)
    })

    it('should update merge request status', async () => {
      const mockUpdatedMergeRequest = {
        id: 'merge-123',
        sourceWorkflowId: 'source-workflow-123',
        targetWorkflowId: 'target-workflow-123',
        title: 'Test Merge Request',
        description: 'Testing merge functionality',
        status: MergeRequestStatus.MERGED,
        createdBy: 'test-user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockForkRepository.updateMergeRequestStatus.mockResolvedValue(mockUpdatedMergeRequest)

      const response = await request(app)
        .put('/api/workflows/merge-requests/merge-123/status')
        .send({
          status: MergeRequestStatus.MERGED
        })

      expect(response.status).toBe(200)
      expect(response.body.status).toBe(MergeRequestStatus.MERGED)
    })

    it('should merge a merge request', async () => {
      mockForkRepository.mergeBranch.mockResolvedValue(undefined)

      const response = await request(app)
        .post('/api/workflows/merge-requests/merge-123/merge')

      expect(response.status).toBe(204)
      expect(mockForkRepository.mergeBranch).toHaveBeenCalledWith(
        'merge-123',
        'test-user-123'
      )
    })
  })

  describe('Workspace Routes', () => {
    it('should create a team workspace', async () => {
      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        description: 'A test workspace',
        organizationId: 'test-org-123',
        createdBy: 'test-user-123',
        members: [
          {
            id: 'member-123',
            workspaceId: 'workspace-123',
            userId: 'test-user-123',
            role: WorkspaceRole.ADMIN,
            createdAt: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace)

      const response = await request(app)
        .post('/api/workflows/workspaces')
        .send({
          name: 'Test Workspace',
          description: 'A test workspace'
        })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('Test Workspace')
      expect(response.body.members).toHaveLength(1)
      expect(response.body.members[0].role).toBe(WorkspaceRole.ADMIN)
    })

    it('should get user workspaces', async () => {
      const mockWorkspaces = [
        {
          id: 'workspace-123',
          name: 'Test Workspace',
          description: 'A test workspace',
          organizationId: 'test-org-123',
          createdBy: 'test-user-123',
          members: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockWorkspaceRepository.findByUser.mockResolvedValue(mockWorkspaces)

      const response = await request(app)
        .get('/api/workflows/workspaces')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(1)
      expect(response.body[0].name).toBe('Test Workspace')
    })

    it('should get workspace by ID', async () => {
      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        description: 'A test workspace',
        organizationId: 'test-org-123',
        createdBy: 'test-user-123',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockWorkspaceRepository.canAccess.mockResolvedValue(true)
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace)

      const response = await request(app)
        .get('/api/workflows/workspaces/workspace-123')

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Test Workspace')
    })

    it('should add member to workspace', async () => {
      const mockMember = {
        id: 'member-123',
        workspaceId: 'workspace-123',
        userId: 'new-user-123',
        role: WorkspaceRole.MEMBER,
        createdAt: new Date()
      }

      mockWorkspaceRepository.addMember.mockResolvedValue(mockMember)

      const response = await request(app)
        .post('/api/workflows/workspaces/workspace-123/members')
        .send({
          userId: 'new-user-123',
          role: WorkspaceRole.MEMBER
        })

      expect(response.status).toBe(201)
      expect(response.body.userId).toBe('new-user-123')
      expect(response.body.role).toBe(WorkspaceRole.MEMBER)
    })
  })

  describe('Session Routes', () => {
    it('should get active collaboration sessions', async () => {
      const mockSessions = [
        {
          id: 'session-123',
          workflowId: 'workflow-123',
          userId: 'test-user-123',
          socketId: 'socket-123',
          lastActivity: new Date()
        }
      ]

      mockCollaborationService.getWorkflowSessions.mockReturnValue(mockSessions)

      const response = await request(app)
        .get('/api/workflows/workflow-123/sessions')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(1)
      expect(response.body[0].userId).toBe('test-user-123')
    })
  })

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const appWithoutAuth = express()
      appWithoutAuth.use(express.json())
      appWithoutAuth.use('/api/workflows', createCollaborationRoutes(
        mockWorkflowService as any,
        mockCollaborationService as any,
        mockCommentRepository as any,
        mockForkRepository as any,
        mockWorkspaceRepository as any
      ))

      const response = await request(appWithoutAuth)
        .post('/api/workflows/workflow-123/comments')
        .send({
          content: 'Test comment'
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Authentication required')
    })

    it('should handle service errors', async () => {
      mockCommentRepository.create.mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/api/workflows/workflow-123/comments')
        .send({
          content: 'Test comment'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Database error')
    })

    it('should validate merge request status', async () => {
      const response = await request(app)
        .put('/api/workflows/merge-requests/merge-123/status')
        .send({
          status: 'INVALID_STATUS'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid status')
    })

    it('should validate workspace role', async () => {
      const response = await request(app)
        .put('/api/workflows/workspaces/workspace-123/members/user-123/role')
        .send({
          role: 'INVALID_ROLE'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid role')
    })
  })
})