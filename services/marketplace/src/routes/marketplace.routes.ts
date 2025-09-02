import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { MarketplaceService } from '../services/marketplace.service';
import { WorkflowCategory, WorkflowSortBy } from '../types/marketplace.types';
import { EngineType } from '@robust-ai-orchestrator/shared';

export function createMarketplaceRoutes(marketplaceService: MarketplaceService): Router {
  const router = Router();

  // Validation middleware
  const handleValidationErrors = (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: errors.array()
        }
      });
    }
    next();
  };

  // Publish workflow to marketplace
  router.post('/workflows',
    [
      body('workflowId').isUUID().withMessage('Valid workflow ID is required'),
      body('name').isLength({ min: 1, max: 255 }).withMessage('Name is required and must be less than 255 characters'),
      body('description').isLength({ min: 1, max: 2000 }).withMessage('Description is required and must be less than 2000 characters'),
      body('engineType').isIn(Object.values(EngineType)).withMessage('Valid engine type is required'),
      body('category').isIn(Object.values(WorkflowCategory)).withMessage('Valid category is required'),
      body('tags').isArray().withMessage('Tags must be an array'),
      body('isPublic').isBoolean().withMessage('isPublic must be a boolean'),
      body('isPremium').optional().isBoolean().withMessage('isPremium must be a boolean'),
      body('price').optional().isNumeric().withMessage('Price must be a number'),
      body('metadata').isObject().withMessage('Metadata must be an object'),
      body('metadata.author').isLength({ min: 1 }).withMessage('Author is required in metadata'),
      body('metadata.license').isLength({ min: 1 }).withMessage('License is required in metadata')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id; // Assuming auth middleware sets req.user
        const organizationId = req.user?.organizationId;
        
        if (!userId || !organizationId) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
        }

        const workflow = await marketplaceService.publishWorkflow(req.body, userId, organizationId);
        
        res.status(201).json({
          success: true,
          data: workflow
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code || 'PUBLISH_ERROR',
            message: error.message || 'Failed to publish workflow'
          }
        });
      }
    }
  );

  // Search workflows
  router.get('/workflows/search',
    [
      query('query').optional().isString().withMessage('Query must be a string'),
      query('category').optional().isIn(Object.values(WorkflowCategory)).withMessage('Invalid category'),
      query('engineType').optional().isIn(Object.values(EngineType)).withMessage('Invalid engine type'),
      query('isPremium').optional().isBoolean().withMessage('isPremium must be a boolean'),
      query('minRating').optional().isFloat({ min: 1, max: 5 }).withMessage('minRating must be between 1 and 5'),
      query('sortBy').optional().isIn(Object.values(WorkflowSortBy)).withMessage('Invalid sortBy value'),
      query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const searchRequest = {
          query: req.query.query,
          category: req.query.category,
          tags: req.query.tags ? req.query.tags.split(',') : undefined,
          engineType: req.query.engineType,
          isPremium: req.query.isPremium === 'true' ? true : req.query.isPremium === 'false' ? false : undefined,
          minRating: req.query.minRating ? parseFloat(req.query.minRating) : undefined,
          sortBy: req.query.sortBy,
          sortOrder: req.query.sortOrder,
          limit: req.query.limit ? parseInt(req.query.limit) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset) : undefined
        };

        const result = await marketplaceService.searchWorkflows(searchRequest);
        
        res.json({
          success: true,
          data: result
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SEARCH_ERROR',
            message: error.message || 'Failed to search workflows'
          }
        });
      }
    }
  );

  // Get workflow by ID
  router.get('/workflows/:id',
    [
      param('id').isUUID().withMessage('Valid workflow ID is required')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const workflow = await marketplaceService.getWorkflowById(req.params.id);
        
        if (!workflow) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'WORKFLOW_NOT_FOUND',
              message: 'Workflow not found'
            }
          });
        }
        
        res.json({
          success: true,
          data: workflow
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: {
            code: 'GET_WORKFLOW_ERROR',
            message: error.message || 'Failed to get workflow'
          }
        });
      }
    }
  );

  // Update marketplace workflow
  router.put('/workflows/:id',
    [
      param('id').isUUID().withMessage('Valid workflow ID is required'),
      body('name').optional().isLength({ min: 1, max: 255 }).withMessage('Name must be less than 255 characters'),
      body('description').optional().isLength({ min: 1, max: 2000 }).withMessage('Description must be less than 2000 characters'),
      body('category').optional().isIn(Object.values(WorkflowCategory)).withMessage('Valid category is required'),
      body('tags').optional().isArray().withMessage('Tags must be an array'),
      body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
      body('isPremium').optional().isBoolean().withMessage('isPremium must be a boolean'),
      body('price').optional().isNumeric().withMessage('Price must be a number')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
        }

        const workflow = await marketplaceService.updateMarketplaceWorkflow(req.params.id, req.body, userId);
        
        res.json({
          success: true,
          data: workflow
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code || 'UPDATE_ERROR',
            message: error.message || 'Failed to update workflow'
          }
        });
      }
    }
  );

  // Unpublish workflow
  router.delete('/workflows/:id',
    [
      param('id').isUUID().withMessage('Valid workflow ID is required')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
        }

        const success = await marketplaceService.unpublishWorkflow(req.params.id, userId);
        
        res.json({
          success: true,
          data: { deleted: success }
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code || 'DELETE_ERROR',
            message: error.message || 'Failed to unpublish workflow'
          }
        });
      }
    }
  );

  // Get trending workflows
  router.get('/workflows/trending',
    [
      query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const workflows = await marketplaceService.getTrendingWorkflows(limit);
        
        res.json({
          success: true,
          data: workflows
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: {
            code: 'TRENDING_ERROR',
            message: error.message || 'Failed to get trending workflows'
          }
        });
      }
    }
  );

  // Get popular workflows
  router.get('/workflows/popular',
    [
      query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const workflows = await marketplaceService.getPopularWorkflows(limit);
        
        res.json({
          success: true,
          data: workflows
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: {
            code: 'POPULAR_ERROR',
            message: error.message || 'Failed to get popular workflows'
          }
        });
      }
    }
  );

  // Rate workflow
  router.post('/workflows/:id/ratings',
    [
      param('id').isUUID().withMessage('Valid workflow ID is required'),
      body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
      body('review').optional().isLength({ max: 1000 }).withMessage('Review must be less than 1000 characters')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
        }

        const rating = await marketplaceService.rateWorkflow(req.params.id, req.body, userId);
        
        res.status(201).json({
          success: true,
          data: rating
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code || 'RATING_ERROR',
            message: error.message || 'Failed to rate workflow'
          }
        });
      }
    }
  );

  // Get workflow ratings
  router.get('/workflows/:id/ratings',
    [
      param('id').isUUID().withMessage('Valid workflow ID is required'),
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        
        const ratings = await marketplaceService.getWorkflowRatings(req.params.id, limit, offset);
        
        res.json({
          success: true,
          data: ratings
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: {
            code: 'GET_RATINGS_ERROR',
            message: error.message || 'Failed to get workflow ratings'
          }
        });
      }
    }
  );

  // Download workflow
  router.post('/workflows/:id/download',
    [
      param('id').isUUID().withMessage('Valid workflow ID is required'),
      body('version').optional().isString().withMessage('Version must be a string')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
        }

        const version = req.body.version || '1.0.0';
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');

        await marketplaceService.downloadWorkflow(req.params.id, userId, version, ipAddress, userAgent);
        
        res.json({
          success: true,
          data: { message: 'Download tracked successfully' }
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code || 'DOWNLOAD_ERROR',
            message: error.message || 'Failed to download workflow'
          }
        });
      }
    }
  );

  // Get recommendations
  router.get('/recommendations',
    [
      query('workflowId').optional().isUUID().withMessage('workflowId must be a valid UUID'),
      query('category').optional().isIn(Object.values(WorkflowCategory)).withMessage('Invalid category'),
      query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id;
        
        const request = {
          userId,
          workflowId: req.query.workflowId,
          category: req.query.category,
          tags: req.query.tags ? req.query.tags.split(',') : undefined,
          limit: req.query.limit ? parseInt(req.query.limit) : 10
        };

        const recommendations = await marketplaceService.getRecommendations(request);
        
        res.json({
          success: true,
          data: recommendations
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: {
            code: 'RECOMMENDATIONS_ERROR',
            message: error.message || 'Failed to get recommendations'
          }
        });
      }
    }
  );

  // Get marketplace statistics
  router.get('/stats',
    async (req: any, res: any) => {
      try {
        const stats = await marketplaceService.getMarketplaceStats();
        
        res.json({
          success: true,
          data: stats
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: {
            code: 'STATS_ERROR',
            message: error.message || 'Failed to get marketplace statistics'
          }
        });
      }
    }
  );

  return router;
}