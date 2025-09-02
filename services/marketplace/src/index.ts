import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { createClient } from 'redis';
import winston from 'winston';
import dotenv from 'dotenv';

// Import services and repositories
import { MarketplaceService } from './services/marketplace.service';
import { CollectionService } from './services/collection.service';
import { MarketplaceWorkflowRepository } from './repositories/marketplace-workflow.repository';
import { WorkflowRatingRepository } from './repositories/workflow-rating.repository';
import { WorkflowDownloadRepository } from './repositories/workflow-download.repository';
import { WorkflowCollectionRepository } from './repositories/workflow-collection.repository';
import { RecommendationRepository } from './repositories/recommendation.repository';
import { createMarketplaceRoutes } from './routes/marketplace.routes';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/marketplace-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/marketplace.log' })
  ]
});

class MarketplaceServer {
  private app: express.Application;
  private pool: Pool;
  private redisClient: any;
  private marketplaceService: MarketplaceService;
  private collectionService: CollectionService;

  constructor() {
    this.app = express();
    this.setupDatabase();
    this.setupRedis();
    this.setupMiddleware();
    this.setupServices();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupDatabase(): void {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'marketplace',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_POOL_SIZE || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  private setupRedis(): void {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.redisClient.on('error', (err: Error) => {
      logger.error('Redis Client Error', err);
    });

    this.redisClient.connect();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.'
        }
      }
    });
    this.app.use(limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id
      });
      next();
    });

    // Mock authentication middleware for development
    // In production, this would be replaced with proper JWT validation
    this.app.use((req: any, res, next) => {
      // Mock user for development - replace with actual auth middleware
      if (process.env.NODE_ENV === 'development') {
        req.user = {
          id: req.headers['x-user-id'] || 'dev-user-1',
          organizationId: req.headers['x-org-id'] || 'dev-org-1',
          email: 'dev@example.com',
          name: 'Development User'
        };
      }
      next();
    });
  }

  private setupServices(): void {
    // Initialize repositories
    const marketplaceWorkflowRepo = new MarketplaceWorkflowRepository(this.pool);
    const ratingRepo = new WorkflowRatingRepository(this.pool);
    const downloadRepo = new WorkflowDownloadRepository(this.pool);
    const collectionRepo = new WorkflowCollectionRepository(this.pool);
    const recommendationRepo = new RecommendationRepository(this.pool);

    // Initialize services
    this.marketplaceService = new MarketplaceService(
      marketplaceWorkflowRepo,
      ratingRepo,
      downloadRepo,
      recommendationRepo
    );

    this.collectionService = new CollectionService(collectionRepo);
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          service: 'marketplace',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0'
        }
      });
    });

    // API routes
    this.app.use('/api/v1/marketplace', createMarketplaceRoutes(this.marketplaceService));

    // Collection routes (could be separated into its own router)
    this.app.use('/api/v1/collections', this.createCollectionRoutes());

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      });
    });
  }

  private createCollectionRoutes(): express.Router {
    const router = express.Router();

    // Create collection
    router.post('/', async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
          });
        }

        const collection = await this.collectionService.createCollection(req.body, userId);
        res.status(201).json({ success: true, data: collection });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: { code: error.code || 'CREATE_ERROR', message: error.message }
        });
      }
    });

    // Get user collections
    router.get('/my', async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
          });
        }

        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        
        const collections = await this.collectionService.getUserCollections(userId, limit, offset);
        res.json({ success: true, data: collections });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: { code: 'GET_ERROR', message: error.message }
        });
      }
    });

    // Get public collections
    router.get('/public', async (req: any, res) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        
        const collections = await this.collectionService.getPublicCollections(limit, offset);
        res.json({ success: true, data: collections });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: { code: 'GET_ERROR', message: error.message }
        });
      }
    });

    return router;
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: process.env.NODE_ENV === 'production' 
            ? 'An internal server error occurred' 
            : error.message
        }
      });
    });
  }

  public async start(): Promise<void> {
    const port = process.env.PORT || 3003;
    
    try {
      // Test database connection
      await this.pool.query('SELECT 1');
      logger.info('Database connection established');

      // Test Redis connection
      await this.redisClient.ping();
      logger.info('Redis connection established');

      this.app.listen(port, () => {
        logger.info(`Marketplace service started on port ${port}`);
      });
    } catch (error) {
      logger.error('Failed to start marketplace service:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('Shutting down marketplace service...');
    
    try {
      await this.pool.end();
      await this.redisClient.quit();
      logger.info('Marketplace service shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Start the server
const server = new MarketplaceServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

// Start the server
server.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default server;