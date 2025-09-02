import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowCollection, MarketplaceWorkflow } from '../types/marketplace.types';
import { IWorkflowCollectionRepository } from './interfaces/marketplace.repository.interface';

export class WorkflowCollectionRepository implements IWorkflowCollectionRepository {
  constructor(private pool: Pool) {}

  async create(collection: Omit<WorkflowCollection, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowCollection> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO workflow_collections (id, name, description, created_by, is_public, workflow_ids, tags, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      id,
      collection.name,
      collection.description,
      collection.createdBy,
      collection.isPublic,
      JSON.stringify(collection.workflowIds),
      JSON.stringify(collection.tags),
      now,
      now
    ];
    
    const result = await this.pool.query(query, values);
    return this.mapRowToCollection(result.rows[0]);
  }

  async findById(id: string): Promise<WorkflowCollection | null> {
    const query = 'SELECT * FROM workflow_collections WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToCollection(result.rows[0]);
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<WorkflowCollection[]> {
    const query = `
      SELECT * FROM workflow_collections 
      WHERE created_by = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.pool.query(query, [userId, limit, offset]);
    return result.rows.map(row => this.mapRowToCollection(row));
  }

  async findPublic(limit = 20, offset = 0): Promise<WorkflowCollection[]> {
    const query = `
      SELECT wc.*, u.name as creator_name
      FROM workflow_collections wc
      LEFT JOIN users u ON wc.created_by = u.id
      WHERE wc.is_public = true
      ORDER BY wc.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await this.pool.query(query, [limit, offset]);
    return result.rows.map(row => this.mapRowToCollection(row));
  }

  async update(id: string, updates: Partial<WorkflowCollection>): Promise<WorkflowCollection> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'createdAt') {
        const dbColumn = this.camelToSnake(key);
        if (key === 'workflowIds' || key === 'tags') {
          setClause.push(`${dbColumn} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${dbColumn} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    });

    setClause.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE workflow_collections 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.mapRowToCollection(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM workflow_collections WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  async addWorkflow(collectionId: string, workflowId: string): Promise<void> {
    // First get current workflow IDs
    const selectQuery = 'SELECT workflow_ids FROM workflow_collections WHERE id = $1';
    const selectResult = await this.pool.query(selectQuery, [collectionId]);
    
    if (selectResult.rows.length === 0) {
      throw new Error('Collection not found');
    }
    
    const currentIds = JSON.parse(selectResult.rows[0].workflow_ids || '[]');
    
    // Add new workflow ID if not already present
    if (!currentIds.includes(workflowId)) {
      currentIds.push(workflowId);
      
      const updateQuery = `
        UPDATE workflow_collections 
        SET workflow_ids = $1, updated_at = NOW()
        WHERE id = $2
      `;
      
      await this.pool.query(updateQuery, [JSON.stringify(currentIds), collectionId]);
    }
  }

  async removeWorkflow(collectionId: string, workflowId: string): Promise<void> {
    // First get current workflow IDs
    const selectQuery = 'SELECT workflow_ids FROM workflow_collections WHERE id = $1';
    const selectResult = await this.pool.query(selectQuery, [collectionId]);
    
    if (selectResult.rows.length === 0) {
      throw new Error('Collection not found');
    }
    
    const currentIds = JSON.parse(selectResult.rows[0].workflow_ids || '[]');
    
    // Remove workflow ID
    const updatedIds = currentIds.filter((id: string) => id !== workflowId);
    
    const updateQuery = `
      UPDATE workflow_collections 
      SET workflow_ids = $1, updated_at = NOW()
      WHERE id = $2
    `;
    
    await this.pool.query(updateQuery, [JSON.stringify(updatedIds), collectionId]);
  }

  async getWorkflows(collectionId: string): Promise<MarketplaceWorkflow[]> {
    const query = `
      SELECT mw.*
      FROM workflow_collections wc,
           jsonb_array_elements_text(wc.workflow_ids) as workflow_id
      JOIN marketplace_workflows mw ON mw.id = workflow_id::text
      WHERE wc.id = $1
      ORDER BY mw.name
    `;
    
    const result = await this.pool.query(query, [collectionId]);
    return result.rows.map(row => this.mapRowToWorkflow(row));
  }

  private mapRowToCollection(row: any): WorkflowCollection {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      isPublic: row.is_public,
      workflowIds: JSON.parse(row.workflow_ids || '[]'),
      tags: JSON.parse(row.tags || '[]'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToWorkflow(row: any): MarketplaceWorkflow {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      name: row.name,
      description: row.description,
      engineType: row.engine_type,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      publishedBy: row.published_by,
      organizationId: row.organization_id,
      version: row.version,
      isPublic: row.is_public,
      isPremium: row.is_premium,
      price: row.price,
      downloadCount: row.download_count,
      averageRating: parseFloat(row.average_rating) || 0,
      totalRatings: row.total_ratings,
      publishedAt: new Date(row.published_at),
      updatedAt: new Date(row.updated_at),
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}