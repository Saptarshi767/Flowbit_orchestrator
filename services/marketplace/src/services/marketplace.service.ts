import {
  MarketplaceWorkflow,
  PublishWorkflowRequest,
  UpdateMarketplaceWorkflowRequest,
  WorkflowSearchRequest,
  WorkflowSearchResponse,
  RateWorkflowRequest,
  WorkflowRating,
  WorkflowRecommendationRequest,
  WorkflowRecommendationResponse,
  MarketplaceStats,
  MarketplaceError,
  MarketplaceErrorCode
} from '../types/marketplace.types';
import { IMarketplaceWorkflowRepository, IWorkflowRatingRepository, IWorkflowDownloadRepository, IRecommendationRepository } from '../repositories/interfaces/marketplace.repository.interface';

export class MarketplaceService {
  constructor(
    private marketplaceWorkflowRepo: IMarketplaceWorkflowRepository,
    private ratingRepo: IWorkflowRatingRepository,
    private downloadRepo: IWorkflowDownloadRepository,
    private recommendationRepo: IRecommendationRepository
  ) {}

  // Workflow publishing and management
  async publishWorkflow(request: PublishWorkflowRequest, userId: string, organizationId: string): Promise<MarketplaceWorkflow> {
    // Check if workflow is already published
    const existing = await this.marketplaceWorkflowRepo.findByWorkflowId(request.workflowId);
    if (existing) {
      throw this.createError(MarketplaceErrorCode.WORKFLOW_ALREADY_PUBLISHED, 'Workflow is already published in marketplace');
    }

    // TODO: Validate that the user owns the workflow (would need to call workflow service)
    // For now, we'll assume the validation is done at the API level

    const marketplaceWorkflow: Omit<MarketplaceWorkflow, 'id' | 'publishedAt' | 'updatedAt'> = {
      workflowId: request.workflowId,
      name: request.name,
      description: request.description,
      engineType: request.engineType,
      category: request.category,
      tags: request.tags,
      publishedBy: userId,
      organizationId,
      version: '1.0.0', // TODO: Get actual version from workflow service
      isPublic: request.isPublic,
      isPremium: request.isPremium || false,
      price: request.price,
      downloadCount: 0,
      averageRating: 0,
      totalRatings: 0,
      metadata: request.metadata
    };

    return await this.marketplaceWorkflowRepo.create(marketplaceWorkflow);
  }

  async updateMarketplaceWorkflow(
    workflowId: string, 
    request: UpdateMarketplaceWorkflowRequest, 
    userId: string
  ): Promise<MarketplaceWorkflow> {
    const workflow = await this.marketplaceWorkflowRepo.findById(workflowId);
    if (!workflow) {
      throw this.createError(MarketplaceErrorCode.WORKFLOW_NOT_FOUND, 'Workflow not found in marketplace');
    }

    // Check if user has permission to update (owner or admin)
    if (workflow.publishedBy !== userId) {
      throw this.createError(MarketplaceErrorCode.UNAUTHORIZED_PUBLISH, 'Not authorized to update this workflow');
    }

    return await this.marketplaceWorkflowRepo.update(workflowId, request);
  }

  async unpublishWorkflow(workflowId: string, userId: string): Promise<boolean> {
    const workflow = await this.marketplaceWorkflowRepo.findById(workflowId);
    if (!workflow) {
      throw this.createError(MarketplaceErrorCode.WORKFLOW_NOT_FOUND, 'Workflow not found in marketplace');
    }

    // Check if user has permission to unpublish
    if (workflow.publishedBy !== userId) {
      throw this.createError(MarketplaceErrorCode.UNAUTHORIZED_PUBLISH, 'Not authorized to unpublish this workflow');
    }

    return await this.marketplaceWorkflowRepo.delete(workflowId);
  }

  // Search and discovery
  async searchWorkflows(request: WorkflowSearchRequest): Promise<WorkflowSearchResponse> {
    return await this.marketplaceWorkflowRepo.search(request);
  }

  async getWorkflowById(id: string): Promise<MarketplaceWorkflow | null> {
    return await this.marketplaceWorkflowRepo.findById(id);
  }

  async getTrendingWorkflows(limit = 10): Promise<MarketplaceWorkflow[]> {
    return await this.marketplaceWorkflowRepo.findTrending(limit);
  }

  async getPopularWorkflows(limit = 10): Promise<MarketplaceWorkflow[]> {
    return await this.marketplaceWorkflowRepo.findPopular(limit);
  }

  async getWorkflowsByCategory(category: string, limit = 20, offset = 0): Promise<MarketplaceWorkflow[]> {
    return await this.marketplaceWorkflowRepo.findByCategory(category, limit, offset);
  }

  async getWorkflowsByTags(tags: string[], limit = 20, offset = 0): Promise<MarketplaceWorkflow[]> {
    return await this.marketplaceWorkflowRepo.findByTags(tags, limit, offset);
  }

  // Rating and review system
  async rateWorkflow(workflowId: string, request: RateWorkflowRequest, userId: string): Promise<WorkflowRating> {
    // Validate rating
    if (request.rating < 1 || request.rating > 5) {
      throw this.createError(MarketplaceErrorCode.INVALID_RATING, 'Rating must be between 1 and 5');
    }

    // Check if workflow exists
    const workflow = await this.marketplaceWorkflowRepo.findById(workflowId);
    if (!workflow) {
      throw this.createError(MarketplaceErrorCode.WORKFLOW_NOT_FOUND, 'Workflow not found in marketplace');
    }

    // Check if user already rated this workflow
    const existingRating = await this.ratingRepo.findByUserAndWorkflow(userId, workflowId);
    
    let rating: WorkflowRating;
    
    if (existingRating) {
      // Update existing rating
      rating = await this.ratingRepo.update(existingRating.id, {
        rating: request.rating,
        review: request.review
      });
    } else {
      // Create new rating
      rating = await this.ratingRepo.create({
        workflowId,
        userId,
        rating: request.rating,
        review: request.review
      });
    }

    // Update workflow's average rating
    await this.updateWorkflowRating(workflowId);

    return rating;
  }

  async getWorkflowRatings(workflowId: string, limit = 20, offset = 0): Promise<WorkflowRating[]> {
    return await this.ratingRepo.findByWorkflowId(workflowId, limit, offset);
  }

  async getUserRatings(userId: string, limit = 20, offset = 0): Promise<WorkflowRating[]> {
    return await this.ratingRepo.findByUserId(userId, limit, offset);
  }

  async deleteRating(ratingId: string, userId: string): Promise<boolean> {
    const rating = await this.ratingRepo.findById(ratingId);
    if (!rating) {
      return false;
    }

    // Check if user owns the rating
    if (rating.userId !== userId) {
      throw this.createError(MarketplaceErrorCode.UNAUTHORIZED_PUBLISH, 'Not authorized to delete this rating');
    }

    const deleted = await this.ratingRepo.delete(ratingId);
    
    if (deleted) {
      // Update workflow's average rating
      await this.updateWorkflowRating(rating.workflowId);
    }

    return deleted;
  }

  // Download tracking
  async downloadWorkflow(workflowId: string, userId: string, version: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const workflow = await this.marketplaceWorkflowRepo.findById(workflowId);
    if (!workflow) {
      throw this.createError(MarketplaceErrorCode.WORKFLOW_NOT_FOUND, 'Workflow not found in marketplace');
    }

    if (!workflow.isPublic) {
      throw this.createError(MarketplaceErrorCode.WORKFLOW_NOT_AVAILABLE, 'Workflow is not publicly available');
    }

    // Check if premium workflow requires payment
    if (workflow.isPremium && workflow.price && workflow.price > 0) {
      // TODO: Implement payment verification
      // For now, we'll assume payment is handled elsewhere
    }

    // Track download
    await this.downloadRepo.create({
      workflowId,
      userId,
      version,
      ipAddress,
      userAgent
    });

    // Increment download count
    await this.marketplaceWorkflowRepo.incrementDownloadCount(workflowId);

    // Track user interaction for recommendations
    await this.recommendationRepo.trackUserInteraction(userId, workflowId, 'download');
  }

  async getUserDownloads(userId: string, limit = 20, offset = 0) {
    return await this.downloadRepo.findByUserId(userId, limit, offset);
  }

  async getWorkflowDownloads(workflowId: string, limit = 20, offset = 0) {
    return await this.downloadRepo.findByWorkflowId(workflowId, limit, offset);
  }

  // Recommendations
  async getRecommendations(request: WorkflowRecommendationRequest): Promise<WorkflowRecommendationResponse> {
    let recommendations;
    
    if (request.workflowId) {
      // Get similar workflows
      recommendations = await this.recommendationRepo.getSimilarWorkflows(request.workflowId, request.limit);
    } else if (request.category) {
      // Get trending in category
      recommendations = await this.recommendationRepo.getTrendingInCategory(request.category, request.limit);
    } else if (request.userId) {
      // Get personalized recommendations
      recommendations = await this.recommendationRepo.getRecommendations(request.userId, request.limit);
    } else {
      // Get general trending recommendations
      const trending = await this.marketplaceWorkflowRepo.findTrending(request.limit || 10);
      recommendations = trending.map(workflow => ({
        workflowId: workflow.id,
        score: workflow.downloadCount * 0.6 + workflow.averageRating * workflow.totalRatings * 0.4,
        reason: 'trending' as any,
        metadata: {
          downloadCount: workflow.downloadCount,
          averageRating: workflow.averageRating,
          totalRatings: workflow.totalRatings
        }
      }));
    }

    return {
      recommendations,
      total: recommendations.length
    };
  }

  // Statistics
  async getMarketplaceStats(): Promise<MarketplaceStats> {
    return await this.marketplaceWorkflowRepo.getStats();
  }

  // Private helper methods
  private async updateWorkflowRating(workflowId: string): Promise<void> {
    const { average, total } = await this.ratingRepo.getAverageRating(workflowId);
    await this.marketplaceWorkflowRepo.updateRating(workflowId, average, total);
  }

  private createError(code: MarketplaceErrorCode, message: string, details?: any): MarketplaceError {
    return {
      code,
      message,
      details
    } as MarketplaceError;
  }
}