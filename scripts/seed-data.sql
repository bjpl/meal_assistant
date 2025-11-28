-- =============================================================================
-- Seed Data Script
-- Development and testing data for Meal Assistant
-- =============================================================================

-- Only run in development/test environments
DO $$
BEGIN
    IF current_setting('app.environment', true) = 'production' THEN
        RAISE EXCEPTION 'Cannot run seed data in production!';
    END IF;
END
$$;

-- =============================================================================
-- Demo Users
-- =============================================================================
INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'demo@example.com',
     '$2b$10$rQZ8FqKzJ3OxyBhVw7YBb.YHcV3M6WK5kH7r3YwKXL3vJN5X5Xh5K', -- password: demo123
     'Demo User', true, true),
    ('00000000-0000-0000-0000-000000000002', 'test@example.com',
     '$2b$10$rQZ8FqKzJ3OxyBhVw7YBb.YHcV3M6WK5kH7r3YwKXL3vJN5X5Xh5K', -- password: demo123
     'Test User', true, true)
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- User Profiles
-- =============================================================================
INSERT INTO user_profiles (user_id, height_cm, weight_kg, target_weight_kg, activity_level, tdee, bmr)
VALUES
    ('00000000-0000-0000-0000-000000000001', 175.0, 80.0, 75.0, 'moderate', 2200, 1800),
    ('00000000-0000-0000-0000-000000000002', 165.0, 65.0, 60.0, 'active', 2000, 1500)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- Sample Eating Patterns
-- =============================================================================
INSERT INTO eating_patterns (user_id, date, pattern_type, meals, total_calories, total_protein, status)
VALUES
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE, 'three_meals',
     '[
       {"id": "meal-1", "name": "Breakfast", "time": "08:00", "calories": 500, "protein": 30, "status": "completed"},
       {"id": "meal-2", "name": "Lunch", "time": "12:30", "calories": 700, "protein": 40, "status": "pending"},
       {"id": "meal-3", "name": "Dinner", "time": "18:30", "calories": 800, "protein": 45, "status": "pending"}
     ]'::jsonb, 2000, 115, 'active')
ON CONFLICT (user_id, date) DO NOTHING;

-- =============================================================================
-- Sample Inventory Items
-- =============================================================================
INSERT INTO inventory (user_id, name, category, quantity, unit, expiry_date, location, is_staple)
VALUES
    -- Proteins
    ('00000000-0000-0000-0000-000000000001', 'Chicken Breast', 'protein', 500, 'g', CURRENT_DATE + 3, 'refrigerator', false),
    ('00000000-0000-0000-0000-000000000001', 'Eggs', 'protein', 12, 'count', CURRENT_DATE + 14, 'refrigerator', true),
    ('00000000-0000-0000-0000-000000000001', 'Greek Yogurt', 'protein', 500, 'g', CURRENT_DATE + 7, 'refrigerator', false),

    -- Carbohydrates
    ('00000000-0000-0000-0000-000000000001', 'Brown Rice', 'carbohydrate', 1000, 'g', CURRENT_DATE + 180, 'pantry', true),
    ('00000000-0000-0000-0000-000000000001', 'Oats', 'carbohydrate', 500, 'g', CURRENT_DATE + 90, 'pantry', true),
    ('00000000-0000-0000-0000-000000000001', 'Sweet Potato', 'carbohydrate', 3, 'count', CURRENT_DATE + 14, 'pantry', false),

    -- Vegetables
    ('00000000-0000-0000-0000-000000000001', 'Broccoli', 'vegetable', 300, 'g', CURRENT_DATE + 5, 'refrigerator', false),
    ('00000000-0000-0000-0000-000000000001', 'Spinach', 'vegetable', 200, 'g', CURRENT_DATE + 3, 'refrigerator', false),
    ('00000000-0000-0000-0000-000000000001', 'Bell Peppers', 'vegetable', 3, 'count', CURRENT_DATE + 7, 'refrigerator', false),

    -- Fruits
    ('00000000-0000-0000-0000-000000000001', 'Bananas', 'fruit', 6, 'count', CURRENT_DATE + 5, 'counter', false),
    ('00000000-0000-0000-0000-000000000001', 'Apples', 'fruit', 4, 'count', CURRENT_DATE + 14, 'refrigerator', false),

    -- Fats
    ('00000000-0000-0000-0000-000000000001', 'Olive Oil', 'fat', 500, 'ml', CURRENT_DATE + 365, 'pantry', true),
    ('00000000-0000-0000-0000-000000000001', 'Almonds', 'fat', 200, 'g', CURRENT_DATE + 90, 'pantry', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Sample Equipment
-- =============================================================================
INSERT INTO equipment (user_id, name, category, is_available)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Instant Pot', 'cooking', true),
    ('00000000-0000-0000-0000-000000000001', 'Air Fryer', 'cooking', true),
    ('00000000-0000-0000-0000-000000000001', 'Food Processor', 'prep', true),
    ('00000000-0000-0000-0000-000000000001', 'Stand Mixer', 'prep', true),
    ('00000000-0000-0000-0000-000000000001', 'Cast Iron Skillet', 'cooking', true),
    ('00000000-0000-0000-0000-000000000001', 'Sheet Pan', 'baking', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Sample Weight Log
-- =============================================================================
INSERT INTO weight_log (user_id, weight_kg, measured_at)
VALUES
    ('00000000-0000-0000-0000-000000000001', 82.0, CURRENT_TIMESTAMP - INTERVAL '30 days'),
    ('00000000-0000-0000-0000-000000000001', 81.5, CURRENT_TIMESTAMP - INTERVAL '23 days'),
    ('00000000-0000-0000-0000-000000000001', 81.0, CURRENT_TIMESTAMP - INTERVAL '16 days'),
    ('00000000-0000-0000-0000-000000000001', 80.5, CURRENT_TIMESTAMP - INTERVAL '9 days'),
    ('00000000-0000-0000-0000-000000000001', 80.0, CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Sample Shopping List
-- =============================================================================
INSERT INTO shopping_lists (user_id, name, status, items)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Weekly Groceries', 'active',
     '[
       {"name": "Salmon Fillet", "quantity": 500, "unit": "g", "category": "protein", "checked": false},
       {"name": "Quinoa", "quantity": 500, "unit": "g", "category": "carbohydrate", "checked": false},
       {"name": "Avocados", "quantity": 3, "unit": "count", "category": "fat", "checked": false},
       {"name": "Cherry Tomatoes", "quantity": 400, "unit": "g", "category": "vegetable", "checked": false}
     ]'::jsonb)
ON CONFLICT DO NOTHING;

-- Log seed data application
INSERT INTO schema_migrations (version, description)
VALUES ('seed-1.0.0', 'Development seed data')
ON CONFLICT (version) DO NOTHING;
