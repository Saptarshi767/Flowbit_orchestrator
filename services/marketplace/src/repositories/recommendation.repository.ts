import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowRecommendation, RecommendationReason } from '../types/marketplace.types';
import { IRecommendationRepository } from './interfaces/marketplace.repository.interface';

export class RecommendationRepository implements IRecommendationRepository {
  constructor(private pool: Pool) {}

  async getRecommendations(userId: string, limit = 10): Promise<WorkflowRecommendation[]> {
    // Combine multiple recommendation strategies
    const recommendations: WorkflowRecommendation[] = [];
    
    // Get user's interaction history to understand preferences
    const userHistory = await this.getUserInteractionHistory(userId, 50);
    
    if (userHistory.length > 0) {
      // Content-based recommendations based on user's past interactions
      const contentBased = await this.getContentBasedRecommendations(userId, Math.ceil(limit * 0.4));
      recommendations.push(...contentBased);
      
      // Collaborative filtering recommendations
      const collaborative = await this.getCollaborativeRecommendations(userId, Math.ceil(limit * 0.3));
      recommendations.push(...collaborative);
    }
    
    // Popular workflows in user's organization
    const orgPopular = await this.getOrganizationPopularRecommendations(userId, Math.ceil(limit * 0.2));
    recommendations.push(...orgPopular);
    
    // Trending workflows
    const trending = await this.getTrendingRecommendations(Math.ceil(limit * 0.1));
    recommendations.push(...trending);
    
    // Remove duplicates and sort by score
    const uniqueRecommendations = this.removeDuplicates(recommendations);
    return uniqueRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getSimilarWorkflows(workflowId: string, limit = 10): Promise<WorkflowRecommendation[]> {
    // Get workflow details
    const workflowQuery = `
      SELECT category, tags, engine_type 
      FROM marketplace_workflows 
      WHERE id = $1
    `;
    const workflowResult = await this.pool.query(workflowQuery, [workflowId]);
    
    if (workflowResult.rows.length === 0) {
      return [];
    }
    
    const workflow = workflowResult.rows[0];
    const tags = JSON.parse(workflow.tags || '[]');
    
    // Find similar workflows based on category, tags, and engine type
    const similarQuery = `
      SELECT 
        id,
        name,
        category,
        tags,
        engine_type,
        average_rating,
        download_count,
        CASE 
          WHEN category = $2 THEN 0.4
          ELSE 0
        END +
        CASE 
          WHEN engine_type = $3 THEN 0.3
          ELSE 0
        END +
        (
          SELECT COUNT(*) * 0.1
          FROM jsonb_array_elements_text(tags) as tag
          WHERE tag = ANY($4)
        ) +
        (average_rating / 5.0) * 0.1 +
        (LEAST(download_count, 1000) / 1000.0) * 0.1 as similarity_score
      FROM marketplace_workflows
      WHERE id != $1 AND is_public = true
      HAVING similarity_score > 0.2
      ORDER BY similarity_score DESC
      LIMIT $5
    `;
    
    const result = await this.pool.query(similarQuery, [
      workflowId,
      workflow.category,
      workflow.engine_type,
      tags,
      limit
    ]);
    
    return result.rows.map(row => ({
      workflowId: row.id,
      score: parseFloat(row.similarity_score),
      reason: RecommendationReason.CONTENT_BASED,
      metadata: {
        category: row.category,
        engineType: row.engine_type,
        averageRating: row.average_rating,
        downloadCount: row.download_count
      }
    }));
  }

  async getTrendingInCategory(category: string, limit = 10): Promise<WorkflowRecommendation[]> {
    const query = `
      SELECT 
        mw.id,
        mw.name,
        mw.average_rating,
        mw.download_count,
        COALESCE(recent_downloads.count, 0) as recent_downloads
      FROM marketplace_workflows mw
      LEFT JOIN (
        SELECT workflow_id, COUNT(*) as count
        FROM workflow_downloads 
        WHERE downloaded_at >= NOW() - INTERVAL '7 days'
        GROUP BY workflow_id
      ) recent_downloads ON mw.id = recent_downloads.workflow_id
      WHERE mw.category = $1 AND mw.is_public = true
      ORDER BY 
        recent_downloads * 0.6 + 
        (mw.average_rating * mw.total_ratings) * 0.4 DESC
      LIMIT $2
    `;
    
    const result = await this.pool.query(query, [category, limit]);
    
    return result.rows.map(row => ({
      workflowId: row.id,
      score: parseFloat(row.recent_downloads) * 0.6 + (row.average_rating * 0.4),
      reason: RecommendationReason.TRENDING,
      metadata: {
        category,
        recentDownloads: row.recent_downloads,
        averageRating: row.average_rating,
        downloadCount: row.download_count
      }
    }));
  }

  async getPopularInOrganization(organizationId: string, limit = 10): Promise<WorkflowRecommendation[]> {
    const query = `
      SELECT 
        mw.id,
        mw.name,
        COUNT(wd.id) as org_downloads,
        mw.average_rating,
        mw.download_count
      FROM marketplace_workflows mw
      JOIN workflow_downloads wd ON mw.id = wd.workflow_id
      JOIN users u ON wd.user_id = u.id
      WHERE u.organization_id = $1 AND mw.is_public = true
      GROUP BY mw.id, mw.name, mw.average_rating, mw.download_count
      ORDER BY org_downloads DESC, mw.average_rating DESC
      LIMIT $2
    `;
    
    const result = await this.pool.query(query, [organizationId, limit]);
    
    return result.rows.map(row => ({
      workflowId: row.id,
      score: parseInt(row.org_downloads) * 0.8 + (row.average_rating * 0.2),
      reason: RecommendationReason.POPULAR_IN_ORGANIZATION,
      metadata: {
        organizationDownloads: row.org_downloads,
        averageRating: row.average_rating,
        totalDownloads: row.download_count
      }
    }));
  }

  async trackUserInteraction(userId: string, workflowId: string, interactionType: string): Promise<void> {
    const id = uuidv4();
    const query = `
      INSERT INTO user_workflow_interactions (id, user_id, workflow_id, interaction_type, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, workflow_id, interaction_type) 
      DO UPDATE SET created_at = NOW()
    `;
    
    await this.pool.query(query, [id, userId, workflowId, interactionType]);
  }

  async getUserInteractionHistory(userId: string, limit = 50): Promise<any[]> {
    const query = `
      SELECT 
        uwi.*,
        mw.category,
        mw.tags,
        mw.engine_type
      FROM user_workflow_interactions uwi
      JOIN marketplace_workflows mw ON uwi.workflow_id = mw.id
      WHERE uwi.user_id = $1
      ORDER BY uwi.created_at DESC
      LIMIT $2
    `;
    
    const result = await this.pool.query(query, [userId, limit]);
    return result.rows.map(row => ({
      workflowId: row.workflow_id,
      interactionType: row.interaction_type,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      engineType: row.engine_type,
      createdAt: row.created_at
    }));
  }

  private async getContentBasedRecommendations(userId: string, limit: number): Promise<WorkflowRecommendation[]> {
    // Get user's preferred categories and tags from interaction history
    const preferencesQuery = `
      SELECT 
        mw.category,
        tag,
        mw.engine_type,
        COUNT(*) as interaction_count
      FROM user_workflow_interactions uwi
      JOIN marketplace_workflows mw ON uwi.workflow_id = mw.id,
           jsonb_array_elements_text(mw.tags) as tag
      WHERE uwi.user_id = $1
      GROUP BY mw.category, tag, mw.engine_type
      ORDER BY interaction_count DESC
    `;
    
    const preferencesResult = await this.pool.query(preferencesQuery, [userId]);
    
    if (preferencesResult.rows.length === 0) {
      return [];
    }
    
    // Get top categories and tags
    const topCategories = preferencesResult.rows.slice(0, 3).map(row => row.category);
    const topTags = preferencesResult.rows.slice(0, 10).map(row => row.tag);
    
    // Find workflows matching user preferences
    const recommendationQuery = `
      SELECT 
        mw.id,
        mw.name,
        mw.category,
        mw.average_rating,
        mw.download_count,
        CASE 
          WHEN mw.category = ANY($2) THEN 0.5
          ELSE 0
        END +
        (
          SELECT COUNT(*) * 0.1
          FROM jsonb_array_elements_text(mw.tags) as tag
          WHERE tag = ANY($3)
        ) +
        (mw.average_rating / 5.0) * 0.2 +
        (LEAST(mw.download_count, 1000) / 1000.0) * 0.2 as content_score
      FROM marketplace_workflows mw
      WHERE mw.is_public = true
        AND mw.id NOT IN (
          SELECT workflow_id FROM user_workflow_interactions WHERE user_id = $1
        )
      HAVING content_score > 0.3
      ORDER BY content_score DESC
      LIMIT $4
    `;
    
    const result = await this.pool.query(recommendationQuery, [userId, topCategories, topTags, limit]);
    
    return result.rows.map(row => ({
      workflowId: row.id,
      score: parseFloat(row.content_score),
      reason: RecommendationReason.CONTENT_BASED,
      metadata: {
        category: row.category,
        averageRating: row.average_rating,
        downloadCount: row.download_count
      }
    }));
  }

  private async getCollaborativeRecommendations(userId: string, limit: number): Promise<WorkflowRecommendation[]> {
    // Find users with similar interaction patterns
    const similarUsersQuery = `
      SELECT 
        u2.user_id,
        COUNT(*) as common_interactions
      FROM user_workflow_interactions u1
      JOIN user_workflow_interactions u2 ON u1.workflow_id = u2.workflow_id
      WHERE u1.user_id = $1 AND u2.user_id != $1
      GROUP BY u2.user_id
      HAVING COUNT(*) >= 2
      ORDER BY common_interactions DESC
      LIMIT 10
    `;
    
    const similarUsersResult = await this.pool.query(similarUsersQuery, [userId]);
    
    if (similarUsersResult.rows.length === 0) {
      return [];
    }
    
    const similarUserIds = similarUsersResult.rows.map(row => row.user_id);
    
    // Get workflows liked by similar users but not by current user
    const collaborativeQuery = `
      SELECT 
        mw.id,
        mw.name,
        mw.average_rating,
        mw.download_count,
        COUNT(DISTINCT uwi.user_id) as similar_user_interactions
      FROM marketplace_workflows mw
      JOIN user_workflow_interactions uwi ON mw.id = uwi.workflow_id
      WHERE uwi.user_id = ANY($2)
        AND mw.is_public = true
        AND mw.id NOT IN (
          SELECT workflow_id FROM user_workflow_interactions WHERE user_id = $1
        )
      GROUP BY mw.id, mw.name, mw.average_rating, mw.download_count
      ORDER BY similar_user_interactions DESC, mw.average_rating DESC
      LIMIT $3
    `;
    
    const result = await this.pool.query(collaborativeQuery, [userId, similarUserIds, limit]);
    
    return result.rows.map(row => ({
      workflowId: row.id,
      score: parseInt(row.similar_user_interactions) * 0.6 + (row.average_rating * 0.4),
      reason: RecommendationReason.COLLABORATIVE_FILTERING,
      metadata: {
        similarUserInteractions: row.similar_user_interactions,
        averageRating: row.average_rating,
        downloadCount: row.download_count
      }
    }));
  }

  private async getOrganizationPopularRecommendations(userId: string, limit: number): Promise<WorkflowRecommendation[]> {
    // Get user's organization
    const userQuery = 'SELECT organization_id FROM users WHERE id = $1';
    const userResult = await this.pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return [];
    }
    
    const organizationId = userResult.rows[0].organization_id;
    return this.getPopularInOrganization(organizationId, limit);
  }

  private async getTrendingRecommendations(limit: number): Promise<WorkflowRecommendation[]> {
    const query = `
      SELECT 
        mw.id,
        mw.name,
        mw.average_rating,
        mw.download_count,
        COALESCE(recent_downloads.count, 0) as recent_downloads
      FROM marketplace_workflows mw
      LEFT JOIN (
        SELECT workflow_id, COUNT(*) as count
        FROM workflow_downloads 
        WHERE downloaded_at >= NOW() - INTERVAL '7 days'
        GROUP BY workflow_id
      ) recent_downloads ON mw.id = recent_downloads.workflow_id
      WHERE mw.is_public = true
      ORDER BY 
        recent_downloads * 0.7 + 
        (mw.average_rating * mw.total_ratings) * 0.3 DESC
      LIMIT $1
    `;
    
    const result = await this.pool.query(query, [limit]);
    
    return result.rows.map(row => ({
      workflowId: row.id,
      score: parseFloat(row.recent_downloads) * 0.7 + (row.average_rating * 0.3),
      reason: RecommendationReason.TRENDING,
      metadata: {
        recentDownloads: row.recent_downloads,
        averageRating: row.average_rating,
        downloadCount: row.download_count
      }
    }));
  }

  private removeDuplicates(recommendations: WorkflowRecommendation[]): WorkflowRecommendation[] {
    const seen = new Set<string>();
    return recommendations.filter(rec => {
      if (seen.has(rec.workflowId)) {
        return false;
      }
      seen.add(rec.workflowId);
      return true;
    });
  }
}