-- Marketplace Workflows Table
CREATE TABLE IF NOT EXISTS marketplace_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL UNIQUE, -- Reference to the original workflow
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    engine_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    tags JSONB DEFAULT '[]',
    published_by UUID NOT NULL,
    organization_id UUID NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    is_public BOOLEAN NOT NULL DEFAULT true,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    price INTEGER, -- Price in cents
    download_count INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_ratings INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    
    CONSTRAINT chk_rating_range CHECK (average_rating >= 0 AND average_rating <= 5),
    CONSTRAINT chk_price_positive CHECK (price IS NULL OR price >= 0),
    CONSTRAINT chk_download_count_positive CHECK (download_count >= 0),
    CONSTRAINT chk_total_ratings_positive CHECK (total_ratings >= 0)
);

-- Workflow Ratings Table
CREATE TABLE IF NOT EXISTS workflow_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES marketplace_workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, workflow_id) -- One rating per user per workflow
);

-- Workflow Downloads Table
CREATE TABLE IF NOT EXISTS workflow_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES marketplace_workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT
);

-- Workflow Collections Table
CREATE TABLE IF NOT EXISTS workflow_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_by UUID NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    workflow_ids JSONB NOT NULL DEFAULT '[]',
    tags JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User Workflow Interactions Table (for recommendations)
CREATE TABLE IF NOT EXISTS user_workflow_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    workflow_id UUID NOT NULL REFERENCES marketplace_workflows(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL, -- 'view', 'download', 'rate', 'share'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, workflow_id, interaction_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_category ON marketplace_workflows(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_engine_type ON marketplace_workflows(engine_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_published_by ON marketplace_workflows(published_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_organization_id ON marketplace_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_is_public ON marketplace_workflows(is_public);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_is_premium ON marketplace_workflows(is_premium);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_published_at ON marketplace_workflows(published_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_download_count ON marketplace_workflows(download_count);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_average_rating ON marketplace_workflows(average_rating);
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_tags ON marketplace_workflows USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_workflow_ratings_workflow_id ON workflow_ratings(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_ratings_user_id ON workflow_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_ratings_rating ON workflow_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_workflow_ratings_created_at ON workflow_ratings(created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_downloads_workflow_id ON workflow_downloads(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_downloads_user_id ON workflow_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_downloads_downloaded_at ON workflow_downloads(downloaded_at);

CREATE INDEX IF NOT EXISTS idx_workflow_collections_created_by ON workflow_collections(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_collections_is_public ON workflow_collections(is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_collections_created_at ON workflow_collections(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_collections_tags ON workflow_collections USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_user_workflow_interactions_user_id ON user_workflow_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workflow_interactions_workflow_id ON user_workflow_interactions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_user_workflow_interactions_type ON user_workflow_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_workflow_interactions_created_at ON user_workflow_interactions(created_at);

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_workflows_search ON marketplace_workflows 
USING GIN(to_tsvector('english', name || ' ' || description));

-- Create triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_marketplace_workflows_updated_at 
    BEFORE UPDATE ON marketplace_workflows 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_ratings_updated_at 
    BEFORE UPDATE ON workflow_ratings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_collections_updated_at 
    BEFORE UPDATE ON workflow_collections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();