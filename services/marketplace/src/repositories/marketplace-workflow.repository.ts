import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  MarketplaceWorkflow,
  WorkflowSearchRequest,
  WorkflowSearchResponse,
  MarketplaceStats,
  WorkflowCategory,
  WorkflowSortBy,
  SearchFacets,
  CategoryFacet,
  TagFacet,
  EngineTypeFacet,
  PriceRangeFacet
} from '../types/marketplace.types';
import { IMarketplaceWorkflowRepository } from './interfaces/marketplace.repository.interface';
import { EngineType } from '@robust-ai-orchestrator/shared';

export class MarketplaceWorkflowRepository implements IMarketplaceWorkflowRepository {
  constructor(private pool: Pool) {}

  async create(workflow: Omit<MarketplaceWorkflow, 'id' | 'publishedAt' | 'updatedAt'>): Promise<MarketplaceWorkflow> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO marketplace_workflows (
        id, workflow_id, name, description, engine_type, category, tags,
        published_by, organization_id, version, is_public, is_premium, price,
        download_count, average_rating, total_ratings, published_at, updated_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;
    
    const values = [
      id,
      workflow.workflowId,
      workflow.name,
      workflow.description,
      workflow.engineType,
      workflow.category,
      JSON.stringify(workflow.tags),
      workflow.publishedBy,
      workflow.organizationId,
      workflow.version,
      workflow.isPublic,
      workflow.isPremium,
      workflow.price || null,
      workflow.downloadCount,
      workflow.averageRating,
      workflow.totalRatings,
      now,
      now,
      JSON.stringify(workflow.metadata)
    ];
    
    const result = await this.pool.query(query, values);
    return this.mapRowToWorkflow(result.rows[0]);
  }

  async findById(id: string): Promise<MarketplaceWorkflow | null> {
    const query = 'SELECT * FROM marketplace_workflows WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToWorkflow(result.rows[0]);
  }

  async findByWorkflowId(workflowId: string): Promise<MarketplaceWorkflow | null> {
    const query = 'SELECT * FROM marketplace_workflows WHERE workflow_id = $1';
    const result = await this.pool.query(query, [workflowId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToWorkflow(result.rows[0]);
  }

  async update(id: string, updates: Partial<MarketplaceWorkflow>): Promise<MarketplaceWorkflow> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'publishedAt') {
        const dbColumn = this.camelToSnake(key);
        if (key === 'tags' || key === 'metadata') {
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
      UPDATE marketplace_workflows 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.mapRowToWorkflow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM marketplace_workflows WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  async search(request: WorkflowSearchRequest): Promise<WorkflowSearchResponse> {
    const { query, category, tags, engineType, isPremium, minRating, sortBy, sortOrder, limit = 20, offset = 0 } = request;
    
    let whereClause = 'WHERE is_public = true';
    const values: any[] = [];
    let paramIndex = 1;

    // Build search conditions
    if (query) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      values.push(`%${query}%`);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      values.push(category);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      whereClause += ` AND tags::jsonb ?| $${paramIndex}`;
      values.push(tags);
      paramIndex++;
    }

    if (engineType) {
      whereClause += ` AND engine_type = $${paramIndex}`;
      values.push(engineType);
      paramIndex++;
    }

    if (isPremium !== undefined) {
      whereClause += ` AND is_premium = $${paramIndex}`;
      values.push(isPremium);
      paramIndex++;
    }

    if (minRating) {
      whereClause += ` AND average_rating >= $${paramIndex}`;
      values.push(minRating);
      paramIndex++;
    }

    // Build sort clause
    const sortColumn = this.getSortColumn(sortBy || WorkflowSortBy.PUBLISHED_AT);
    const order = sortOrder || 'desc';
    const orderClause = `ORDER BY ${sortColumn} ${order.toUpperCase()}`;

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM marketplace_workflows ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get workflows
    const workflowQuery = `
      SELECT * FROM marketplace_workflows 
      ${whereClause} 
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(limit, offset);

    const workflowResult = await this.pool.query(workflowQuery, values);
    const workflows = workflowResult.rows.map(row => this.mapRowToWorkflow(row));

    // Get facets
    const facets = await this.getFacets(request);

    return {
      workflows,
      total,
      hasMore: offset + limit < total,
      facets
    };
  }

  async findByCategory(category: string, limit = 20, offset = 0): Promise<MarketplaceWorkflow[]> {
    const query = `
      SELECT * FROM marketplace_workflows 
      WHERE category = $1 AND is_public = true
      ORDER BY published_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.pool.query(query, [category, limit, offset]);
    return result.rows.map(row => this.mapRowToWorkflow(row));
  }

  async findByTags(tags: string[], limit = 20, offset = 0): Promise<MarketplaceWorkflow[]> {
    const query = `
      SELECT * FROM marketplace_workflows 
      WHERE tags::jsonb ?| $1 AND is_public = true
      ORDER BY published_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.pool.query(query, [tags, limit, offset]);
    return result.rows.map(row => this.mapRowToWorkflow(row));
  }

  async findTrending(limit = 10): Promise<MarketplaceWorkflow[]> {
    // Trending based on recent downloads and ratings
    const query = `
      SELECT mw.* FROM marketplace_workflows mw
      LEFT JOIN (
        SELECT workflow_id, COUNT(*) as recent_downloads
        FROM workflow_downloads 
        WHERE downloaded_at >= NOW() - INTERVAL '7 days'
        GROUP BY workflow_id
      ) rd ON mw.id = rd.workflow_id
      WHERE mw.is_public = true
      ORDER BY 
        COALESCE(rd.recent_downloads, 0) * 0.7 + 
        mw.average_rating * mw.total_ratings * 0.3 DESC
      LIMIT $1
    `;
    
    const result = await this.pool.query(query, [limit]);
    return result.rows.map(row => this.mapRowToWorkflow(row));
  }

  async findPopular(limit = 10): Promise<MarketplaceWorkflow[]> {
    const query = `
      SELECT * FROM marketplace_workflows 
      WHERE is_public = true
      ORDER BY download_count DESC, average_rating DESC
      LIMIT $1
    `;
    
    const result = await this.pool.query(query, [limit]);
    return result.rows.map(row => this.mapRowToWorkflow(row));
  }

  async getStats(): Promise<MarketplaceStats> {
    // Get basic stats
    const basicStatsQuery = `
      SELECT 
        COUNT(*) as total_workflows,
        SUM(download_count) as total_downloads,
        SUM(total_ratings) as total_ratings,
        AVG(average_rating) as average_rating
      FROM marketplace_workflows 
      WHERE is_public = true
    `;
    
    const basicResult = await this.pool.query(basicStatsQuery);
    const basicStats = basicResult.rows[0];

    // Get workflows by category
    const categoryQuery = `
      SELECT category, COUNT(*) as count
      FROM marketplace_workflows 
      WHERE is_public = true
      GROUP BY category
    `;
    const categoryResult = await this.pool.query(categoryQuery);
    const workflowsByCategory = categoryResult.rows.reduce((acc, row) => {
      acc[row.category] = parseInt(row.count);
      return acc;
    }, {} as Record<WorkflowCategory, number>);

    // Get workflows by engine
    const engineQuery = `
      SELECT engine_type, COUNT(*) as count
      FROM marketplace_workflows 
      WHERE is_public = true
      GROUP BY engine_type
    `;
    const engineResult = await this.pool.query(engineQuery);
    const workflowsByEngine = engineResult.rows.reduce((acc, row) => {
      acc[row.engine_type] = parseInt(row.count);
      return acc;
    }, {} as Record<EngineType, number>);

    // Get top tags
    const tagsQuery = `
      SELECT tag, COUNT(*) as count
      FROM marketplace_workflows, jsonb_array_elements_text(tags) as tag
      WHERE is_public = true
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 20
    `;
    const tagsResult = await this.pool.query(tagsQuery);
    const topTags = tagsResult.rows.map(row => ({
      tag: row.tag,
      count: parseInt(row.count)
    }));

    // Get trending workflows
    const trendingWorkflows = await this.findTrending(5);

    return {
      totalWorkflows: parseInt(basicStats.total_workflows),
      totalDownloads: parseInt(basicStats.total_downloads) || 0,
      totalRatings: parseInt(basicStats.total_ratings) || 0,
      averageRating: parseFloat(basicStats.average_rating) || 0,
      workflowsByCategory,
      workflowsByEngine,
      topTags,
      trendingWorkflows
    };
  }

  async incrementDownloadCount(id: string): Promise<void> {
    const query = `
      UPDATE marketplace_workflows 
      SET download_count = download_count + 1, updated_at = NOW()
      WHERE id = $1
    `;
    await this.pool.query(query, [id]);
  }

  async updateRating(id: string, averageRating: number, totalRatings: number): Promise<void> {
    const query = `
      UPDATE marketplace_workflows 
      SET average_rating = $2, total_ratings = $3, updated_at = NOW()
      WHERE id = $1
    `;
    await this.pool.query(query, [id, averageRating, totalRatings]);
  }

  private async getFacets(request: WorkflowSearchRequest): Promise<SearchFacets> {
    // This is a simplified implementation - in production, you'd want to optimize these queries
    const categoriesQuery = `
      SELECT category, COUNT(*) as count
      FROM marketplace_workflows 
      WHERE is_public = true
      GROUP BY category
      ORDER BY count DESC
    `;
    const categoriesResult = await this.pool.query(categoriesQuery);
    const categories: CategoryFacet[] = categoriesResult.rows.map(row => ({
      category: row.category,
      count: parseInt(row.count)
    }));

    const tagsQuery = `
      SELECT tag, COUNT(*) as count
      FROM marketplace_workflows, jsonb_array_elements_text(tags) as tag
      WHERE is_public = true
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 50
    `;
    const tagsResult = await this.pool.query(tagsQuery);
    const tags: TagFacet[] = tagsResult.rows.map(row => ({
      tag: row.tag,
      count: parseInt(row.count)
    }));

    const engineTypesQuery = `
      SELECT engine_type, COUNT(*) as count
      FROM marketplace_workflows 
      WHERE is_public = true
      GROUP BY engine_type
    `;
    const engineTypesResult = await this.pool.query(engineTypesQuery);
    const engineTypes: EngineTypeFacet[] = engineTypesResult.rows.map(row => ({
      engineType: row.engine_type,
      count: parseInt(row.count)
    }));

    // Price ranges for premium workflows
    const priceRangesQuery = `
      SELECT 
        CASE 
          WHEN price = 0 THEN 'Free'
          WHEN price <= 500 THEN '$0-$5'
          WHEN price <= 1000 THEN '$5-$10'
          WHEN price <= 2500 THEN '$10-$25'
          ELSE '$25+'
        END as range,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(*) as count
      FROM marketplace_workflows 
      WHERE is_public = true AND price IS NOT NULL
      GROUP BY 1
      ORDER BY min_price
    `;
    const priceRangesResult = await this.pool.query(priceRangesQuery);
    const priceRanges: PriceRangeFacet[] = priceRangesResult.rows.map(row => ({
      range: row.range,
      min: parseInt(row.min_price) || 0,
      max: parseInt(row.max_price) || 0,
      count: parseInt(row.count)
    }));

    return {
      categories,
      tags,
      engineTypes,
      priceRanges
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

  private getSortColumn(sortBy: WorkflowSortBy): string {
    const mapping = {
      [WorkflowSortBy.NAME]: 'name',
      [WorkflowSortBy.PUBLISHED_AT]: 'published_at',
      [WorkflowSortBy.UPDATED_AT]: 'updated_at',
      [WorkflowSortBy.DOWNLOAD_COUNT]: 'download_count',
      [WorkflowSortBy.AVERAGE_RATING]: 'average_rating',
      [WorkflowSortBy.PRICE]: 'price'
    };
    return mapping[sortBy] || 'published_at';
  }
}