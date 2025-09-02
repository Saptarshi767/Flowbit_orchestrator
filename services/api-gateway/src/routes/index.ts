import { Router, Request, Response } from 'express';
import { ApiResponse } from '@robust-ai-orchestrator/shared';
import { authenticateToken, authorizePermission } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimiter';
import { validateApiKey } from '../middleware/security';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Health check endpoint (no authentication required)
router.get('/health', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime()
    },
    meta: {
      correlationId: req.correlationId || '',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  };
  res.json(response);
});

// API version endpoint
router.get('/version', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      version: '1.0.0',
      apiVersion: 'v1',
      buildDate: new Date().toISOString()
    },
    meta: {
      correlationId: req.correlationId || '',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  };
  res.json(response);
});

// Protected route example
router.get('/protected', 
  apiRateLimit,
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: {
        message: 'This is a protected route',
        user: {
          id: req.user?.userId,
          email: req.user?.email,
          role: req.user?.role
        }
      },
      meta: {
        correlationId: req.correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.json(response);
  })
);

// Admin only route example
router.get('/admin',
  apiRateLimit,
  authenticateToken,
  authorizePermission('admin', 'read'),
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: {
        message: 'This is an admin-only route',
        adminData: 'Sensitive admin information'
      },
      meta: {
        correlationId: req.correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.json(response);
  })
);

// Service-to-service route example
router.get('/internal/status',
  validateApiKey,
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Internal service status',
        services: {
          database: 'healthy',
          redis: 'healthy',
          elasticsearch: 'healthy'
        }
      },
      meta: {
        correlationId: req.correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.json(response);
  })
);

export default router;