import { Router, Request, Response } from 'express'
import { WorkflowService } from '../services/workflow.service'
import { CollaborationService } from '../services/collaboration.service'
import { WorkflowCommentRepository } from '../repositories/workflow-comment.repository'
import { WorkflowForkRepository } from '../repositories/workflow-fork.repository'
import { TeamWorkspaceRepository } from '../repositories/team-workspace.repository'
import {
  ShareWorkflowRequest,
  CollaboratorRole,
  CreateCommentRequest,
  UpdateCommentRequest,
  ForkWorkflowRequest,
  CreateMergeRequest,
  MergeRequestStatus,
  CreateWorkspaceRequest,
  AddWorkspaceMemberRequest,
  WorkspaceRole
} from '../types/workflow.types'

export function createCollaborationRoutes(
  workflowService: WorkflowService,
  collaborationService: CollaborationService,
  commentRepository: WorkflowCommentRepository,
  forkRepository: WorkflowForkRepository,
  workspaceRepository: TeamWorkspaceRepository
): Router {
  const router = Router()

  // ===== EXISTING COLLABORATOR ROUTES =====

  // Share workflow with user
  router.post('/:workflowId/collaborators', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const collaborator = await workflowService.shareWorkflow(
        req.params.workflowId,
        req.body as ShareWorkflowRequest,
        userId
      )

      res.status(201).json(collaborator)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get workflow collaborators
  router.get('/:workflowId/collaborators', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const collaborators = await workflowService.getWorkflowCollaborators(
        req.params.workflowId,
        userId
      )

      res.json(collaborators)
    } catch (error) {
      res.status(403).json({ error: error.message })
    }
  })

  // Update collaborator role
  router.put('/:workflowId/collaborators/:collaboratorUserId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { role } = req.body
      if (!Object.values(CollaboratorRole).includes(role)) {
        return res.status(400).json({ error: 'Invalid role' })
      }

      const collaborator = await workflowService.updateCollaboratorRole(
        req.params.workflowId,
        req.params.collaboratorUserId,
        role,
        userId
      )

      res.json(collaborator)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Remove collaborator
  router.delete('/:workflowId/collaborators/:collaboratorUserId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      await workflowService.removeCollaborator(
        req.params.workflowId,
        req.params.collaboratorUserId,
        userId
      )

      res.status(204).send()
    } catch (error) {
      res.status(403).json({ error: error.message })
    }
  })

  // Get workflows where user is a collaborator
  router.get('/user/collaborations', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const collaborations = await workflowService.getCollaboratedWorkflows(userId)
      res.json(collaborations)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // ===== REAL-TIME COLLABORATION ROUTES =====

  // Get active collaboration sessions for a workflow
  router.get('/:workflowId/sessions', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const sessions = collaborationService.getWorkflowSessions(req.params.workflowId)
      res.json(sessions)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // ===== COMMENT ROUTES =====

  // Create a comment on a workflow
  router.post('/:workflowId/comments', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const comment = await commentRepository.create(
        req.params.workflowId,
        userId,
        req.body as CreateCommentRequest
      )

      // Broadcast comment to active collaborators
      collaborationService.broadcastToWorkflow(req.params.workflowId, 'comment-added', comment)

      res.status(201).json(comment)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get comments for a workflow
  router.get('/:workflowId/comments', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const comments = await commentRepository.findByWorkflowId(req.params.workflowId)
      res.json(comments)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Update a comment
  router.put('/:workflowId/comments/:commentId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const comment = await commentRepository.update(
        req.params.commentId,
        userId,
        req.body as UpdateCommentRequest
      )

      // Broadcast comment update to active collaborators
      collaborationService.broadcastToWorkflow(req.params.workflowId, 'comment-updated', comment)

      res.json(comment)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Delete a comment
  router.delete('/:workflowId/comments/:commentId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      await commentRepository.delete(req.params.commentId, userId)

      // Broadcast comment deletion to active collaborators
      collaborationService.broadcastToWorkflow(req.params.workflowId, 'comment-deleted', {
        commentId: req.params.commentId
      })

      res.status(204).send()
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // ===== FORK AND MERGE ROUTES =====

  // Fork a workflow
  router.post('/:workflowId/fork', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const result = await forkRepository.forkWorkflow(
        req.params.workflowId,
        userId,
        req.body as ForkWorkflowRequest
      )

      res.status(201).json(result)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get forks of a workflow
  router.get('/:workflowId/forks', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const forks = await forkRepository.findForksByOriginalWorkflow(req.params.workflowId)
      res.json(forks)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Create a merge request
  router.post('/:workflowId/merge-requests', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const mergeRequest = await forkRepository.createMergeRequest(
        req.params.workflowId,
        userId,
        req.body as CreateMergeRequest
      )

      res.status(201).json(mergeRequest)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get merge requests for a workflow
  router.get('/:workflowId/merge-requests', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const mergeRequests = await forkRepository.findMergeRequestsByWorkflow(req.params.workflowId)
      res.json(mergeRequests)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Update merge request status
  router.put('/merge-requests/:mergeRequestId/status', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { status } = req.body
      if (!Object.values(MergeRequestStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }

      const mergeRequest = await forkRepository.updateMergeRequestStatus(
        req.params.mergeRequestId,
        status,
        userId
      )

      res.json(mergeRequest)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Merge a merge request
  router.post('/merge-requests/:mergeRequestId/merge', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      await forkRepository.mergeBranch(req.params.mergeRequestId, userId)
      res.status(204).send()
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // ===== TEAM WORKSPACE ROUTES =====

  // Create a team workspace
  router.post('/workspaces', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      const organizationId = req.user?.organizationId
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const workspace = await workspaceRepository.create(
        userId,
        organizationId,
        req.body as CreateWorkspaceRequest
      )

      res.status(201).json(workspace)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get user's workspaces
  router.get('/workspaces', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const workspaces = await workspaceRepository.findByUser(userId)
      res.json(workspaces)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get workspace by ID
  router.get('/workspaces/:workspaceId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const canAccess = await workspaceRepository.canAccess(req.params.workspaceId, userId)
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const workspace = await workspaceRepository.findById(req.params.workspaceId)
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' })
      }

      res.json(workspace)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Update workspace
  router.put('/workspaces/:workspaceId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const workspace = await workspaceRepository.update(
        req.params.workspaceId,
        userId,
        req.body as Partial<CreateWorkspaceRequest>
      )

      res.json(workspace)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Delete workspace
  router.delete('/workspaces/:workspaceId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      await workspaceRepository.delete(req.params.workspaceId, userId)
      res.status(204).send()
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Add member to workspace
  router.post('/workspaces/:workspaceId/members', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const member = await workspaceRepository.addMember(
        req.params.workspaceId,
        userId,
        req.body as AddWorkspaceMemberRequest
      )

      res.status(201).json(member)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Remove member from workspace
  router.delete('/workspaces/:workspaceId/members/:memberUserId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      await workspaceRepository.removeMember(
        req.params.workspaceId,
        req.params.memberUserId,
        userId
      )

      res.status(204).send()
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Update member role
  router.put('/workspaces/:workspaceId/members/:memberUserId/role', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { role } = req.body
      if (!Object.values(WorkspaceRole).includes(role)) {
        return res.status(400).json({ error: 'Invalid role' })
      }

      const member = await workspaceRepository.updateMemberRole(
        req.params.workspaceId,
        req.params.memberUserId,
        role,
        userId
      )

      res.json(member)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  return router
}