-- =============================================================================
-- Migration: 002_add_indexes
-- Description: Performance optimization indexes
-- Version: 1.0.1
-- =============================================================================

-- Check if migration was already applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '1.0.1') THEN
        RAISE NOTICE 'Migration 1.0.1 already applied, skipping...';
        RETURN;
    END IF;

    -- Composite indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_meals_user_date
        ON meals(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_inventory_user_expiry
        ON inventory(user_id, expiry_date)
        WHERE expiry_date IS NOT NULL AND quantity > 0;

    CREATE INDEX IF NOT EXISTS idx_patterns_user_type_date
        ON eating_patterns(user_id, pattern_type, date DESC);

    -- Full-text search indexes
    CREATE INDEX IF NOT EXISTS idx_inventory_name_search
        ON inventory USING gin(to_tsvector('english', name));

    CREATE INDEX IF NOT EXISTS idx_meals_name_search
        ON meals USING gin(to_tsvector('english', name));

    -- JSONB indexes for frequently queried JSON fields
    CREATE INDEX IF NOT EXISTS idx_meals_ingredients
        ON meals USING gin(ingredients);

    CREATE INDEX IF NOT EXISTS idx_inventory_nutrition
        ON inventory USING gin(nutrition_per_100g);

    CREATE INDEX IF NOT EXISTS idx_user_preferences
        ON users USING gin(preferences);

    -- Partial indexes for active records
    CREATE INDEX IF NOT EXISTS idx_active_shopping_lists
        ON shopping_lists(user_id, created_at DESC)
        WHERE status = 'active';

    CREATE INDEX IF NOT EXISTS idx_pending_meals
        ON meals(user_id, scheduled_time)
        WHERE status = 'pending';

    -- Record migration
    INSERT INTO schema_migrations (version, description)
    VALUES ('1.0.1', 'Add performance optimization indexes');

    RAISE NOTICE 'Migration 1.0.1 applied successfully';
END
$$;
