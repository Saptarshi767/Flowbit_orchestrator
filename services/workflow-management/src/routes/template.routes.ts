import { Router, Request, Response } from 'express'
import { WorkflowTemplateService, CreateTemplateRequest, TemplateSearchOptions } from '../services/workflow-template.service'

export function createTemplateRoutes(templateService: WorkflowTemplateService): Router {
  const router = Router()

  // Create template from workflow
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const template = await templateService.createTemplate(
        req.body as CreateTemplateRequest,
        userId
      )

      res.status(201).json(template)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get template by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const template = await templateService.getTemplate(req.params.id)
      if (!template) {
        return res.status(404).json({ error: 'Template not found' })
      }

      res.json(template)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Search templates
  router.get('/', async (req: Request, res: Response) => {
    try {
      const searchOptions: TemplateSearchOptions = {
        query: req.query.query as string,
        category: req.query.category as string,
        engineType: req.query.engineType as any,
        difficulty: req.query.difficulty as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any
      }

      const result = await templateService.searchTemplates(searchOptions)
      res.json(result)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get popular templates
  router.get('/popular/list', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const templates = await templateService.getPopularTemplates(limit)
      res.json(templates)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get recent templates
  router.get('/recent/list', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const templates = await templateService.getRecentTemplates(limit)
      res.json(templates)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Create workflow from template
  router.post('/:id/create-workflow', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      const organizationId = req.user?.organizationId
      
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { name } = req.body
      if (!name) {
        return res.status(400).json({ error: 'Workflow name is required' })
      }

      const workflow = await templateService.createWorkflowFromTemplate(
        req.params.id,
        name,
        userId,
        organizationId
      )

      res.status(201).json(workflow)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Rate template
  router.post('/:id/rate', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { rating } = req.body
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' })
      }

      await templateService.rateTemplate(req.params.id, rating, userId)
      res.status(204).send()
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  return router
}

export function createTemplateCategoryRoutes(templateService: WorkflowTemplateService): Router {
  const router = Router()

  // Get all categories
  router.get('/', async (req: Request, res: Response) => {
    try {
      const categories = await templateService.getCategories()
      res.json(categories)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get category by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const category = await templateService.getCategory(req.params.id)
      if (!category) {
        return res.status(404).json({ error: 'Category not found' })
      }

      res.json(category)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get templates by category
  router.get('/:id/templates', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20
      const templates = await templateService.getTemplatesByCategory(req.params.id, limit)
      res.json(templates)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  return router
}