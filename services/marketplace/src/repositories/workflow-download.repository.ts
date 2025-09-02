import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowDownload } from '../types/marketplace.types';
import { IWorkflowDownloadRepository } from './interfaces/marketplace.repository.interface';

export class WorkflowDownloadRepository implements IWorkflowDownloadRepository {
  constructor(private pool: Pool) {}

  async create(download: Omit<WorkflowDownload, 'id' | 'downloadedAt'>): Promise<WorkflowDownload> {
    const id = uuidv4();
    const downloadedAt = new Date();
    
    const query = `
      INSERT INTO workflow_downloads (id, workflow_id, user_id, downloaded_at, version, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      id,
      download.workflowId,
      download.userId,
      downloadedAt,
      download.version,
      download.ipAddress,
      download.userAgent
    ];
    
    const result = await this.pool.query(query, values);
    return this.mapRowToDownload(result.rows[0]);
  }

  async findById(id: string): Promise<WorkflowDownload | null> {
    const query = 'SELECT * FROM workflow_downloads WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDownload(result.rows[0]);
  }

  async findByWorkflowId(workflowId: string, limit = 20, offset = 0): Promise<WorkflowDownload[]> {
    const query = `
      SELECT wd.*, u.name as user_name, u.email as user_email
      FROM workflow_downloads wd
      LEFT JOIN users u ON wd.user_id = u.id
      WHERE wd.workflow_id = $1
      ORDER BY wd.downloaded_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.pool.query(query, [workflowId, limit, offset]);
    return result.rows.map(row => this.mapRowToDownload(row));
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<WorkflowDownload[]> {
    const query = `
      SELECT wd.*, mw.name as workflow_name
      FROM workflow_downloads wd
      LEFT JOIN marketplace_workflows mw ON wd.workflow_id = mw.id
      WHERE wd.user_id = $1
      ORDER BY wd.downloaded_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.pool.query(query, [userId, limit, offset]);
    return result.rows.map(row => this.mapRowToDownload(row));
  }

  async getDownloadCount(workflowId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM workflow_downloads WHERE workflow_id = $1';
    const result = await this.pool.query(query, [workflowId]);
    return parseInt(result.rows[0].count);
  }

  async getDownloadStats(workflowId: string, days = 30): Promise<Record<string, number>> {
    const query = `
      SELECT 
        DATE(downloaded_at) as date,
        COUNT(*) as count
      FROM workflow_downloads 
      WHERE workflow_id = $1 
        AND downloaded_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(downloaded_at)
      ORDER BY date
    `;
    
    const result = await this.pool.query(query, [workflowId]);
    
    const stats: Record<string, number> = {};
    result.rows.forEach(row => {
      stats[row.date] = parseInt(row.count);
    });
    
    return stats;
  }

  private mapRowToDownload(row: any): WorkflowDownload {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      downloadedAt: new Date(row.downloaded_at),
      version: row.version,
      ipAddress: row.ip_address,
      userAgent: row.user_agent
    };
  }
}