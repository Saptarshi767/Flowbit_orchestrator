import {
  MarketplaceWorkflow,
  WorkflowRating,
  WorkflowDownload,
  WorkflowCollection,
  WorkflowSearchRequest,
  WorkflowSearchResponse,
  MarketplaceStats,
  WorkflowRecommendation
} from '../../types/marketplace.types';

export interface IMarketplaceWorkflowRepository {
  // Workflow publishing and management
  create(workflow: Omit<MarketplaceWorkflow, 'id' | 'publishedAt' | 'updatedAt'>): Promise<MarketplaceWorkflow>;
  findById(id: string): Promise<MarketplaceWorkflow | null>;
  findByWorkflowId(workflowId: string): Promise<MarketplaceWorkflow | null>;
  update(id: string, updates: Partial<MarketplaceWorkflow>): Promise<MarketplaceWorkflow>;
  delete(id: string): Promise<boolean>;
  
  // Search and discovery
  search(request: WorkflowSearchRequest): Promise<WorkflowSearchResponse>;
  findByCategory(category: string, limit?: number, offset?: number): Promise<MarketplaceWorkflow[]>;
  findByTags(tags: string[], limit?: number, offset?: number): Promise<MarketplaceWorkflow[]>;
  findTrending(limit?: number): Promise<MarketplaceWorkflow[]>;
  findPopular(limit?: number): Promise<MarketplaceWorkflow[]>;
  
  // Statistics
  getStats(): Promise<MarketplaceStats>;
  incrementDownloadCount(id: string): Promise<void>;
  updateRating(id: string, averageRating: number, totalRatings: number): Promise<void>;
}

export interface IWorkflowRatingRepository {
  // Rating management
  create(rating: Omit<WorkflowRating, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowRating>;
  findById(id: string): Promise<WorkflowRating | null>;
  findByWorkflowId(workflowId: string, limit?: number, offset?: number): Promise<WorkflowRating[]>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<WorkflowRating[]>;
  findByUserAndWorkflow(userId: string, workflowId: string): Promise<WorkflowRating | null>;
  update(id: string, updates: Partial<WorkflowRating>): Promise<WorkflowRating>;
  delete(id: string): Promise<boolean>;
  
  // Rating statistics
  getAverageRating(workflowId: string): Promise<{ average: number; total: number }>;
  getRatingDistribution(workflowId: string): Promise<Record<number, number>>;
}

export interface IWorkflowDownloadRepository {
  // Download tracking
  create(download: Omit<WorkflowDownload, 'id' | 'downloadedAt'>): Promise<WorkflowDownload>;
  findById(id: string): Promise<WorkflowDownload | null>;
  findByWorkflowId(workflowId: string, limit?: number, offset?: number): Promise<WorkflowDownload[]>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<WorkflowDownload[]>;
  
  // Download statistics
  getDownloadCount(workflowId: string): Promise<number>;
  getDownloadStats(workflowId: string, days?: number): Promise<Record<string, number>>;
}

export interface IWorkflowCollectionRepository {
  // Collection management
  create(collection: Omit<WorkflowCollection, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowCollection>;
  findById(id: string): Promise<WorkflowCollection | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<WorkflowCollection[]>;
  findPublic(limit?: number, offset?: number): Promise<WorkflowCollection[]>;
  update(id: string, updates: Partial<WorkflowCollection>): Promise<WorkflowCollection>;
  delete(id: string): Promise<boolean>;
  
  // Collection workflow management
  addWorkflow(collectionId: string, workflowId: string): Promise<void>;
  removeWorkflow(collectionId: string, workflowId: string): Promise<void>;
  getWorkflows(collectionId: string): Promise<MarketplaceWorkflow[]>;
}

export interface IRecommendationRepository {
  // Recommendation data
  getRecommendations(userId: string, limit?: number): Promise<WorkflowRecommendation[]>;
  getSimilarWorkflows(workflowId: string, limit?: number): Promise<WorkflowRecommendation[]>;
  getTrendingInCategory(category: string, limit?: number): Promise<WorkflowRecommendation[]>;
  getPopularInOrganization(organizationId: string, limit?: number): Promise<WorkflowRecommendation[]>;
  
  // User behavior tracking for recommendations
  trackUserInteraction(userId: string, workflowId: string, interactionType: string): Promise<void>;
  getUserInteractionHistory(userId: string, limit?: number): Promise<any[]>;
}