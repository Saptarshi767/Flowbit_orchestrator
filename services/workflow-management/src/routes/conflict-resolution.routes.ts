import { Router, Request, Response } from 'express'
import { ConflictResolutionService, MergeStrategy } from '../services/conflict-resolution.service'
import { WorkflowService } from '../services/workflow.service'

export function createConflictResolutionRoutes(
  conflictService: ConflictResolutionService,
  workflowService: WorkflowService
): Router {
  const router = Router()

  // Get conflicts for a workflow
  router.get('/:workflowId/conflicts', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // Check if user has access to the workflow
      const hasAccess = await workflowService['workflowRepository'].hasAccess(
        req.params.workflowId,
        userId,
        'read'
      )
      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      const conflicts = conflictService.getWorkflowConflicts(req.params.workflowId)
      res.json(conflicts)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get specific conflict
  router.get('/conflicts/:conflictId', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const conflict = conflictService.getConflict(req.params.conflictId)
      if (!conflict) {
        return res.status(404).json({ error: 'Conflict not found' })
      }

      // Check if user has access to the workflow
      const hasAccess = await workflowService['workflowRepository'].hasAccess(
        conflict.workflowId,
        userId,
        'read'
      )
      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      res.json(conflict)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Attempt automatic merge
  router.post('/:workflowId/merge', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // Check if user has write access to the workflow
      const canWrite = await workflowService['workflowRepository'].hasAccess(
        req.params.workflowId,
        userId,
        'write'
      )
      if (!canWrite) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      const { baseVersion, version1, version2, strategy } = req.body

      // Get workflow versions
      const baseVersionData = await workflowService.getWorkflowVersion(
        req.params.workflowId,
        baseVersion,
        userId
      )
      const version1Data = await workflowService.getWorkflowVersion(
        req.params.workflowId,
        version1,
        userId
      )
      const version2Data = await workflowService.getWorkflowVersion(
        req.params.workflowId,
        version2,
        userId
      )

      if (!baseVersionData || !version1Data || !version2Data) {
        return res.status(404).json({ error: 'One or more versions not found' })
      }

      const mergeStrategy: MergeStrategy = strategy || { strategy: 'auto' }
      const mergeResult = conflictService.attemptAutoMerge(
        baseVersionData.definition,
        version1Data.definition,
        version2Data.definition,
        mergeStrategy
      )

      if (mergeResult.success) {
        // Create new version with merged definition
        const newVersion = await workflowService.createWorkflowVersion(
          req.params.workflowId,
          {
            definition: mergeResult.mergedDefinition!,
            changeLog: `Merged versions ${version1} and ${version2}`
          },
          userId
        )

        res.json({ success: true, version: newVersion })
      } else {
        res.json({ success: false, conflicts: mergeResult.conflicts })
      }
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Resolve conflict manually
  router.post('/conflicts/:conflictId/resolve', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const conflict = conflictService.getConflict(req.params.conflictId)
      if (!conflict) {
        return res.status(404).json({ error: 'Conflict not found' })
      }

      // Check if user has write access to the workflow
      const canWrite = await workflowService['workflowRepository'].hasAccess(
        conflict.workflowId,
        userId,
        'write'
      )
      if (!canWrite) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      const { resolvedDefinition } = req.body
      if (!resolvedDefinition) {
        return res.status(400).json({ error: 'Resolved definition is required' })
      }

      const resolvedConflict = conflictService.resolveConflictManually(
        req.params.conflictId,
        resolvedDefinition,
        userId
      )

      // Create new version with resolved definition
      const newVersion = await workflowService.createWorkflowVersion(
        conflict.workflowId,
        {
          definition: resolvedDefinition,
          changeLog: `Manually resolved conflict ${req.params.conflictId}`
        },
        userId
      )

      res.json({ conflict: resolvedConflict, version: newVersion })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Compare workflow versions for conflicts
  router.post('/:workflowId/compare-versions', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // Check if user has access to the workflow
      const hasAccess = await workflowService['workflowRepository'].hasAccess(
        req.params.workflowId,
        userId,
        'read'
      )
      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      const { baseVersion, version1, version2 } = req.body

      // Get workflow versions
      const baseVersionData = await workflowService.getWorkflowVersion(
        req.params.workflowId,
        baseVersion,
        userId
      )
      const version1Data = await workflowService.getWorkflowVersion(
        req.params.workflowId,
        version1,
        userId
      )
      const version2Data = await workflowService.getWorkflowVersion(
        req.params.workflowId,
        version2,
        userId
      )

      if (!baseVersionData || !version1Data || !version2Data) {
        return res.status(404).json({ error: 'One or more versions not found' })
      }

      const conflict = conflictService.detectConflicts(
        baseVersionData,
        version1Data,
        version2Data
      )

      if (conflict) {
        res.json({ hasConflicts: true, conflict })
      } else {
        res.json({ hasConflicts: false })
      }
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  return router
}