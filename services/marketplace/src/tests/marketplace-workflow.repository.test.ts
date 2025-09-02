import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Pool } from 'pg';
import { MarketplaceWorkflowRepository } from '../repositories/marketplace-workflow.repository';
import { WorkflowCategory, WorkflowSortBy } from '../types/marketplace.types';
import { EngineType } from '@robust-ai-orchestrator/shared';

// Mock pg Pool
const mockPool = {
  query: vi.fn(),
  end: vi.fn()
};

describe('MarketplaceWorkflowRepository', () => {
  let repository: MarketplaceWorkflowRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    repository = new MarketplaceWorkflowRepository(mockPool as any);
  });

  describe('create', () => {
    it('should create a new marketplace workflow', async () => {
      const workflowData = {
        workflowId: 'workflow-123',
        name: 'Test Workflow',
        description: 'A test workflow',
        engineType: EngineType.LANGFLOW,
        category: WorkflowCategory.AI_ML,
        tags: ['test', 'ai'],
        publishedBy: 'user-123',
        organizationId: 'org-123',
        version: '1.0.0',
        isPublic: true,
        isPremium: false,
        downloadCount: 0,
        averageRating: 0,
        totalRatings: 0,
        metadata: {
          author: 'Test Author',
          license: 'MIT',
          compatibility: {
            engineType: EngineType.LANGFLOW,
            minVersion: '1.0.0'
          }
        }
      };

      const mockRow = {
        id: 'marketplace-123',
        workflow_id: workflowData.workflowId,
        name: workflowData.name,
        description: workflowData.description,
        engine_type: workflowData.engineType,
        category: workflowData.category,
        tags: JSON.stringify(workflowData.tags),
        published_by: workflowData.publishedBy,
        organization_id: workflowData.organizationId,
        version: workflowData.version,
        is_public: workflowData.isPublic,
        is_premium: workflowData.isPremium,
        price: null,
        download_count: workflowData.downloadCount,
        average_rating: workflowData.averageRating,
        total_ratings: workflowData.totalRatings,
        published_at: new Date(),
        updated_at: new Date(),
        metadata: JSON.stringify(workflowData.metadata)
      };

      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.create(workflowData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO marketplace_workflows'),
        expect.arrayContaining([
          expect.any(String), // id
          workflowData.workflowId,
          workflowData.name,
          workflowData.description,
          workflowData.engineType,
          workflowData.category,
          JSON.stringify(workflowData.tags),
          workflowData.publishedBy,
          workflowData.organizationId,
          workflowData.version,
          workflowData.isPublic,
          workflowData.isPremium,
          null, // price
          workflowData.downloadCount,
          workflowData.averageRating,
          workflowData.totalRatings,
          expect.any(Date), // published_at
          expect.any(Date), // updated_at
          JSON.stringify(workflowData.metadata)
        ])
      );

      expect(result).toMatchObject({
        id: 'marketplace-123',
        workflowId: workflowData.workflowId,
        name: workflowData.name,
        description: workflowData.description,
        engineType: workflowData.engineType,
        category: workflowData.category,
        tags: workflowData.tags,
        publishedBy: workflowData.publishedBy,
        organizationId: workflowData.organizationId,
        version: workflowData.version,
        isPublic: workflowData.isPublic,
        isPremium: workflowData.isPremium,
        downloadCount: workflowData.downloadCount,
        averageRating: workflowData.averageRating,
        totalRatings: workflowData.totalRatings,
        metadata: workflowData.metadata
      });
    });
  });

  describe('findById', () => {
    it('should find workflow by id', async () => {
      const workflowId = 'marketplace-123';
      const mockRow = {
        id: workflowId,
        workflow_id: 'workflow-123',
        name: 'Test Workflow',
        description: 'A test workflow',
        engine_type: EngineType.LANGFLOW,
        category: WorkflowCategory.AI_ML,
        tags: JSON.stringify(['test', 'ai']),
        published_by: 'user-123',
        organization_id: 'org-123',
        version: '1.0.0',
        is_public: true,
        is_premium: false,
        price: null,
        download_count: 0,
        average_rating: 0,
        total_ratings: 0,
        published_at: new Date(),
        updated_at: new Date(),
        metadata: JSON.stringify({ author: 'Test Author', license: 'MIT' })
      };

      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById(workflowId);

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM marketplace_workflows WHERE id = $1',
        [workflowId]
      );

      expect(result).toMatchObject({
        id: workflowId,
        workflowId: 'workflow-123',
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        category: WorkflowCategory.AI_ML,
        tags: ['test', 'ai']
      });
    });

    it('should return null if workflow not found', async () => {
      const workflowId = 'non-existent';
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById(workflowId);

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search workflows with filters', async () => {
      const searchRequest = {
        query: 'test',
        category: WorkflowCategory.AI_ML,
        tags: ['ai'],
        engineType: EngineType.LANGFLOW,
        isPremium: false,
        minRating: 4.0,
        sortBy: WorkflowSortBy.DOWNLOAD_COUNT,
        sortOrder: 'desc' as const,
        limit: 20,
        offset: 0
      };

      const mockWorkflowRows = [
        {
          id: 'workflow-1',
          workflow_id: 'wf-1',
          name: 'Test Workflow 1',
          description: 'First test workflow',
          engine_type: EngineType.LANGFLOW,
          category: WorkflowCategory.AI_ML,
          tags: JSON.stringify(['ai', 'test']),
          published_by: 'user-1',
          organization_id: 'org-1',
          version: '1.0.0',
          is_public: true,
          is_premium: false,
          price: null,
          download_count: 100,
          average_rating: 4.5,
          total_ratings: 10,
          published_at: new Date(),
          updated_at: new Date(),
          metadata: JSON.stringify({ author: 'Author 1', license: 'MIT' })
        }
      ];

      const mockCountResult = { rows: [{ count: '1' }] };
      const mockWorkflowResult = { rows: mockWorkflowRows };
      const mockFacetResults = [
        { rows: [{ category: WorkflowCategory.AI_ML, count: '1' }] },
        { rows: [{ tag: 'ai', count: '1' }] },
        { rows: [{ engine_type: EngineType.LANGFLOW, count: '1' }] },
        { rows: [{ range: 'Free', min_price: 0, max_price: 0, count: '1' }] }
      ];

      mockPool.query
        .mockResolvedValueOnce(mockCountResult) // Count query
        .mockResolvedValueOnce(mockWorkflowResult) // Workflow query
        .mockResolvedValueOnce(mockFacetResults[0]) // Categories facet
        .mockResolvedValueOnce(mockFacetResults[1]) // Tags facet
        .mockResolvedValueOnce(mockFacetResults[2]) // Engine types facet
        .mockResolvedValueOnce(mockFacetResults[3]); // Price ranges facet

      const result = await repository.search(searchRequest);

      expect(result.workflows).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.workflows[0]).toMatchObject({
        id: 'workflow-1',
        name: 'Test Workflow 1',
        engineType: EngineType.LANGFLOW,
        category: WorkflowCategory.AI_ML,
        downloadCount: 100,
        averageRating: 4.5
      });
      expect(result.facets).toBeDefined();
      expect(result.facets.categories).toHaveLength(1);
      expect(result.facets.tags).toHaveLength(1);
      expect(result.facets.engineTypes).toHaveLength(1);
      expect(result.facets.priceRanges).toHaveLength(1);
    });

    it('should handle empty search results', async () => {
      const searchRequest = {
        query: 'nonexistent',
        limit: 20,
        offset: 0
      };

      const mockCountResult = { rows: [{ count: '0' }] };
      const mockWorkflowResult = { rows: [] };
      const mockFacetResults = [
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] }
      ];

      mockPool.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockWorkflowResult)
        .mockResolvedValueOnce(mockFacetResults[0])
        .mockResolvedValueOnce(mockFacetResults[1])
        .mockResolvedValueOnce(mockFacetResults[2])
        .mockResolvedValueOnce(mockFacetResults[3]);

      const result = await repository.search(searchRequest);

      expect(result.workflows).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('findTrending', () => {
    it('should find trending workflows', async () => {
      const limit = 5;
      const mockRows = [
        {
          id: 'workflow-1',
          workflow_id: 'wf-1',
          name: 'Trending Workflow 1',
          description: 'A trending workflow',
          engine_type: EngineType.LANGFLOW,
          category: WorkflowCategory.AI_ML,
          tags: JSON.stringify(['trending', 'ai']),
          published_by: 'user-1',
          organization_id: 'org-1',
          version: '1.0.0',
          is_public: true,
          is_premium: false,
          price: null,
          download_count: 200,
          average_rating: 4.8,
          total_ratings: 25,
          published_at: new Date(),
          updated_at: new Date(),
          metadata: JSON.stringify({ author: 'Author 1', license: 'MIT' })
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findTrending(limit);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('recent_downloads'),
        [limit]
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'workflow-1',
        name: 'Trending Workflow 1',
        downloadCount: 200,
        averageRating: 4.8
      });
    });
  });

  describe('getStats', () => {
    it('should return marketplace statistics', async () => {
      const mockBasicStats = {
        rows: [{
          total_workflows: '100',
          total_downloads: '1000',
          total_ratings: '500',
          average_rating: '4.2'
        }]
      };

      const mockCategoryStats = {
        rows: [
          { category: WorkflowCategory.AI_ML, count: '30' },
          { category: WorkflowCategory.AUTOMATION, count: '25' }
        ]
      };

      const mockEngineStats = {
        rows: [
          { engine_type: EngineType.LANGFLOW, count: '40' },
          { engine_type: EngineType.N8N, count: '35' }
        ]
      };

      const mockTagStats = {
        rows: [
          { tag: 'ai', count: '50' },
          { tag: 'automation', count: '30' }
        ]
      };

      const mockTrendingWorkflows = [
        {
          id: 'trending-1',
          workflowId: 'wf-trending-1',
          name: 'Trending Workflow',
          description: 'A trending workflow',
          engineType: EngineType.LANGFLOW,
          category: WorkflowCategory.AI_ML,
          tags: ['trending'],
          publishedBy: 'user-1',
          organizationId: 'org-1',
          version: '1.0.0',
          isPublic: true,
          isPremium: false,
          downloadCount: 150,
          averageRating: 4.5,
          totalRatings: 20,
          publishedAt: new Date(),
          updatedAt: new Date(),
          metadata: { author: 'Author', license: 'MIT' }
        }
      ];

      mockPool.query
        .mockResolvedValueOnce(mockBasicStats)
        .mockResolvedValueOnce(mockCategoryStats)
        .mockResolvedValueOnce(mockEngineStats)
        .mockResolvedValueOnce(mockTagStats)
        .mockResolvedValueOnce({ rows: [{
          ...mockTrendingWorkflows[0],
          workflow_id: mockTrendingWorkflows[0].workflowId,
          engine_type: mockTrendingWorkflows[0].engineType,
          published_by: mockTrendingWorkflows[0].publishedBy,
          organization_id: mockTrendingWorkflows[0].organizationId,
          is_public: mockTrendingWorkflows[0].isPublic,
          is_premium: mockTrendingWorkflows[0].isPremium,
          download_count: mockTrendingWorkflows[0].downloadCount,
          average_rating: mockTrendingWorkflows[0].averageRating,
          total_ratings: mockTrendingWorkflows[0].totalRatings,
          published_at: mockTrendingWorkflows[0].publishedAt,
          updated_at: mockTrendingWorkflows[0].updatedAt,
          tags: JSON.stringify(mockTrendingWorkflows[0].tags),
          metadata: JSON.stringify(mockTrendingWorkflows[0].metadata)
        }] }); // For findTrending call

      // Mock the findTrending method
      vi.spyOn(repository, 'findTrending').mockResolvedValue(mockTrendingWorkflows);

      const result = await repository.getStats();

      expect(result).toEqual({
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
        trendingWorkflows: mockTrendingWorkflows
      });
    });
  });

  describe('update', () => {
    it('should update workflow successfully', async () => {
      // Clear any previous mocks
      vi.clearAllMocks();
      
      const workflowId = 'workflow-123';
      const updates = {
        name: 'Updated Workflow',
        description: 'Updated description',
        tags: ['updated', 'test']
      };

      const mockUpdatedRow = {
        id: workflowId,
        workflow_id: 'wf-123',
        name: updates.name,
        description: updates.description,
        engine_type: EngineType.LANGFLOW,
        category: WorkflowCategory.AI_ML,
        tags: JSON.stringify(updates.tags),
        published_by: 'user-123',
        organization_id: 'org-123',
        version: '1.0.0',
        is_public: true,
        is_premium: false,
        price: null,
        download_count: 0,
        average_rating: 0,
        total_ratings: 0,
        published_at: new Date(),
        updated_at: new Date(),
        metadata: JSON.stringify({ author: 'Author', license: 'MIT' })
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockUpdatedRow] });

      const result = await repository.update(workflowId, updates);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE marketplace_workflows'),
        expect.arrayContaining([
          updates.name,
          updates.description,
          JSON.stringify(updates.tags),
          expect.any(Date), // updated_at
          workflowId
        ])
      );

      expect(result).toMatchObject({
        id: workflowId,
        name: updates.name,
        description: updates.description,
        tags: updates.tags
      });
    });
  });

  describe('delete', () => {
    it('should delete workflow successfully', async () => {
      const workflowId = 'workflow-123';
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await repository.delete(workflowId);

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM marketplace_workflows WHERE id = $1',
        [workflowId]
      );
      expect(result).toBe(true);
    });

    it('should return false if workflow not found', async () => {
      const workflowId = 'non-existent';
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete(workflowId);

      expect(result).toBe(false);
    });
  });

  describe('incrementDownloadCount', () => {
    it('should increment download count', async () => {
      const workflowId = 'workflow-123';
      mockPool.query.mockResolvedValue({});

      await repository.incrementDownloadCount(workflowId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE marketplace_workflows'),
        [workflowId]
      );
    });
  });

  describe('updateRating', () => {
    it('should update workflow rating', async () => {
      const workflowId = 'workflow-123';
      const averageRating = 4.5;
      const totalRatings = 10;
      mockPool.query.mockResolvedValue({});

      await repository.updateRating(workflowId, averageRating, totalRatings);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE marketplace_workflows'),
        [workflowId, averageRating, totalRatings]
      );
    });
  });
});