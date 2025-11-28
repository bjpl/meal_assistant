-- =============================================================================
-- Database Initialization Script
-- Meal Assistant Application
-- Version: 1.0.0
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Users Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- =============================================================================
-- User Profiles Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    height_cm DECIMAL(5,2),
    weight_kg DECIMAL(5,2),
    target_weight_kg DECIMAL(5,2),
    activity_level VARCHAR(50) DEFAULT 'moderate',
    dietary_restrictions JSONB DEFAULT '[]'::jsonb,
    allergies JSONB DEFAULT '[]'::jsonb,
    goals JSONB DEFAULT '[]'::jsonb,
    tdee INTEGER,
    bmr INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);

-- =============================================================================
-- Eating Patterns Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS eating_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    pattern_type VARCHAR(50) NOT NULL,
    meals JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_calories INTEGER,
    total_protein INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

CREATE INDEX idx_eating_patterns_user_date ON eating_patterns(user_id, date DESC);
CREATE INDEX idx_eating_patterns_type ON eating_patterns(pattern_type);

-- =============================================================================
-- Meals Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_id UUID REFERENCES eating_patterns(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    meal_type VARCHAR(50) NOT NULL,
    scheduled_time TIME,
    actual_time TIME,
    target_calories INTEGER,
    actual_calories INTEGER,
    target_protein INTEGER,
    actual_protein INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    photo_url VARCHAR(500),
    substitutions JSONB DEFAULT '[]'::jsonb,
    ingredients JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logged_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_meals_user ON meals(user_id);
CREATE INDEX idx_meals_pattern ON meals(pattern_id);
CREATE INDEX idx_meals_status ON meals(status);
CREATE INDEX idx_meals_created ON meals(created_at DESC);

-- =============================================================================
-- Inventory Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    quantity DECIMAL(10,2) DEFAULT 1,
    unit VARCHAR(50),
    expiry_date DATE,
    location VARCHAR(100),
    barcode VARCHAR(100),
    nutrition_per_100g JSONB,
    purchase_date DATE,
    price DECIMAL(10,2),
    notes TEXT,
    is_staple BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_user ON inventory(user_id);
CREATE INDEX idx_inventory_expiry ON inventory(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_barcode ON inventory(barcode) WHERE barcode IS NOT NULL;

-- =============================================================================
-- Shopping Lists Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS shopping_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) DEFAULT 'Shopping List',
    status VARCHAR(50) DEFAULT 'active',
    scheduled_date DATE,
    store VARCHAR(255),
    estimated_total DECIMAL(10,2),
    actual_total DECIMAL(10,2),
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_shopping_lists_user ON shopping_lists(user_id);
CREATE INDEX idx_shopping_lists_status ON shopping_lists(status);

-- =============================================================================
-- Equipment Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    brand VARCHAR(255),
    is_available BOOLEAN DEFAULT true,
    last_used TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_equipment_user ON equipment(user_id);
CREATE INDEX idx_equipment_available ON equipment(is_available) WHERE is_available = true;

-- =============================================================================
-- Prep Sessions Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS prep_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    scheduled_date DATE NOT NULL,
    scheduled_start TIME,
    scheduled_end TIME,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'planned',
    tasks JSONB DEFAULT '[]'::jsonb,
    equipment_used JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prep_sessions_user ON prep_sessions(user_id);
CREATE INDEX idx_prep_sessions_date ON prep_sessions(scheduled_date);
CREATE INDEX idx_prep_sessions_status ON prep_sessions(status);

-- =============================================================================
-- Weight Log Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS weight_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg DECIMAL(5,2) NOT NULL,
    body_fat_percent DECIMAL(4,1),
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weight_log_user ON weight_log(user_id);
CREATE INDEX idx_weight_log_date ON weight_log(measured_at DESC);

-- =============================================================================
-- Analytics Events Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    session_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);

-- =============================================================================
-- Migrations Table (for tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Record this migration
INSERT INTO schema_migrations (version, description)
VALUES ('1.0.0', 'Initial database schema')
ON CONFLICT (version) DO NOTHING;

-- =============================================================================
-- Updated At Trigger Function
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_eating_patterns_updated_at BEFORE UPDATE ON eating_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meals_updated_at BEFORE UPDATE ON meals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prep_sessions_updated_at BEFORE UPDATE ON prep_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Grant Permissions (for application user)
-- =============================================================================
-- Note: Adjust 'meal_user' to match your application's database user
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'meal_user') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO meal_user;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO meal_user;
    END IF;
END
$$;

-- =============================================================================
-- Initial Data (optional seed data for development)
-- =============================================================================
-- Uncomment below for development seed data

-- INSERT INTO users (email, password_hash, full_name) VALUES
-- ('demo@example.com', '$2b$10$demo_password_hash', 'Demo User');
