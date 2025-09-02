import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowRating } from '../types/marketplace.types';
import { IWorkflowRatingRepository } from './interfaces/marketplace.repository.interface';

export class WorkflowRatingRepository implements IWorkflowRatingRepository {
  constructor(private pool: Pool) {}

  async create(rating: Omit<WorkflowRating, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowRating> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO workflow_ratings (id, workflow_id, user_id, rating, review, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [id, rating.workflowId, rating.userId, rating.rating, rating.review, now, now];
    const result = await this.pool.query(query, values);
    
    return this.mapRowToRating(result.rows[0]);
  }

  async findById(id: string): Promise<WorkflowRating | null> {
    const query = 'SELECT * FROM workflow_ratings WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToRating(result.rows[0]);
  }

  async findByWorkflowId(workflowId: string, limit = 20, offset = 0): Promise<WorkflowRating[]> {
    const query = `
      SELECT wr.*, u.name as user_name, u.email as user_email
      FROM workflow_ratings wr
      LEFT JOIN users u ON wr.user_id = u.id
      WHERE wr.workflow_id = $1
      ORDER BY wr.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.pool.query(query, [workflowId, limit, offset]);
    return result.rows.map(row => this.mapRowToRating(row));
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<WorkflowRating[]> {
    const query = `
      SELECT wr.*, mw.name as workflow_name
      FROM workflow_ratings wr
      LEFT JOIN marketplace_workflows mw ON wr.workflow_id = mw.id
      WHERE wr.user_id = $1
      ORDER BY wr.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.pool.query(query, [userId, limit, offset]);
    return result.rows.map(row => this.mapRowToRating(row));
  }

  async findByUserAndWorkflow(userId: string, workflowId: string): Promise<WorkflowRating | null> {
    const query = 'SELECT * FROM workflow_ratings WHERE user_id = $1 AND workflow_id = $2';
    const result = await this.pool.query(query, [userId, workflowId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToRating(result.rows[0]);
  }

  async update(id: string, updates: Partial<WorkflowRating>): Promise<WorkflowRating> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'createdAt') {
        const dbColumn = this.camelToSnake(key);
        setClause.push(`${dbColumn} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    setClause.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE workflow_ratings 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.mapRowToRating(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM workflow_ratings WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  async getAverageRating(workflowId: string): Promise<{ average: number; total: number }> {
    const query = `
      SELECT 
        AVG(rating) as average,
        COUNT(*) as total
      FROM workflow_ratings 
      WHERE workflow_id = $1
    `;
    
    const result = await this.pool.query(query, [workflowId]);
    const row = result.rows[0];
    
    return {
      average: parseFloat(row.average) || 0,
      total: parseInt(row.total) || 0
    };
  }

  async getRatingDistribution(workflowId: string): Promise<Record<number, number>> {
    const query = `
      SELECT rating, COUNT(*) as count
      FROM workflow_ratings 
      WHERE workflow_id = $1
      GROUP BY rating
      ORDER BY rating
    `;
    
    const result = await this.pool.query(query, [workflowId]);
    
    // Initialize distribution with zeros
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    result.rows.forEach(row => {
      distribution[row.rating] = parseInt(row.count);
    });
    
    return distribution;
  }

  private mapRowToRating(row: any): WorkflowRating {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      rating: row.rating,
      review: row.review,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}