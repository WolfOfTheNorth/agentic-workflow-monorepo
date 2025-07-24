-- =============================================================================
-- Database Initialization Script
-- Creates additional databases and configurations for development
-- =============================================================================

-- Create test database
CREATE DATABASE agentic_workflow_test;

-- Grant privileges to the main user for test database
GRANT ALL PRIVILEGES ON DATABASE agentic_workflow_test TO postgres;

-- Create additional schemas if needed
-- \c agentic_workflow;
-- CREATE SCHEMA IF NOT EXISTS analytics;
-- CREATE SCHEMA IF NOT EXISTS logs;

-- Set default permissions
-- GRANT USAGE ON SCHEMA public TO postgres;
-- GRANT CREATE ON SCHEMA public TO postgres;