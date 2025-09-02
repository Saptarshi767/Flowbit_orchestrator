import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionService } from '../services/collection.service';
import { 
  WorkflowCollection, 
  CreateCollectionRequest, 
  UpdateCollectionRequest,
  MarketplaceErrorCode 
} from '../types/marketplace.types';

// Mock repository
const mockCollectionRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  findPublic: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  addWorkflow: vi.fn(),
  removeWorkflow: vi.fn(),
  getWorkflows: vi.fn()
};

describe('CollectionService', () => {
  let collectionService: CollectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    collectionService = new CollectionService(mockCollectionRepo as any);
  });

  describe('createCollection', () => {
    it('should create a new collection successfully', async () => {
      const userId = 'user-123';
      const request: CreateCollectionRequest = {
        name: 'My AI Workflows',
        description: 'A collection of AI-related workflows',
        isPublic: true,
        workflowIds: ['workflow-1', 'workflow-2'],
        tags: ['ai', 'ml']
      };

      const expectedCollection: WorkflowCollection = {
        id: 'collection-123',
        name: request.name,
        description: request.description,
        createdBy: userId,
        isPublic: request.isPublic,
        workflowIds: request.workflowIds!,
        tags: request.tags!,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.create.mockResolvedValue(expectedCollection);

      const result = await collectionService.createCollection(request, userId);

      expect(mockCollectionRepo.create).toHaveBeenCalledWith({
        name: request.name,
        description: request.description,
        createdBy: userId,
        isPublic: request.isPublic,
        workflowIds: request.workflowIds,
        tags: request.tags
      });
      expect(result).toEqual(expectedCollection);
    });

    it('should create collection with default values', async () => {
      const userId = 'user-123';
      const request: CreateCollectionRequest = {
        name: 'Simple Collection',
        description: 'A simple collection',
        isPublic: false
      };

      const expectedCollection: WorkflowCollection = {
        id: 'collection-123',
        name: request.name,
        description: request.description,
        createdBy: userId,
        isPublic: request.isPublic,
        workflowIds: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.create.mockResolvedValue(expectedCollection);

      const result = await collectionService.createCollection(request, userId);

      expect(mockCollectionRepo.create).toHaveBeenCalledWith({
        name: request.name,
        description: request.description,
        createdBy: userId,
        isPublic: request.isPublic,
        workflowIds: [],
        tags: []
      });
      expect(result).toEqual(expectedCollection);
    });
  });

  describe('updateCollection', () => {
    it('should update collection successfully', async () => {
      const collectionId = 'collection-123';
      const userId = 'user-123';
      const request: UpdateCollectionRequest = {
        name: 'Updated Collection',
        description: 'Updated description',
        tags: ['updated', 'collection']
      };

      const existingCollection: WorkflowCollection = {
        id: collectionId,
        name: 'Original Collection',
        description: 'Original description',
        createdBy: userId,
        isPublic: true,
        workflowIds: ['workflow-1'],
        tags: ['original'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedCollection: WorkflowCollection = {
        ...existingCollection,
        ...request,
        updatedAt: new Date()
      };

      mockCollectionRepo.findById.mockResolvedValue(existingCollection);
      mockCollectionRepo.update.mockResolvedValue(updatedCollection);

      const result = await collectionService.updateCollection(collectionId, request, userId);

      expect(mockCollectionRepo.findById).toHaveBeenCalledWith(collectionId);
      expect(mockCollectionRepo.update).toHaveBeenCalledWith(collectionId, request);
      expect(result).toEqual(updatedCollection);
    });

    it('should throw error if collection not found', async () => {
      const collectionId = 'non-existent';
      const userId = 'user-123';
      const request: UpdateCollectionRequest = {
        name: 'Updated Collection'
      };

      mockCollectionRepo.findById.mockResolvedValue(null);

      await expect(
        collectionService.updateCollection(collectionId, request, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.COLLECTION_NOT_FOUND,
        message: 'Collection not found'
      });

      expect(mockCollectionRepo.update).not.toHaveBeenCalled();
    });

    it('should throw error if user is not authorized', async () => {
      const collectionId = 'collection-123';
      const userId = 'user-123';
      const request: UpdateCollectionRequest = {
        name: 'Updated Collection'
      };

      const existingCollection: WorkflowCollection = {
        id: collectionId,
        name: 'Original Collection',
        description: 'Original description',
        createdBy: 'different-user',
        isPublic: true,
        workflowIds: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.findById.mockResolvedValue(existingCollection);

      await expect(
        collectionService.updateCollection(collectionId, request, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.UNAUTHORIZED_PUBLISH,
        message: 'Not authorized to update this collection'
      });

      expect(mockCollectionRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteCollection', () => {
    it('should delete collection successfully', async () => {
      const collectionId = 'collection-123';
      const userId = 'user-123';

      const existingCollection: WorkflowCollection = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test description',
        createdBy: userId,
        isPublic: true,
        workflowIds: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.findById.mockResolvedValue(existingCollection);
      mockCollectionRepo.delete.mockResolvedValue(true);

      const result = await collectionService.deleteCollection(collectionId, userId);

      expect(mockCollectionRepo.findById).toHaveBeenCalledWith(collectionId);
      expect(mockCollectionRepo.delete).toHaveBeenCalledWith(collectionId);
      expect(result).toBe(true);
    });

    it('should throw error if collection not found', async () => {
      const collectionId = 'non-existent';
      const userId = 'user-123';

      mockCollectionRepo.findById.mockResolvedValue(null);

      await expect(
        collectionService.deleteCollection(collectionId, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.COLLECTION_NOT_FOUND,
        message: 'Collection not found'
      });

      expect(mockCollectionRepo.delete).not.toHaveBeenCalled();
    });

    it('should throw error if user is not authorized', async () => {
      const collectionId = 'collection-123';
      const userId = 'user-123';

      const existingCollection: WorkflowCollection = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test description',
        createdBy: 'different-user',
        isPublic: true,
        workflowIds: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.findById.mockResolvedValue(existingCollection);

      await expect(
        collectionService.deleteCollection(collectionId, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.UNAUTHORIZED_PUBLISH,
        message: 'Not authorized to delete this collection'
      });

      expect(mockCollectionRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('getCollection', () => {
    it('should get collection by id', async () => {
      const collectionId = 'collection-123';
      const collection: WorkflowCollection = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test description',
        createdBy: 'user-123',
        isPublic: true,
        workflowIds: ['workflow-1', 'workflow-2'],
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.findById.mockResolvedValue(collection);

      const result = await collectionService.getCollection(collectionId);

      expect(mockCollectionRepo.findById).toHaveBeenCalledWith(collectionId);
      expect(result).toEqual(collection);
    });

    it('should return null if collection not found', async () => {
      const collectionId = 'non-existent';
      mockCollectionRepo.findById.mockResolvedValue(null);

      const result = await collectionService.getCollection(collectionId);

      expect(result).toBeNull();
    });
  });

  describe('getUserCollections', () => {
    it('should get user collections', async () => {
      const userId = 'user-123';
      const limit = 10;
      const offset = 0;
      const collections: WorkflowCollection[] = [
        {
          id: 'collection-1',
          name: 'Collection 1',
          description: 'First collection',
          createdBy: userId,
          isPublic: true,
          workflowIds: [],
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'collection-2',
          name: 'Collection 2',
          description: 'Second collection',
          createdBy: userId,
          isPublic: false,
          workflowIds: [],
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockCollectionRepo.findByUserId.mockResolvedValue(collections);

      const result = await collectionService.getUserCollections(userId, limit, offset);

      expect(mockCollectionRepo.findByUserId).toHaveBeenCalledWith(userId, limit, offset);
      expect(result).toEqual(collections);
    });
  });

  describe('getPublicCollections', () => {
    it('should get public collections', async () => {
      const limit = 20;
      const offset = 0;
      const collections: WorkflowCollection[] = [
        {
          id: 'collection-1',
          name: 'Public Collection 1',
          description: 'First public collection',
          createdBy: 'user-1',
          isPublic: true,
          workflowIds: [],
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockCollectionRepo.findPublic.mockResolvedValue(collections);

      const result = await collectionService.getPublicCollections(limit, offset);

      expect(mockCollectionRepo.findPublic).toHaveBeenCalledWith(limit, offset);
      expect(result).toEqual(collections);
    });
  });

  describe('addWorkflowToCollection', () => {
    it('should add workflow to collection successfully', async () => {
      const collectionId = 'collection-123';
      const workflowId = 'workflow-123';
      const userId = 'user-123';

      const collection: WorkflowCollection = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test description',
        createdBy: userId,
        isPublic: true,
        workflowIds: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.findById.mockResolvedValue(collection);
      mockCollectionRepo.addWorkflow.mockResolvedValue(undefined);

      await collectionService.addWorkflowToCollection(collectionId, workflowId, userId);

      expect(mockCollectionRepo.findById).toHaveBeenCalledWith(collectionId);
      expect(mockCollectionRepo.addWorkflow).toHaveBeenCalledWith(collectionId, workflowId);
    });

    it('should throw error if collection not found', async () => {
      const collectionId = 'non-existent';
      const workflowId = 'workflow-123';
      const userId = 'user-123';

      mockCollectionRepo.findById.mockResolvedValue(null);

      await expect(
        collectionService.addWorkflowToCollection(collectionId, workflowId, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.COLLECTION_NOT_FOUND,
        message: 'Collection not found'
      });

      expect(mockCollectionRepo.addWorkflow).not.toHaveBeenCalled();
    });

    it('should throw error if user is not authorized', async () => {
      const collectionId = 'collection-123';
      const workflowId = 'workflow-123';
      const userId = 'user-123';

      const collection: WorkflowCollection = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test description',
        createdBy: 'different-user',
        isPublic: true,
        workflowIds: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.findById.mockResolvedValue(collection);

      await expect(
        collectionService.addWorkflowToCollection(collectionId, workflowId, userId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.UNAUTHORIZED_PUBLISH,
        message: 'Not authorized to modify this collection'
      });

      expect(mockCollectionRepo.addWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('removeWorkflowFromCollection', () => {
    it('should remove workflow from collection successfully', async () => {
      const collectionId = 'collection-123';
      const workflowId = 'workflow-123';
      const userId = 'user-123';

      const collection: WorkflowCollection = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test description',
        createdBy: userId,
        isPublic: true,
        workflowIds: [workflowId],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCollectionRepo.findById.mockResolvedValue(collection);
      mockCollectionRepo.removeWorkflow.mockResolvedValue(undefined);

      await collectionService.removeWorkflowFromCollection(collectionId, workflowId, userId);

      expect(mockCollectionRepo.findById).toHaveBeenCalledWith(collectionId);
      expect(mockCollectionRepo.removeWorkflow).toHaveBeenCalledWith(collectionId, workflowId);
    });
  });

  describe('getCollectionWorkflows', () => {
    it('should get workflows in collection', async () => {
      const collectionId = 'collection-123';
      const collection: WorkflowCollection = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test description',
        createdBy: 'user-123',
        isPublic: true,
        workflowIds: ['workflow-1', 'workflow-2'],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const workflows = [
        {
          id: 'workflow-1',
          workflowId: 'wf-1',
          name: 'Workflow 1',
          description: 'First workflow',
          engineType: 'langflow' as any,
          category: 'ai_ml' as any,
          tags: [],
          publishedBy: 'user-1',
          organizationId: 'org-1',
          version: '1.0.0',
          isPublic: true,
          isPremium: false,
          downloadCount: 0,
          averageRating: 0,
          totalRatings: 0,
          publishedAt: new Date(),
          updatedAt: new Date(),
          metadata: {}
        }
      ];

      mockCollectionRepo.findById.mockResolvedValue(collection);
      mockCollectionRepo.getWorkflows.mockResolvedValue(workflows);

      const result = await collectionService.getCollectionWorkflows(collectionId);

      expect(mockCollectionRepo.findById).toHaveBeenCalledWith(collectionId);
      expect(mockCollectionRepo.getWorkflows).toHaveBeenCalledWith(collectionId);
      expect(result).toEqual(workflows);
    });

    it('should throw error if collection not found', async () => {
      const collectionId = 'non-existent';
      mockCollectionRepo.findById.mockResolvedValue(null);

      await expect(
        collectionService.getCollectionWorkflows(collectionId)
      ).rejects.toMatchObject({
        code: MarketplaceErrorCode.COLLECTION_NOT_FOUND,
        message: 'Collection not found'
      });

      expect(mockCollectionRepo.getWorkflows).not.toHaveBeenCalled();
    });
  });
});