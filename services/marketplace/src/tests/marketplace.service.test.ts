import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { MarketplaceService } from '../services/marketplace.service';
import { 
  MarketplaceWorkflow, 
  WorkflowCategory, 
  WorkflowSortBy,
  MarketplaceErrorCode,
  RecommendationReason
} from '../types/marketplace.types';
import { EngineType } from '@robust-ai-orchestrator/shared';

// Mock repositories
const mockMarketplaceWorkflowRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByWorkflowId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  search: vi.fn(),
  findByCategory: vi.fn(),
  findByTags: vi.fn(),
  findTrending: vi.fn(),
  findPopular: vi.fn(),
  getStats: vi.fn(),
  incrementDownloadCount: vi.fn(),
  updateRating: vi.fn()
};

const mockRatingRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByWorkflowId: vi.fn(),
  findByUserId: vi.fn(),
  findByUserAndWorkflow: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getAverageRating: vi.fn(),
  getRatingDistribution: vi.fn()
};

const mockDownloadRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByWorkflowId: vi.fn(),
  findByUserId: vi.fn(),
  getDownloadCount: vi.fn(),
  getDownloadStats: vi.fn()
};

const mockRecommendationRepo = {
  getRecommendations: vi.fn(),
  getSimilarWorkflows: vi.fn(),
  getTrendingInCategory: vi.fn(),
  getPopularInOrganization: vi.fn(),
  trackUserInteraction: vi.fn(),
  getUserInteractionHistory: vi.fn()
};

describe('MarketplaceService', () => {
  let marketplaceService: MarketplaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    marketplaceService = new MarketplaceService(
      mockMarketplaceWorkflowRepo as any,
      mockRatingRepo as any,
      mockDownloadRepo as any,
      mockRecommendationRepo as any
    );
  });

  describe('publishWorkflow', () => {
    const publishRequest = {
      workflowId: 'workflow-123',
      name: 'Test Workflow',
      description: 'A test workflow',
      engineType: EngineType.LANGFLOW,
      category: WorkflowCategory.AI_ML,
      tags: ['test', 'ai'],
      isPublic: true,
      isPremium: false,
      metadata: {
        author: 'Test Author',
        license: 'MIT',
        compatibility: {
          engineType: EngineType.LANGFLOW,
          minVersion: '1.0.0'
        }
      }
    };

    it('should publish a new workflow successfully', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';
      const expectedWorkflow: MarketplaceWorkflow = {
        id: 'marketplace-123',
        workflowId: publishRequest.workflowId,
        name: publishRequest.name,
        description: publishRequest.description,
        engineType: publishRequest.engineType,
        category: publishRequest.category,
        tags: publishRequest.tags,
        publishedBy: userId,
        organizationId,
        version: '1.0.0',
        isPublic: publishRequest.isPublic,
        isPremium: publishRequest.isPremium,
        downloadCount: 0,
        averageRating: 0,
        totalRatings: 0,
        publishedAt: new Date(),
        updatedAt: new Date(),
        metadata: publishRequest.metadata
      };

      mockMarketplaceWorkflowRepo.findByWorkflowId.mockResolvedValue(null);
      mockMarketplaceWorkflowRepo.create.mockResolvedValue(expectedWorkflow);

      const result = await marketplaceService.publishWorkflow(publishRequest, userId, organizationId);

      expect(mockMarketplaceWorkflowRepo.findByWorkflowId).toHaveBeenCalledWith(publishRequest.workflowId);
      expect(mockMarketplaceWorkflowRepo.create).toHaveBeenCalledWith({
        workflowId: publishRequest.workflowId,
        name: publishRequest.name,
        description: publishRequest.description,
        engineType: publishRequest.engineType,
        category: publishRequest.category,
        tags: publishRequest.tags,
        publishedBy: userId,
        organizationId,
        version: '1.0.0',
        isPublic: publishRequest.isPublic,
        isPremium: false,
        price: undefined,
        downloadCount: 0,
        averageRating: 0,
        totalRatings: 0,
        metadata: publishRequest.metadata
      });
      expect(result).toEqual(expectedWorkflow);
    });

    it('should throw error if workflow is already published', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';
      const existingWorkflow = { id: 'existing-123' };

      mockMarketplaceWorkflowRepo.findByWorkflowId.mockResolvedValue(existingWorkflow);

      await expect(
        marketplaceService.publishWorkflow(publishRequest, userId, organizationId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.WORKFLOW_ALREADY_PUBLISHED,
        message: 'Workflow is already published in marketplace'
      });

      expect(mockMarketplaceWorkflowRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('updateMarketplaceWorkflow', () => {
    it('should update workflow successfully', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const updateRequest = {
        name: 'Updated Workflow',
        description: 'Updated description'
      };
      const existingWorkflow = {
        id: workflowId,
        publishedBy: userId,
        name: 'Original Workflow'
      };
      const updatedWorkflow = {
        ...existingWorkflow,
        ...updateRequest
      };

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(existingWorkflow);
      mockMarketplaceWorkflowRepo.update.mockResolvedValue(updatedWorkflow);

      const result = await marketplaceService.updateMarketplaceWorkflow(workflowId, updateRequest, userId);

      expect(mockMarketplaceWorkflowRepo.findById).toHaveBeenCalledWith(workflowId);
      expect(mockMarketplaceWorkflowRepo.update).toHaveBeenCalledWith(workflowId, updateRequest);
      expect(result).toEqual(updatedWorkflow);
    });

    it('should throw error if workflow not found', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const updateRequest = { name: 'Updated Workflow' };

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(null);

      await expect(
        marketplaceService.updateMarketplaceWorkflow(workflowId, updateRequest, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.WORKFLOW_NOT_FOUND,
        message: 'Workflow not found in marketplace'
      });
    });

    it('should throw error if user is not authorized', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const updateRequest = { name: 'Updated Workflow' };
      const existingWorkflow = {
        id: workflowId,
        publishedBy: 'different-user',
        name: 'Original Workflow'
      };

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(existingWorkflow);

      await expect(
        marketplaceService.updateMarketplaceWorkflow(workflowId, updateRequest, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.UNAUTHORIZED_PUBLISH,
        message: 'Not authorized to update this workflow'
      });
    });
  });

  describe('searchWorkflows', () => {
    it('should search workflows successfully', async () => {
      const searchRequest = {
        query: 'test',
        category: WorkflowCategory.AI_ML,
        tags: ['ai', 'ml'],
        engineType: EngineType.LANGFLOW,
        sortBy: WorkflowSortBy.DOWNLOAD_COUNT,
        sortOrder: 'desc' as const,
        limit: 20,
        offset: 0
      };

      const searchResponse = {
        workflows: [
          {
            id: 'workflow-1',
            name: 'Test Workflow 1',
            category: WorkflowCategory.AI_ML,
            engineType: EngineType.LANGFLOW
          }
        ],
        total: 1,
        hasMore: false,
        facets: {
          categories: [],
          tags: [],
          engineTypes: [],
          priceRanges: []
        }
      };

      mockMarketplaceWorkflowRepo.search.mockResolvedValue(searchResponse);

      const result = await marketplaceService.searchWorkflows(searchRequest);

      expect(mockMarketplaceWorkflowRepo.search).toHaveBeenCalledWith(searchRequest);
      expect(result).toEqual(searchResponse);
    });
  });

  describe('rateWorkflow', () => {
    it('should create new rating successfully', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const ratingRequest = {
        rating: 5,
        review: 'Excellent workflow!'
      };
      const workflow = { id: workflowId, name: 'Test Workflow' };
      const newRating = {
        id: 'rating-123',
        workflowId,
        userId,
        rating: 5,
        review: 'Excellent workflow!',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(workflow);
      mockRatingRepo.findByUserAndWorkflow.mockResolvedValue(null);
      mockRatingRepo.create.mockResolvedValue(newRating);
      mockRatingRepo.getAverageRating.mockResolvedValue({ average: 5, total: 1 });
      mockMarketplaceWorkflowRepo.updateRating.mockResolvedValue(undefined);

      const result = await marketplaceService.rateWorkflow(workflowId, ratingRequest, userId);

      expect(mockMarketplaceWorkflowRepo.findById).toHaveBeenCalledWith(workflowId);
      expect(mockRatingRepo.findByUserAndWorkflow).toHaveBeenCalledWith(userId, workflowId);
      expect(mockRatingRepo.create).toHaveBeenCalledWith({
        workflowId,
        userId,
        rating: 5,
        review: 'Excellent workflow!'
      });
      expect(mockRatingRepo.getAverageRating).toHaveBeenCalledWith(workflowId);
      expect(mockMarketplaceWorkflowRepo.updateRating).toHaveBeenCalledWith(workflowId, 5, 1);
      expect(result).toEqual(newRating);
    });

    it('should update existing rating', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const ratingRequest = {
        rating: 4,
        review: 'Good workflow!'
      };
      const workflow = { id: workflowId, name: 'Test Workflow' };
      const existingRating = {
        id: 'rating-123',
        workflowId,
        userId,
        rating: 3,
        review: 'OK workflow'
      };
      const updatedRating = {
        ...existingRating,
        rating: 4,
        review: 'Good workflow!'
      };

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(workflow);
      mockRatingRepo.findByUserAndWorkflow.mockResolvedValue(existingRating);
      mockRatingRepo.update.mockResolvedValue(updatedRating);
      mockRatingRepo.getAverageRating.mockResolvedValue({ average: 4, total: 1 });
      mockMarketplaceWorkflowRepo.updateRating.mockResolvedValue(undefined);

      const result = await marketplaceService.rateWorkflow(workflowId, ratingRequest, userId);

      expect(mockRatingRepo.update).toHaveBeenCalledWith(existingRating.id, {
        rating: 4,
        review: 'Good workflow!'
      });
      expect(result).toEqual(updatedRating);
    });

    it('should throw error for invalid rating', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const ratingRequest = {
        rating: 6, // Invalid rating
        review: 'Test review'
      };

      await expect(
        marketplaceService.rateWorkflow(workflowId, ratingRequest, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.INVALID_RATING,
        message: 'Rating must be between 1 and 5'
      });
    });

    it('should throw error if workflow not found', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const ratingRequest = {
        rating: 5,
        review: 'Test review'
      };

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(null);

      await expect(
        marketplaceService.rateWorkflow(workflowId, ratingRequest, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.WORKFLOW_NOT_FOUND,
        message: 'Workflow not found in marketplace'
      });
    });
  });

  describe('downloadWorkflow', () => {
    it('should track download successfully', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const version = '1.0.0';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';
      const workflow = {
        id: workflowId,
        isPublic: true,
        isPremium: false,
        price: 0
      };

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(workflow);
      mockDownloadRepo.create.mockResolvedValue({});
      mockMarketplaceWorkflowRepo.incrementDownloadCount.mockResolvedValue(undefined);
      mockRecommendationRepo.trackUserInteraction.mockResolvedValue(undefined);

      await marketplaceService.downloadWorkflow(workflowId, userId, version, ipAddress, userAgent);

      expect(mockMarketplaceWorkflowRepo.findById).toHaveBeenCalledWith(workflowId);
      expect(mockDownloadRepo.create).toHaveBeenCalledWith({
        workflowId,
        userId,
        version,
        ipAddress,
        userAgent
      });
      expect(mockMarketplaceWorkflowRepo.incrementDownloadCount).toHaveBeenCalledWith(workflowId);
      expect(mockRecommendationRepo.trackUserInteraction).toHaveBeenCalledWith(userId, workflowId, 'download');
    });

    it('should throw error if workflow not found', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const version = '1.0.0';

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(null);

      await expect(
        marketplaceService.downloadWorkflow(workflowId, userId, version)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.WORKFLOW_NOT_FOUND,
        message: 'Workflow not found in marketplace'
      });
    });

    it('should throw error if workflow is not public', async () => {
      const workflowId = 'workflow-123';
      const userId = 'user-123';
      const version = '1.0.0';
      const workflow = {
        id: workflowId,
        isPublic: false
      };

      mockMarketplaceWorkflowRepo.findById.mockResolvedValue(workflow);

      await expect(
        marketplaceService.downloadWorkflow(workflowId, userId, version)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.WORKFLOW_NOT_AVAILABLE,
        message: 'Workflow is not publicly available'
      });
    });
  });

  describe('getRecommendations', () => {
    it('should get recommendations for similar workflows', async () => {
      const request = {
        workflowId: 'workflow-123',
        limit: 10
      };
      const recommendations = [
        {
          workflowId: 'workflow-456',
          score: 0.8,
          reason: RecommendationReason.SIMILAR_CATEGORY,
          metadata: { category: WorkflowCategory.AI_ML }
        }
      ];

      mockRecommendationRepo.getSimilarWorkflows.mockResolvedValue(recommendations);

      const result = await marketplaceService.getRecommendations(request);

      expect(mockRecommendationRepo.getSimilarWorkflows).toHaveBeenCalledWith('workflow-123', 10);
      expect(result).toEqual({
        recommendations,
        total: 1
      });
    });

    it('should get recommendations for category', async () => {
      const request = {
        category: WorkflowCategory.AI_ML,
        limit: 10
      };
      const recommendations = [
        {
          workflowId: 'workflow-456',
          score: 0.7,
          reason: RecommendationReason.TRENDING,
          metadata: { category: WorkflowCategory.AI_ML }
        }
      ];

      mockRecommendationRepo.getTrendingInCategory.mockResolvedValue(recommendations);

      const result = await marketplaceService.getRecommendations(request);

      expect(mockRecommendationRepo.getTrendingInCategory).toHaveBeenCalledWith(WorkflowCategory.AI_ML, 10);
      expect(result).toEqual({
        recommendations,
        total: 1
      });
    });

    it('should get personalized recommendations for user', async () => {
      const request = {
        userId: 'user-123',
        limit: 10
      };
      const recommendations = [
        {
          workflowId: 'workflow-456',
          score: 0.9,
          reason: RecommendationReason.COLLABORATIVE_FILTERING,
          metadata: { similarUsers: 5 }
        }
      ];

      mockRecommendationRepo.getRecommendations.mockResolvedValue(recommendations);

      const result = await marketplaceService.getRecommendations(request);

      expect(mockRecommendationRepo.getRecommendations).toHaveBeenCalledWith('user-123', 10);
      expect(result).toEqual({
        recommendations,
        total: 1
      });
    });

    it('should get trending recommendations as fallback', async () => {
      const request = {
        limit: 10
      };
      const trendingWorkflows = [
        {
          id: 'workflow-456',
          downloadCount: 100,
          averageRating: 4.5,
          totalRatings: 20
        }
      ];

      mockMarketplaceWorkflowRepo.findTrending.mockResolvedValue(trendingWorkflows);

      const result = await marketplaceService.getRecommendations(request);

      expect(mockMarketplaceWorkflowRepo.findTrending).toHaveBeenCalledWith(10);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].workflowId).toBe('workflow-456');
      expect(result.recommendations[0].reason).toBe('trending');
    });
  });

  describe('getMarketplaceStats', () => {
    it('should return marketplace statistics', async () => {
      const stats = {
        totalWorkflows: 100,
        totalDownloads: 1000,
        totalRatings: 500,
        averageRating: 4.2,
        workflowsByCategory: {
          [WorkflowCategory.AI_ML]: 30,
          [WorkflowCategory.AUTOMATION]: 25
        },
        workflowsByEngine: {
          [EngineType.LANGFLOW]: 40,
          [EngineType.N8N]: 35
        },
        topTags: [
          { tag: 'ai', count: 50 },
          { tag: 'automation', count: 30 }
        ],
        trendingWorkflows: []
      };

      mockMarketplaceWorkflowRepo.getStats.mockResolvedValue(stats);

      const result = await marketplaceService.getMarketplaceStats();

      expect(mockMarketplaceWorkflowRepo.getStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });
  });
});