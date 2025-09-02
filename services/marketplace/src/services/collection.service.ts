import {
  WorkflowCollection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  MarketplaceWorkflow,
  MarketplaceError,
  MarketplaceErrorCode
} from '../types/marketplace.types';
import { IWorkflowCollectionRepository } from '../repositories/interfaces/marketplace.repository.interface';

export class CollectionService {
  constructor(private collectionRepo: IWorkflowCollectionRepository) {}

  async createCollection(request: CreateCollectionRequest, userId: string): Promise<WorkflowCollection> {
    const collection: Omit<WorkflowCollection, 'id' | 'createdAt' | 'updatedAt'> = {
      name: request.name,
      description: request.description,
      createdBy: userId,
      isPublic: request.isPublic,
      workflowIds: request.workflowIds || [],
      tags: request.tags || []
    };

    return await this.collectionRepo.create(collection);
  }

  async updateCollection(
    collectionId: string,
    request: UpdateCollectionRequest,
    userId: string
  ): Promise<WorkflowCollection> {
    const collection = await this.collectionRepo.findById(collectionId);
    if (!collection) {
      throw this.createError(MarketplaceErrorCode.COLLECTION_NOT_FOUND, 'Collection not found');
    }

    // Check if user has permission to update
    if (collection.createdBy !== userId) {
      throw this.createError(MarketplaceErrorCode.UNAUTHORIZED_PUBLISH, 'Not authorized to update this collection');
    }

    return await this.collectionRepo.update(collectionId, request);
  }

  async deleteCollection(collectionId: string, userId: string): Promise<boolean> {
    const collection = await this.collectionRepo.findById(collectionId);
    if (!collection) {
      throw this.createError(MarketplaceErrorCode.COLLECTION_NOT_FOUND, 'Collection not found');
    }

    // Check if user has permission to delete
    if (collection.createdBy !== userId) {
      throw this.createError(MarketplaceErrorCode.UNAUTHORIZED_PUBLISH, 'Not authorized to delete this collection');
    }

    return await this.collectionRepo.delete(collectionId);
  }

  async getCollection(collectionId: string): Promise<WorkflowCollection | null> {
    return await this.collectionRepo.findById(collectionId);
  }

  async getUserCollections(userId: string, limit = 20, offset = 0): Promise<WorkflowCollection[]> {
    return await this.collectionRepo.findByUserId(userId, limit, offset);
  }

  async getPublicCollections(limit = 20, offset = 0): Promise<WorkflowCollection[]> {
    return await this.collectionRepo.findPublic(limit, offset);
  }

  async addWorkflowToCollection(collectionId: string, workflowId: string, userId: string): Promise<void> {
    const collection = await this.collectionRepo.findById(collectionId);
    if (!collection) {
      throw this.createError(MarketplaceErrorCode.COLLECTION_NOT_FOUND, 'Collection not found');
    }

    // Check if user has permission to modify
    if (collection.createdBy !== userId) {
      throw this.createError(MarketplaceErrorCode.UNAUTHORIZED_PUBLISH, 'Not authorized to modify this collection');
    }

    await this.collectionRepo.addWorkflow(collectionId, workflowId);
  }

  async removeWorkflowFromCollection(collectionId: string, workflowId: string, userId: string): Promise<void> {
    const collection = await this.collectionRepo.findById(collectionId);
    if (!collection) {
      throw this.createError(MarketplaceErrorCode.COLLECTION_NOT_FOUND, 'Collection not found');
    }

    // Check if user has permission to modify
    if (collection.createdBy !== userId) {
      throw this.createError(MarketplaceErrorCode.UNAUTHORIZED_PUBLISH, 'Not authorized to modify this collection');
    }

    await this.collectionRepo.removeWorkflow(collectionId, workflowId);
  }

  async getCollectionWorkflows(collectionId: string): Promise<MarketplaceWorkflow[]> {
    const collection = await this.collectionRepo.findById(collectionId);
    if (!collection) {
      throw this.createError(MarketplaceErrorCode.COLLECTION_NOT_FOUND, 'Collection not found');
    }

    return await this.collectionRepo.getWorkflows(collectionId);
  }

  private createError(code: MarketplaceErrorCode, message: string, details?: any): MarketplaceError {
    return {
      code,
      message,
      details
    } as MarketplaceError;
  }
}