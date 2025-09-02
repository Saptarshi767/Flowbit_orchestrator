import { EngineType } from '@robust-ai-orchestrator/shared';

// Marketplace workflow model
export interface MarketplaceWorkflow {
  id: string;
  workflowId: string; // Reference to the original workflow
  name: string;
  description: string;
  engineType: EngineType;
  category: WorkflowCategory;
  tags: string[];
  publishedBy: string;
  organizationId: string;
  version: string;
  isPublic: boolean;
  isPremium: boolean;
  price?: number; // Price in cents for premium workflows
  downloadCount: number;
  averageRating: number;
  totalRatings: number;
  publishedAt: Date;
  updatedAt: Date;
  metadata: WorkflowMetadata;
}

// Workflow categories for organization
export enum WorkflowCategory {
  DATA_PROCESSING = 'data_processing',
  AI_ML = 'ai_ml',
  AUTOMATION = 'automation',
  INTEGRATION = 'integration',
  ANALYTICS = 'analytics',
  COMMUNICATION = 'communication',
  UTILITY = 'utility',
  BUSINESS_PROCESS = 'business_process',
  MONITORING = 'monitoring',
  SECURITY = 'security'
}

// Workflow metadata for marketplace
export interface WorkflowMetadata {
  author: string;
  authorEmail?: string;
  license: string;
  documentation?: string;
  requirements?: string[];
  compatibility: EngineCompatibility;
  screenshots?: string[];
  demoUrl?: string;
  sourceUrl?: string;
  supportUrl?: string;
}

// Engine compatibility information
export interface EngineCompatibility {
  engineType: EngineType;
  minVersion?: string;
  maxVersion?: string;
  requiredFeatures?: string[];
}

// Workflow rating and review system
export interface WorkflowRating {
  id: string;
  workflowId: string;
  userId: string;
  rating: number; // 1-5 stars
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workflow download tracking
export interface WorkflowDownload {
  id: string;
  workflowId: string;
  userId: string;
  downloadedAt: Date;
  version: string;
  ipAddress?: string;
  userAgent?: string;
}

// Workflow collection for organizing workflows
export interface WorkflowCollection {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  isPublic: boolean;
  workflowIds: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Workflow recommendation data
export interface WorkflowRecommendation {
  workflowId: string;
  score: number;
  reason: RecommendationReason;
  metadata?: Record<string, any>;
}

export enum RecommendationReason {
  SIMILAR_CATEGORY = 'similar_category',
  SIMILAR_TAGS = 'similar_tags',
  POPULAR_IN_ORGANIZATION = 'popular_in_organization',
  TRENDING = 'trending',
  COLLABORATIVE_FILTERING = 'collaborative_filtering',
  CONTENT_BASED = 'content_based'
}

// Request/Response types for API
export interface PublishWorkflowRequest {
  workflowId: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  tags: string[];
  isPublic: boolean;
  isPremium?: boolean;
  price?: number;
  metadata: WorkflowMetadata;
}

export interface UpdateMarketplaceWorkflowRequest {
  name?: string;
  description?: string;
  category?: WorkflowCategory;
  tags?: string[];
  isPublic?: boolean;
  isPremium?: boolean;
  price?: number;
  metadata?: Partial<WorkflowMetadata>;
}

export interface WorkflowSearchRequest {
  query?: string;
  category?: WorkflowCategory;
  tags?: string[];
  engineType?: EngineType;
  isPremium?: boolean;
  minRating?: number;
  sortBy?: WorkflowSortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export enum WorkflowSortBy {
  NAME = 'name',
  PUBLISHED_AT = 'publishedAt',
  UPDATED_AT = 'updatedAt',
  DOWNLOAD_COUNT = 'downloadCount',
  AVERAGE_RATING = 'averageRating',
  PRICE = 'price'
}

export interface WorkflowSearchResponse {
  workflows: MarketplaceWorkflow[];
  total: number;
  hasMore: boolean;
  facets: SearchFacets;
}

export interface SearchFacets {
  categories: CategoryFacet[];
  tags: TagFacet[];
  engineTypes: EngineTypeFacet[];
  priceRanges: PriceRangeFacet[];
}

export interface CategoryFacet {
  category: WorkflowCategory;
  count: number;
}

export interface TagFacet {
  tag: string;
  count: number;
}

export interface EngineTypeFacet {
  engineType: EngineType;
  count: number;
}

export interface PriceRangeFacet {
  range: string;
  min: number;
  max: number;
  count: number;
}

export interface RateWorkflowRequest {
  rating: number;
  review?: string;
}

export interface WorkflowRecommendationRequest {
  userId?: string;
  workflowId?: string;
  category?: WorkflowCategory;
  tags?: string[];
  limit?: number;
}

export interface WorkflowRecommendationResponse {
  recommendations: WorkflowRecommendation[];
  total: number;
}

export interface CreateCollectionRequest {
  name: string;
  description: string;
  isPublic: boolean;
  workflowIds?: string[];
  tags?: string[];
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
  workflowIds?: string[];
  tags?: string[];
}

export interface MarketplaceStats {
  totalWorkflows: number;
  totalDownloads: number;
  totalRatings: number;
  averageRating: number;
  workflowsByCategory: Record<WorkflowCategory, number>;
  workflowsByEngine: Record<EngineType, number>;
  topTags: TagFacet[];
  trendingWorkflows: MarketplaceWorkflow[];
}

// Error types
export interface MarketplaceError {
  code: string;
  message: string;
  details?: any;
}

export enum MarketplaceErrorCode {
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  WORKFLOW_ALREADY_PUBLISHED = 'WORKFLOW_ALREADY_PUBLISHED',
  UNAUTHORIZED_PUBLISH = 'UNAUTHORIZED_PUBLISH',
  INVALID_RATING = 'INVALID_RATING',
  DUPLICATE_RATING = 'DUPLICATE_RATING',
  COLLECTION_NOT_FOUND = 'COLLECTION_NOT_FOUND',
  INVALID_SEARCH_PARAMS = 'INVALID_SEARCH_PARAMS',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  WORKFLOW_NOT_AVAILABLE = 'WORKFLOW_NOT_AVAILABLE'
}