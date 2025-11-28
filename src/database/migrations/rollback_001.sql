-- =============================================================================
-- Rollback: 001 Initial Schema
-- Description: Rollback initial database schema
-- WARNING: This will DELETE ALL DATA
-- =============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_eating_patterns_updated_at ON eating_patterns;
DROP TRIGGER IF EXISTS update_meals_updated_at ON meals;
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
DROP TRIGGER IF EXISTS update_shopping_lists_updated_at ON shopping_lists;
DROP TRIGGER IF EXISTS update_equipment_updated_at ON equipment;
DROP TRIGGER IF EXISTS update_prep_sessions_updated_at ON prep_sessions;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS weight_log CASCADE;
DROP TABLE IF EXISTS prep_sessions CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS shopping_lists CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS meals CASCADE;
DROP TABLE IF EXISTS eating_patterns CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '1.0.0';

-- Note: Keep schema_migrations table for tracking
