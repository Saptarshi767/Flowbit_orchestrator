-- Database Initialization Script
-- This script sets up the initial database configuration

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('FREE', 'PROFESSIONAL', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE engine_type AS ENUM ('LANGFLOW', 'N8N', 'LANGSMITH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE execution_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workflow_visibility AS ENUM ('PRIVATE', 'ORGANIZATION', 'PUBLIC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('EMAIL', 'SLACK', 'WEBHOOK', 'IN_APP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance (these will be created by Prisma migrations)
-- But we can add some additional performance indexes here

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a function to generate short IDs
CREATE OR REPLACE FUNCTION generate_short_id(table_name TEXT)
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    done BOOL;
BEGIN
    done := FALSE;
    WHILE NOT done LOOP
        new_id := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        BEGIN
            EXECUTE 'SELECT 1 FROM ' || table_name || ' WHERE id = $1' USING new_id;
            -- If we get here, the ID exists, so try again
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                done := TRUE;
        END;
    END LOOP;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to clean up old execution logs
CREATE OR REPLACE FUNCTION cleanup_old_executions(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM executions 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * retention_days
    AND status IN ('COMPLETED', 'FAILED', 'CANCELLED');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO audit_logs (id, action, resource, details, timestamp)
    VALUES (
        gen_random_uuid()::TEXT,
        'CLEANUP',
        'executions',
        json_build_object('deleted_count', deleted_count, 'retention_days', retention_days),
        CURRENT_TIMESTAMP
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to calculate workflow complexity
CREATE OR REPLACE FUNCTION calculate_workflow_complexity(workflow_definition JSONB)
RETURNS INTEGER AS $$
DECLARE
    node_count INTEGER;
    edge_count INTEGER;
    complexity INTEGER;
BEGIN
    -- Count nodes
    SELECT COALESCE(jsonb_array_length(workflow_definition->'nodes'), 0) INTO node_count;
    
    -- Count edges/connections
    SELECT COALESCE(jsonb_array_length(workflow_definition->'edges'), 0) INTO edge_count;
    IF edge_count = 0 THEN
        SELECT COALESCE(jsonb_array_length(workflow_definition->'connections'), 0) INTO edge_count;
    END IF;
    
    -- Simple complexity calculation
    complexity := node_count + (edge_count * 2);
    
    RETURN complexity;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_id TEXT)
RETURNS JSONB AS $$
DECLARE
    user_record RECORD;
    permissions JSONB;
BEGIN
    SELECT u.role, u.permissions, o.plan 
    FROM users u 
    JOIN organizations o ON u.organization_id = o.id 
    WHERE u.id = user_id
    INTO user_record;
    
    IF NOT FOUND THEN
        RETURN '[]'::JSONB;
    END IF;
    
    -- Base permissions by role
    CASE user_record.role
        WHEN 'ADMIN' THEN
            permissions := '["read", "write", "delete", "admin", "execute", "share", "manage_users"]'::JSONB;
        WHEN 'MANAGER' THEN
            permissions := '["read", "write", "execute", "share", "manage_workflows"]'::JSONB;
        WHEN 'DEVELOPER' THEN
            permissions := '["read", "write", "execute", "share"]'::JSONB;
        WHEN 'VIEWER' THEN
            permissions := '["read"]'::JSONB;
        ELSE
            permissions := '[]'::JSONB;
    END CASE;
    
    -- Merge with custom permissions
    IF user_record.permissions IS NOT NULL THEN
        permissions := permissions || user_record.permissions;
    END IF;
    
    RETURN permissions;
END;
$$ LANGUAGE plpgsql;

-- Create initial system configuration
INSERT INTO system_metrics (id, name, value, tags, timestamp)
VALUES 
    (gen_random_uuid()::TEXT, 'system.initialized', 1, '{"component": "database"}'::JSON, CURRENT_TIMESTAMP),
    (gen_random_uuid()::TEXT, 'database.version', 1.0, '{"schema_version": "1.0.0"}'::JSON, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Create database maintenance schedule
-- This would typically be handled by a job scheduler, but we can create the structure

COMMENT ON DATABASE orchestrator IS 'AI Orchestrator Database - Initialized on ' || CURRENT_TIMESTAMP;

-- Grant necessary permissions
-- These would be handled by the application connection user
-- GRANT USAGE ON SCHEMA public TO orchestrator_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO orchestrator_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO orchestrator_app;