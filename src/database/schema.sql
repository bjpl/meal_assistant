-- =============================================================================
-- MEAL ASSISTANT DATABASE SCHEMA
-- Version: 1.0.0
-- PostgreSQL 15+
-- =============================================================================
-- This schema supports the Flexible Eating System with:
-- - 7 interchangeable eating patterns
-- - Shared component library (proteins, carbs, vegetables, etc.)
-- - Kitchen equipment and inventory management
-- - Meal prep orchestration and timing
-- - Progress tracking and analytics
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- SECTION 1: USER MANAGEMENT
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile information
    full_name VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(20),
    height_cm DECIMAL(5,2),
    activity_level VARCHAR(20) CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),

    -- Current stats (updated periodically)
    current_weight_kg DECIMAL(5,2),
    target_weight_kg DECIMAL(5,2),

    -- Nutritional targets
    daily_calorie_target INTEGER DEFAULT 1800,
    daily_protein_target_g INTEGER DEFAULT 135,
    daily_carb_target_g INTEGER,
    daily_fat_target_g INTEGER,

    -- Preferences
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    preferred_units VARCHAR(10) DEFAULT 'imperial' CHECK (preferred_units IN ('imperial', 'metric')),
    language VARCHAR(10) DEFAULT 'en',

    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User dietary restrictions and allergies
CREATE TABLE user_dietary_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restriction_type VARCHAR(50) NOT NULL, -- 'allergy', 'intolerance', 'preference', 'medical'
    name VARCHAR(100) NOT NULL,
    severity VARCHAR(20), -- 'mild', 'moderate', 'severe', 'life_threatening'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User goals and milestones
CREATE TABLE user_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL, -- 'weight_loss', 'maintenance', 'muscle_gain'
    target_value DECIMAL(10,2),
    target_unit VARCHAR(20),
    target_date DATE,
    is_achieved BOOLEAN DEFAULT FALSE,
    achieved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 2: EATING PATTERNS
-- =============================================================================

CREATE TABLE eating_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE, -- 'A', 'B', 'C', 'D', 'E', 'F', 'G'
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Optimal conditions
    optimal_for TEXT[], -- Array of use cases

    -- Timing configuration
    eating_window_start TIME,
    eating_window_end TIME,
    is_intermittent_fasting BOOLEAN DEFAULT FALSE,

    -- Meal structure (stored as JSONB for flexibility)
    meal_structure JSONB NOT NULL,
    -- Example: {"meals": [{"name": "Morning", "time": "07:00", "calories": 400, "protein_g": 35}]}

    -- Totals
    total_calories INTEGER NOT NULL,
    total_protein_g INTEGER NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User's active pattern selection and preferences
CREATE TABLE user_pattern_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_id UUID NOT NULL REFERENCES eating_patterns(id),

    -- Preference level
    preference_rank INTEGER DEFAULT 1, -- 1 = most preferred
    is_default BOOLEAN DEFAULT FALSE,

    -- Pattern-specific overrides
    custom_meal_times JSONB, -- Override default meal times
    custom_calories INTEGER, -- Override total calories

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, pattern_id)
);

-- Daily pattern selection log
CREATE TABLE daily_pattern_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_id UUID NOT NULL REFERENCES eating_patterns(id),
    date DATE NOT NULL,

    -- Decision factors (from decision tree)
    morning_hunger_level INTEGER CHECK (morning_hunger_level BETWEEN 1 AND 10),
    schedule_type VARCHAR(50), -- 'home', 'office', 'social_lunch', 'social_dinner'
    exercise_timing VARCHAR(20), -- 'morning', 'noon', 'evening', 'rest'
    previous_day_outcome VARCHAR(20), -- 'overate', 'hungry', 'perfect', 'boring'

    -- Results
    adherence_rating INTEGER CHECK (adherence_rating BETWEEN 1 AND 10),
    energy_rating INTEGER CHECK (energy_rating BETWEEN 1 AND 10),
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 10),

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, date)
);

-- =============================================================================
-- SECTION 3: FOOD COMPONENTS LIBRARY
-- =============================================================================

-- Component categories
CREATE TABLE component_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(50),
    color VARCHAR(7), -- Hex color code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Master component library (shared ingredients)
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES component_categories(id),

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Portion information
    default_portion_size DECIMAL(10,2) NOT NULL,
    portion_unit VARCHAR(20) NOT NULL, -- 'oz', 'cup', 'tbsp', 'piece', etc.

    -- Nutrition per default portion
    calories INTEGER NOT NULL,
    protein_g DECIMAL(10,2),
    carbs_g DECIMAL(10,2),
    fat_g DECIMAL(10,2),
    fiber_g DECIMAL(10,2),
    sodium_mg DECIMAL(10,2),

    -- Classification
    subcategory VARCHAR(100), -- 'lean_protein', 'moderate_protein', 'grain', etc.
    tags TEXT[], -- Additional tags for searching

    -- Prep information
    prep_notes TEXT,
    cooking_method VARCHAR(100),
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,

    -- Availability
    is_batch_prep_friendly BOOLEAN DEFAULT FALSE,
    storage_days INTEGER, -- How long it keeps after prep
    can_freeze BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Component variations (e.g., different cooking methods change nutrition)
CREATE TABLE component_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,

    variation_name VARCHAR(100) NOT NULL,
    cooking_method VARCHAR(100),

    -- Modified nutrition (per same portion size)
    calories_modifier INTEGER DEFAULT 0,
    protein_modifier DECIMAL(10,2) DEFAULT 0,
    fat_modifier DECIMAL(10,2) DEFAULT 0,

    additional_ingredients JSONB, -- e.g., {"butter": "1 tbsp", "oil": "1 tsp"}

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 4: MEALS AND RECIPES
-- =============================================================================

-- Meal templates (reusable meal definitions)
CREATE TABLE meal_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = system template

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Classification
    meal_type VARCHAR(50) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'
    cuisine_type VARCHAR(50),

    -- Nutritional totals (calculated from components)
    total_calories INTEGER,
    total_protein_g DECIMAL(10,2),
    total_carbs_g DECIMAL(10,2),
    total_fat_g DECIMAL(10,2),

    -- Timing
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,

    -- Instructions
    instructions JSONB, -- Step-by-step instructions

    -- Tags and metadata
    tags TEXT[],
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),

    is_public BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Components within a meal template
CREATE TABLE meal_template_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_template_id UUID NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id),
    variation_id UUID REFERENCES component_variations(id),

    -- Portion
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,

    -- Layer/section in the meal (for bowl-style meals)
    layer_name VARCHAR(50), -- 'base', 'protein', 'vegetables', 'fat', 'flavor'

    is_optional BOOLEAN DEFAULT FALSE,

    -- Alternatives
    alternative_components UUID[], -- Array of component IDs that can substitute

    display_order INTEGER DEFAULT 0,
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 5: MEAL LOGS (Historical Tracking)
-- =============================================================================

CREATE TABLE meal_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_template_id UUID REFERENCES meal_templates(id),

    -- Timing
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL,
    meal_type VARCHAR(50) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'

    -- Pattern context
    pattern_id UUID REFERENCES eating_patterns(id),

    -- Actual nutrition consumed
    actual_calories INTEGER,
    actual_protein_g DECIMAL(10,2),
    actual_carbs_g DECIMAL(10,2),
    actual_fat_g DECIMAL(10,2),

    -- User feedback
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    fullness_rating INTEGER CHECK (fullness_rating BETWEEN 1 AND 5),
    energy_after_rating INTEGER CHECK (energy_after_rating BETWEEN 1 AND 5),
    taste_rating INTEGER CHECK (taste_rating BETWEEN 1 AND 5),

    -- Notes and customizations
    notes TEXT,
    customizations JSONB, -- What was changed from template

    -- Photo tracking (references MongoDB or S3)
    photo_urls TEXT[],

    -- Location
    location_type VARCHAR(50), -- 'home', 'restaurant', 'work', 'other'
    restaurant_name VARCHAR(255),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual items in a meal log (when not using template)
CREATE TABLE meal_log_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_log_id UUID NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id),

    -- For custom items not in library
    custom_name VARCHAR(255),

    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,

    -- Nutrition (calculated or entered)
    calories INTEGER,
    protein_g DECIMAL(10,2),
    carbs_g DECIMAL(10,2),
    fat_g DECIMAL(10,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 6: INVENTORY MANAGEMENT
-- =============================================================================

-- Inventory items (current stock)
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id),

    -- For items not in component library
    custom_name VARCHAR(255),

    -- Quantity tracking
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'low', 'out', 'expired')),

    -- Dates
    purchase_date DATE,
    expiry_date DATE,
    opened_date DATE,

    -- Storage location
    storage_location VARCHAR(50), -- 'fridge', 'freezer', 'pantry', 'counter'
    container_type VARCHAR(50),

    -- Cost tracking
    purchase_price DECIMAL(10,2),
    store_name VARCHAR(255),

    -- Thresholds
    low_quantity_threshold DECIMAL(10,2),
    auto_add_to_shopping BOOLEAN DEFAULT TRUE,

    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory transactions (usage and additions)
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('add', 'use', 'waste', 'adjust')),
    quantity DECIMAL(10,2) NOT NULL, -- Positive for add, negative for use/waste

    -- Context
    meal_log_id UUID REFERENCES meal_logs(id),
    prep_session_id UUID, -- References prep_sessions table

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 7: KITCHEN EQUIPMENT
-- =============================================================================

-- Equipment categories
CREATE TABLE equipment_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    parent_category_id UUID REFERENCES equipment_categories(id),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Kitchen equipment inventory
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES equipment_categories(id),

    name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(100) NOT NULL, -- 'oven', 'stovetop', 'pot', 'pan', 'knife', etc.

    -- Specifications
    brand VARCHAR(100),
    model VARCHAR(100),
    size VARCHAR(50), -- '8"', '4qt', 'large', etc.
    material VARCHAR(50), -- 'stainless', 'cast-iron', 'nonstick', etc.
    capacity VARCHAR(50),

    -- Features (stored as JSONB for flexibility)
    features JSONB, -- e.g., {"temp_range": "170-500F", "wattage": 1200}

    -- Quantity and status
    quantity INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'dirty', 'maintenance', 'unavailable')),

    -- Location
    storage_location VARCHAR(100), -- 'drawer', 'cabinet', 'counter', 'hanging'

    -- Cleaning requirements
    is_dishwasher_safe BOOLEAN DEFAULT FALSE,
    cleaning_time_minutes INTEGER,

    -- Maintenance
    last_maintenance_date DATE,
    maintenance_interval_days INTEGER,

    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Equipment requirements for recipes
CREATE TABLE meal_template_equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_template_id UUID NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
    equipment_type VARCHAR(100) NOT NULL,

    -- Requirements
    min_size VARCHAR(50),
    min_capacity VARCHAR(50),
    required_features TEXT[],

    -- Usage details
    use_description VARCHAR(255),
    duration_minutes INTEGER,
    temperature VARCHAR(50),

    -- Alternatives
    is_required BOOLEAN DEFAULT TRUE,
    alternative_equipment TEXT[],

    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Equipment usage log
CREATE TABLE equipment_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,

    -- Usage context
    prep_session_id UUID,
    meal_template_id UUID REFERENCES meal_templates(id),

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,

    -- Status after use
    status_after VARCHAR(20),
    needs_cleaning BOOLEAN DEFAULT TRUE,

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 8: MEAL PREP SESSIONS
-- =============================================================================

CREATE TABLE prep_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255), -- e.g., "Sunday Prep Week 1"
    description TEXT,

    -- Timing
    scheduled_date DATE NOT NULL,
    scheduled_start_time TIME,
    estimated_duration_minutes INTEGER,

    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,

    -- Status
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),

    -- Prep targets
    prep_for_days INTEGER DEFAULT 7,
    target_meals INTEGER,
    target_servings INTEGER,

    -- Results
    actual_meals_prepped INTEGER,
    actual_servings_prepped INTEGER,

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks within a prep session
CREATE TABLE prep_session_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prep_session_id UUID NOT NULL REFERENCES prep_sessions(id) ON DELETE CASCADE,
    meal_template_id UUID REFERENCES meal_templates(id),

    -- Task details
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- 'cook_rice', 'roast_vegetables', 'grill_protein', 'make_sauce', etc.

    -- Timing (for Gantt chart scheduling)
    scheduled_start_minutes INTEGER, -- Minutes from session start
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,

    -- Dependencies
    depends_on_task_ids UUID[],

    -- Equipment needed
    required_equipment JSONB, -- e.g., [{"type": "oven", "duration": 30}]

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Parallelization
    can_parallel BOOLEAN DEFAULT TRUE,
    parallel_group VARCHAR(50), -- Group tasks that can happen simultaneously

    instructions TEXT,
    notes TEXT,

    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prep session outputs (what was actually made)
CREATE TABLE prep_session_outputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prep_session_id UUID NOT NULL REFERENCES prep_sessions(id) ON DELETE CASCADE,
    prep_task_id UUID REFERENCES prep_session_tasks(id),

    -- What was made
    component_id UUID REFERENCES components(id),
    meal_template_id UUID REFERENCES meal_templates(id),
    custom_name VARCHAR(255),

    -- Quantity
    servings INTEGER,
    quantity DECIMAL(10,2),
    unit VARCHAR(20),

    -- Storage
    storage_container VARCHAR(100),
    storage_location VARCHAR(50),
    expiry_date DATE,

    -- Links to inventory
    inventory_item_id UUID REFERENCES inventory_items(id),

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 9: SHOPPING LISTS
-- =============================================================================

CREATE TABLE shopping_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255) DEFAULT 'Shopping List',

    -- Planning
    shopping_date DATE,
    prep_session_id UUID REFERENCES prep_sessions(id),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'shopping', 'completed', 'archived')),

    -- Budget
    estimated_total DECIMAL(10,2),
    actual_total DECIMAL(10,2),

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shopping_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id),

    -- Item details
    custom_name VARCHAR(255),

    -- Quantity
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,

    -- Shopping info
    category VARCHAR(50), -- For organizing by store section
    store_name VARCHAR(255),
    aisle VARCHAR(50),

    -- Pricing
    estimated_price DECIMAL(10,2),
    actual_price DECIMAL(10,2),

    -- Status
    is_checked BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMP WITH TIME ZONE,

    -- Priority
    is_essential BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1,

    -- Source
    source VARCHAR(50), -- 'manual', 'inventory_low', 'prep_session', 'meal_plan'

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Store information for price tracking
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    address TEXT,

    -- Location (for future geo features)
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),

    notes TEXT,
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Price history for components
CREATE TABLE component_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id),
    store_id UUID REFERENCES stores(id),

    price DECIMAL(10,2) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,

    -- Calculated
    price_per_unit DECIMAL(10,4),

    recorded_date DATE NOT NULL,
    is_sale_price BOOLEAN DEFAULT FALSE,

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 10: ANALYTICS AND TRACKING
-- =============================================================================

-- Weight tracking
CREATE TABLE weight_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    weight_kg DECIMAL(5,2) NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Optional measurements
    body_fat_percentage DECIMAL(5,2),
    waist_cm DECIMAL(5,2),
    hip_cm DECIMAL(5,2),
    chest_cm DECIMAL(5,2),

    notes TEXT,
    photo_url TEXT, -- Progress photo reference

    UNIQUE(user_id, logged_at::date)
);

-- Daily summaries (pre-calculated for performance)
CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Pattern used
    pattern_id UUID REFERENCES eating_patterns(id),

    -- Nutritional totals
    total_calories INTEGER,
    total_protein_g DECIMAL(10,2),
    total_carbs_g DECIMAL(10,2),
    total_fat_g DECIMAL(10,2),
    total_fiber_g DECIMAL(10,2),

    -- Meal counts
    meals_logged INTEGER,
    meals_planned INTEGER,

    -- Hydration
    water_ml INTEGER,

    -- Ratings
    overall_adherence INTEGER CHECK (overall_adherence BETWEEN 1 AND 10),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
    hunger_level INTEGER CHECK (hunger_level BETWEEN 1 AND 10),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),

    -- Exercise
    exercise_minutes INTEGER,
    exercise_type VARCHAR(100),
    exercise_intensity VARCHAR(20),

    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, date)
);

-- Weekly summaries
CREATE TABLE weekly_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,

    -- Weight change
    starting_weight_kg DECIMAL(5,2),
    ending_weight_kg DECIMAL(5,2),
    weight_change_kg DECIMAL(5,2),

    -- Averages
    avg_daily_calories DECIMAL(10,2),
    avg_daily_protein_g DECIMAL(10,2),
    avg_adherence DECIMAL(5,2),
    avg_energy DECIMAL(5,2),

    -- Pattern usage
    patterns_used JSONB, -- e.g., {"A": 3, "B": 2, "C": 2}
    most_used_pattern_id UUID REFERENCES eating_patterns(id),

    -- Achievements
    goals_met TEXT[],

    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, week_start_date)
);

-- Pattern effectiveness tracking
CREATE TABLE pattern_effectiveness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_id UUID NOT NULL REFERENCES eating_patterns(id),

    -- Aggregated metrics
    times_used INTEGER DEFAULT 0,
    avg_adherence DECIMAL(5,2),
    avg_satisfaction DECIMAL(5,2),
    avg_energy DECIMAL(5,2),

    -- Weight correlation
    avg_weight_change_when_used DECIMAL(5,2),

    -- Best conditions
    best_schedule_type VARCHAR(50),
    best_exercise_timing VARCHAR(20),

    last_calculated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, pattern_id)
);

-- =============================================================================
-- SECTION 11: SYNC AND OFFLINE SUPPORT
-- =============================================================================

-- Sync queue for offline operations
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Operation details
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),

    -- Data
    data JSONB NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITH TIME ZONE,

    -- Conflict resolution
    client_timestamp TIMESTAMP WITH TIME ZONE,
    server_timestamp TIMESTAMP WITH TIME ZONE
);

-- Device registration for sync
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- 'ios', 'android', 'web'

    -- Push notifications
    push_token TEXT,

    -- Sync status
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_version INTEGER,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, device_id)
);

-- =============================================================================
-- SECTION 12: INDEXES
-- =============================================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- Pattern indexes
CREATE INDEX idx_daily_pattern_user_date ON daily_pattern_selections(user_id, date DESC);
CREATE INDEX idx_user_pattern_prefs ON user_pattern_preferences(user_id);

-- Component indexes
CREATE INDEX idx_components_category ON components(category_id);
CREATE INDEX idx_components_subcategory ON components(subcategory);
CREATE INDEX idx_components_name ON components USING gin(to_tsvector('english', name));
CREATE INDEX idx_components_tags ON components USING gin(tags);

-- Meal template indexes
CREATE INDEX idx_meal_templates_user ON meal_templates(user_id);
CREATE INDEX idx_meal_templates_type ON meal_templates(meal_type);
CREATE INDEX idx_meal_templates_public ON meal_templates(is_public) WHERE is_public = TRUE;

-- Meal log indexes
CREATE INDEX idx_meal_logs_user_date ON meal_logs(user_id, logged_at DESC);
CREATE INDEX idx_meal_logs_user_type ON meal_logs(user_id, meal_type);

-- Inventory indexes
CREATE INDEX idx_inventory_user ON inventory_items(user_id);
CREATE INDEX idx_inventory_status ON inventory_items(user_id, status);
CREATE INDEX idx_inventory_expiry ON inventory_items(expiry_date) WHERE expiry_date IS NOT NULL;

-- Equipment indexes
CREATE INDEX idx_equipment_user ON equipment(user_id);
CREATE INDEX idx_equipment_type ON equipment(equipment_type);
CREATE INDEX idx_equipment_status ON equipment(user_id, status);

-- Prep session indexes
CREATE INDEX idx_prep_sessions_user ON prep_sessions(user_id, scheduled_date DESC);
CREATE INDEX idx_prep_tasks_session ON prep_session_tasks(prep_session_id);

-- Shopping list indexes
CREATE INDEX idx_shopping_lists_user ON shopping_lists(user_id, status);
CREATE INDEX idx_shopping_items_list ON shopping_list_items(shopping_list_id);

-- Analytics indexes
CREATE INDEX idx_weight_logs_user ON weight_logs(user_id, logged_at DESC);
CREATE INDEX idx_daily_summaries_user ON daily_summaries(user_id, date DESC);
CREATE INDEX idx_weekly_summaries_user ON weekly_summaries(user_id, week_start_date DESC);

-- Sync indexes
CREATE INDEX idx_sync_queue_user_status ON sync_queue(user_id, status);
CREATE INDEX idx_sync_queue_pending ON sync_queue(status) WHERE status = 'pending';

-- =============================================================================
-- SECTION 13: TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_eating_patterns_updated_at BEFORE UPDATE ON eating_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_templates_updated_at BEFORE UPDATE ON meal_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prep_sessions_updated_at BEFORE UPDATE ON prep_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_summaries_updated_at BEFORE UPDATE ON daily_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pattern_effectiveness_updated_at BEFORE UPDATE ON pattern_effectiveness
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_devices_updated_at BEFORE UPDATE ON user_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 14: INITIAL DATA - EATING PATTERNS
-- =============================================================================

INSERT INTO eating_patterns (code, name, description, optimal_for, eating_window_start, eating_window_end, is_intermittent_fasting, meal_structure, total_calories, total_protein_g)
VALUES
('A', 'Traditional', 'Classic three-meal structure with moderate breakfast, large lunch, and balanced dinner',
 ARRAY['Regular schedule', 'Consistent energy needs', 'Office work'],
 '07:00', '19:00', FALSE,
 '{"meals": [{"name": "Morning", "time": "07:00", "calories": 400, "protein_g": 35, "description": "Light Asian Soup"}, {"name": "Noon", "time": "12:00", "calories": 850, "protein_g": 60, "description": "Mexican Power Bowl"}, {"name": "Evening", "time": "18:00", "calories": 550, "protein_g": 40, "description": "Protein + Vegetables"}]}'::jsonb,
 1800, 135),

('B', 'Reversed', 'Flipped calorie distribution with larger dinner for social or preference reasons',
 ARRAY['Light dinner preference', 'Business lunches', 'Social midday meals'],
 '07:00', '19:00', FALSE,
 '{"meals": [{"name": "Morning", "time": "07:00", "calories": 400, "protein_g": 35, "description": "Standard Soup"}, {"name": "Noon", "time": "12:00", "calories": 550, "protein_g": 55, "description": "Lunch Protein Plate"}, {"name": "Evening", "time": "18:00", "calories": 850, "protein_g": 50, "description": "Dinner Power Bowl"}]}'::jsonb,
 1800, 140),

('C', 'Intermittent Fasting - Noon Start', 'Two large meals in 8-hour eating window starting at noon',
 ARRAY['Not hungry mornings', 'Prefers larger meals', 'Metabolic flexibility'],
 '12:00', '20:00', TRUE,
 '{"meals": [{"name": "First Meal", "time": "12:00", "calories": 900, "protein_g": 70, "description": "Large chicken rice bowl"}, {"name": "Second Meal", "time": "18:00", "calories": 900, "protein_g": 75, "description": "Bean and egg bowl"}]}'::jsonb,
 1800, 145),

('D', 'Grazing - 4 Mini Meals', 'Four evenly distributed smaller meals throughout the day',
 ARRAY['Steady energy', 'Prevents hunger', 'Blood sugar management'],
 '07:00', '19:00', FALSE,
 '{"meals": [{"name": "Meal 1", "time": "07:00", "calories": 450, "protein_g": 32, "description": "Arepa eggs"}, {"name": "Meal 2", "time": "11:00", "calories": 450, "protein_g": 35, "description": "Half bowl"}, {"name": "Meal 3", "time": "15:00", "calories": 450, "protein_g": 38, "description": "Chicken salad"}, {"name": "Meal 4", "time": "19:00", "calories": 450, "protein_g": 25, "description": "Soup with vegetables"}]}'::jsonb,
 1800, 130),

('E', 'Grazing - Platter Method', 'All-day access to pre-portioned platter with organized stations',
 ARRAY['Work from home', 'Visual eaters', 'Flexible schedule'],
 '07:00', '20:00', FALSE,
 '{"meals": [{"name": "Platter", "time": "07:00", "calories": 1800, "protein_g": 135, "description": "Full day platter with 6 stations: Proteins, Carbs, Vegetables, Fats, Fruits, Flavors"}], "style": "platter", "stations": ["proteins", "carbs", "vegetables", "fats", "fruits", "flavors"]}'::jsonb,
 1800, 135),

('F', 'Big Breakfast', 'Front-loaded calories with large morning meal',
 ARRAY['Morning workouts', 'Weekend leisure', 'Breakfast lovers'],
 '07:00', '19:00', FALSE,
 '{"meals": [{"name": "Morning", "time": "08:00", "calories": 850, "protein_g": 58, "description": "Breakfast Power Bowl"}, {"name": "Noon", "time": "12:00", "calories": 400, "protein_g": 40, "description": "Light Lunch"}, {"name": "Evening", "time": "18:00", "calories": 550, "protein_g": 40, "description": "Standard Dinner"}]}'::jsonb,
 1800, 138),

('G', 'Morning Feast', 'Early eating window ending at 1 PM for reverse intermittent fasting',
 ARRAY['Reverse IF', 'Large morning appetite', 'Evening social plans'],
 '05:00', '13:00', TRUE,
 '{"meals": [{"name": "First Meal", "time": "05:00", "calories": 600, "protein_g": 40, "description": "Eggs and arepas"}, {"name": "Second Meal", "time": "09:00", "calories": 700, "protein_g": 55, "description": "Full power bowl"}, {"name": "Third Meal", "time": "12:30", "calories": 500, "protein_g": 47, "description": "Chicken salad with fruit"}]}'::jsonb,
 1800, 142);

-- =============================================================================
-- SECTION 15: INITIAL DATA - COMPONENT CATEGORIES
-- =============================================================================

INSERT INTO component_categories (name, display_order, icon, color)
VALUES
('Proteins', 1, 'meat', '#E57373'),
('Carbohydrates', 2, 'grain', '#FFB74D'),
('Vegetables', 3, 'leaf', '#81C784'),
('Fats', 4, 'droplet', '#FFD54F'),
('Fruits', 5, 'apple', '#F06292'),
('Dairy', 6, 'milk', '#90CAF9'),
('Flavor Components', 7, 'spice', '#CE93D8'),
('Beverages', 8, 'cup', '#80DEEA');

-- =============================================================================
-- SECTION 16: INITIAL DATA - EQUIPMENT CATEGORIES
-- =============================================================================

INSERT INTO equipment_categories (name, display_order)
VALUES
('Major Appliances', 1),
('Small Appliances', 2),
('Cookware', 3),
('Bakeware', 4),
('Tools', 5),
('Cutting & Prep', 6),
('Measuring', 7),
('Storage', 8);

-- =============================================================================
-- SECTION 17: INITIAL DATA - COMPONENTS (35 Pre-loaded Ingredients)
-- =============================================================================

-- Get category IDs (using subqueries since we're inserting)
-- These components represent the core ingredients for the Flexible Eating System

-- PROTEINS (Lean and Moderate)
INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Chicken Breast', 'Boneless, skinless chicken breast', 4, 'oz', 130, 26, 0, 3, 0, 'lean_protein', ARRAY['high-protein', 'low-fat', 'versatile'], 'Remove excess fat, pound to even thickness', 'grill', 5, 15, TRUE, 4, TRUE
FROM component_categories cc WHERE cc.name = 'Proteins';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Ground Turkey (93% lean)', 'Extra lean ground turkey', 4, 'oz', 140, 22, 0, 6, 0, 'lean_protein', ARRAY['high-protein', 'versatile'], 'Season well, breaks apart easily', 'pan-fry', 2, 10, TRUE, 3, TRUE
FROM component_categories cc WHERE cc.name = 'Proteins';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Salmon Fillet', 'Atlantic salmon, skin-on', 4, 'oz', 180, 23, 0, 10, 0, 'moderate_protein', ARRAY['omega-3', 'heart-healthy'], 'Pat dry, season both sides', 'bake', 3, 12, TRUE, 3, TRUE
FROM component_categories cc WHERE cc.name = 'Proteins';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Eggs (whole)', 'Large whole eggs', 1, 'count', 70, 6, 0.5, 5, 0, 'moderate_protein', ARRAY['versatile', 'quick', 'breakfast'], 'Fresh eggs are best', 'scramble', 1, 5, FALSE, 21, FALSE
FROM component_categories cc WHERE cc.name = 'Proteins';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Black Beans (canned)', 'Canned black beans, drained', 0.5, 'cup', 110, 7, 20, 0.5, 8, 'plant_protein', ARRAY['fiber', 'budget-friendly', 'vegan'], 'Rinse to reduce sodium', 'heat', 1, 5, TRUE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Proteins';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Tofu (firm)', 'Firm tofu, drained', 4, 'oz', 90, 10, 2, 5, 1, 'plant_protein', ARRAY['vegan', 'versatile'], 'Press to remove excess water', 'pan-fry', 15, 10, TRUE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Proteins';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Shrimp (peeled)', 'Peeled and deveined shrimp', 4, 'oz', 100, 20, 1, 1, 0, 'lean_protein', ARRAY['quick-cooking', 'seafood'], 'Thaw properly if frozen', 'saute', 2, 5, TRUE, 2, TRUE
FROM component_categories cc WHERE cc.name = 'Proteins';

-- CARBOHYDRATES
INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Brown Rice', 'Long-grain brown rice', 0.5, 'cup', 110, 2, 23, 1, 2, 'whole_grain', ARRAY['fiber', 'gluten-free'], 'Rinse before cooking', 'boil', 2, 45, TRUE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Carbohydrates';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Quinoa', 'White quinoa, rinsed', 0.5, 'cup', 110, 4, 20, 2, 3, 'whole_grain', ARRAY['complete-protein', 'gluten-free'], 'Rinse to remove bitterness', 'boil', 2, 15, TRUE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Carbohydrates';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Sweet Potato', 'Medium sweet potato', 1, 'count', 100, 2, 23, 0, 4, 'starchy_vegetable', ARRAY['vitamin-a', 'fiber'], 'Pierce skin before microwaving', 'bake', 3, 45, TRUE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Carbohydrates';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Corn Arepa (pre-made)', 'Pre-cooked corn arepa', 1, 'count', 150, 3, 25, 4, 2, 'grain', ARRAY['gluten-free', 'venezuelan'], 'Toast on dry pan', 'toast', 1, 5, TRUE, 7, TRUE
FROM component_categories cc WHERE cc.name = 'Carbohydrates';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Whole Wheat Tortilla', 'Large whole wheat tortilla', 1, 'count', 130, 4, 22, 3, 3, 'grain', ARRAY['fiber', 'versatile'], 'Warm before using', 'dry-heat', 0, 1, FALSE, 14, TRUE
FROM component_categories cc WHERE cc.name = 'Carbohydrates';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Oatmeal (rolled oats)', 'Old-fashioned rolled oats', 0.5, 'cup', 150, 5, 27, 3, 4, 'whole_grain', ARRAY['fiber', 'breakfast'], 'Works overnight or cooked', 'boil', 0, 5, TRUE, 5, FALSE
FROM component_categories cc WHERE cc.name = 'Carbohydrates';

-- VEGETABLES
INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Broccoli', 'Fresh broccoli florets', 1, 'cup', 30, 2, 6, 0, 2, 'cruciferous', ARRAY['vitamin-c', 'fiber'], 'Cut into uniform florets', 'steam', 5, 5, TRUE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Vegetables';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Spinach', 'Baby spinach leaves', 2, 'cup', 15, 2, 2, 0, 1, 'leafy_green', ARRAY['iron', 'quick'], 'Wash thoroughly', 'raw', 2, 0, FALSE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Vegetables';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Bell Peppers (mixed)', 'Mixed color bell peppers', 1, 'cup', 30, 1, 6, 0, 2, 'colorful', ARRAY['vitamin-c', 'crunchy'], 'Remove seeds and slice', 'raw', 5, 0, TRUE, 7, TRUE
FROM component_categories cc WHERE cc.name = 'Vegetables';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Tomatoes (roma)', 'Fresh roma tomatoes', 1, 'cup', 25, 1, 5, 0, 1, 'nightshade', ARRAY['lycopene', 'versatile'], 'Dice or slice as needed', 'raw', 3, 0, FALSE, 5, FALSE
FROM component_categories cc WHERE cc.name = 'Vegetables';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Cucumber', 'Fresh cucumber, sliced', 1, 'cup', 15, 1, 3, 0, 1, 'hydrating', ARRAY['low-calorie', 'refreshing'], 'Peel if skin is tough', 'raw', 2, 0, FALSE, 7, FALSE
FROM component_categories cc WHERE cc.name = 'Vegetables';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Zucchini', 'Fresh zucchini, sliced', 1, 'cup', 20, 1, 4, 0, 1, 'squash', ARRAY['low-calorie', 'versatile'], 'No need to peel', 'saute', 3, 5, TRUE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Vegetables';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Carrots', 'Fresh carrots, sliced', 1, 'cup', 50, 1, 12, 0, 3, 'root', ARRAY['vitamin-a', 'sweet'], 'Peel and slice uniformly', 'roast', 5, 20, TRUE, 14, TRUE
FROM component_categories cc WHERE cc.name = 'Vegetables';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Onion (yellow)', 'Yellow onion, diced', 0.5, 'cup', 30, 1, 7, 0, 1, 'allium', ARRAY['flavor-base', 'versatile'], 'Dice small for even cooking', 'saute', 5, 5, TRUE, 30, TRUE
FROM component_categories cc WHERE cc.name = 'Vegetables';

-- FATS
INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Avocado', 'Fresh Hass avocado', 0.5, 'count', 120, 1, 6, 11, 5, 'healthy_fat', ARRAY['omega-3', 'creamy'], 'Cut when ready to serve', 'raw', 2, 0, FALSE, 3, FALSE
FROM component_categories cc WHERE cc.name = 'Fats';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Olive Oil (extra virgin)', 'Extra virgin olive oil', 1, 'tbsp', 120, 0, 0, 14, 0, 'cooking_oil', ARRAY['heart-healthy', 'mediterranean'], 'Store in dark place', 'raw', 0, 0, FALSE, 365, FALSE
FROM component_categories cc WHERE cc.name = 'Fats';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Almonds (raw)', 'Raw whole almonds', 1, 'oz', 160, 6, 6, 14, 3, 'nuts', ARRAY['protein', 'portable'], 'Toast for extra flavor', 'raw', 0, 0, FALSE, 180, TRUE
FROM component_categories cc WHERE cc.name = 'Fats';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Natural Peanut Butter', 'Natural peanut butter, no sugar', 2, 'tbsp', 190, 8, 6, 16, 2, 'nut_butter', ARRAY['protein', 'filling'], 'Stir before using', 'raw', 0, 0, FALSE, 90, FALSE
FROM component_categories cc WHERE cc.name = 'Fats';

-- FRUITS
INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Banana', 'Medium banana', 1, 'count', 105, 1, 27, 0, 3, 'tropical', ARRAY['potassium', 'energy'], 'Best slightly spotted', 'raw', 1, 0, FALSE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Fruits';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Berries (mixed)', 'Mixed berries (strawberry, blueberry, raspberry)', 1, 'cup', 70, 1, 17, 0, 4, 'berries', ARRAY['antioxidants', 'vitamin-c'], 'Wash just before eating', 'raw', 1, 0, FALSE, 5, TRUE
FROM component_categories cc WHERE cc.name = 'Fruits';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Apple', 'Medium apple (any variety)', 1, 'count', 95, 0, 25, 0, 4, 'tree_fruit', ARRAY['fiber', 'portable'], 'Slice for easier eating', 'raw', 1, 0, FALSE, 21, FALSE
FROM component_categories cc WHERE cc.name = 'Fruits';

-- DAIRY
INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Greek Yogurt (plain, 0%)', 'Non-fat plain Greek yogurt', 1, 'cup', 100, 17, 6, 0, 0, 'cultured', ARRAY['high-protein', 'probiotics'], 'Strain for thicker texture', 'raw', 0, 0, FALSE, 14, FALSE
FROM component_categories cc WHERE cc.name = 'Dairy';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Mozzarella Cheese (part-skim)', 'Part-skim mozzarella, shredded', 1, 'oz', 70, 7, 1, 4, 0, 'cheese', ARRAY['calcium', 'protein'], 'Shred fresh for best melt', 'raw', 1, 0, FALSE, 30, TRUE
FROM component_categories cc WHERE cc.name = 'Dairy';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Cottage Cheese (low-fat)', 'Low-fat cottage cheese', 0.5, 'cup', 90, 12, 5, 2, 0, 'cultured', ARRAY['high-protein', 'calcium'], 'Drain excess liquid', 'raw', 0, 0, FALSE, 14, FALSE
FROM component_categories cc WHERE cc.name = 'Dairy';

-- FLAVOR COMPONENTS
INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Salsa (fresh)', 'Fresh tomato salsa', 2, 'tbsp', 10, 0, 2, 0, 0, 'condiment', ARRAY['low-calorie', 'mexican'], 'Refrigerate after opening', 'raw', 0, 0, FALSE, 7, FALSE
FROM component_categories cc WHERE cc.name = 'Flavor Components';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Soy Sauce (low sodium)', 'Low sodium soy sauce', 1, 'tbsp', 10, 1, 1, 0, 0, 'asian', ARRAY['umami', 'asian'], 'Use sparingly', 'raw', 0, 0, FALSE, 365, FALSE
FROM component_categories cc WHERE cc.name = 'Flavor Components';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Garlic (fresh)', 'Fresh garlic cloves', 1, 'tsp', 5, 0, 1, 0, 0, 'aromatic', ARRAY['flavor-base', 'health'], 'Mince just before using', 'raw', 2, 0, FALSE, 30, TRUE
FROM component_categories cc WHERE cc.name = 'Flavor Components';

INSERT INTO components (category_id, name, description, default_portion_size, portion_unit, calories, protein_g, carbs_g, fat_g, fiber_g, subcategory, tags, prep_notes, cooking_method, prep_time_minutes, cook_time_minutes, is_batch_prep_friendly, storage_days, can_freeze)
SELECT cc.id, 'Lime Juice (fresh)', 'Freshly squeezed lime juice', 1, 'tbsp', 5, 0, 1, 0, 0, 'citrus', ARRAY['vitamin-c', 'bright'], 'Use fresh for best flavor', 'raw', 2, 0, FALSE, 3, TRUE
FROM component_categories cc WHERE cc.name = 'Flavor Components';

-- =============================================================================
-- SECTION 18: INITIAL DATA - DEFAULT EQUIPMENT (30+ Items)
-- =============================================================================

-- Major Appliances
INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Standard Oven', 'oven', 'standard', '5 cu ft', '{"temp_range": "170-500F", "convection": false}'::jsonb, 1, 'available', FALSE, 15, TRUE
FROM equipment_categories ec WHERE ec.name = 'Major Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, '4-Burner Stovetop', 'stovetop', '30 inch', '4 burners', '{"heat_levels": "low-high", "type": "gas"}'::jsonb, 1, 'available', FALSE, 10, TRUE
FROM equipment_categories ec WHERE ec.name = 'Major Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Microwave', 'microwave', 'medium', '1.2 cu ft', '{"wattage": 1100, "has_turntable": true}'::jsonb, 1, 'available', FALSE, 3, TRUE
FROM equipment_categories ec WHERE ec.name = 'Major Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Refrigerator', 'refrigerator', 'full', '18 cu ft', '{"has_freezer": true, "ice_maker": false}'::jsonb, 1, 'available', FALSE, 0, TRUE
FROM equipment_categories ec WHERE ec.name = 'Major Appliances';

-- Small Appliances
INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Rice Cooker', 'rice_cooker', 'medium', '6 cups', '{"keep_warm": true, "steamer_basket": true}'::jsonb, 1, 'available', TRUE, 5, TRUE
FROM equipment_categories ec WHERE ec.name = 'Small Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Blender', 'blender', 'standard', '64 oz', '{"speeds": 10, "ice_crush": true}'::jsonb, 1, 'available', TRUE, 3, TRUE
FROM equipment_categories ec WHERE ec.name = 'Small Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Food Processor', 'food_processor', 'medium', '12 cups', '{"slicing_disc": true, "shredding_disc": true}'::jsonb, 1, 'available', TRUE, 5, TRUE
FROM equipment_categories ec WHERE ec.name = 'Small Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Instant Pot', 'pressure_cooker', 'medium', '6 quart', '{"pressure_cook": true, "slow_cook": true, "saute": true, "steam": true}'::jsonb, 1, 'available', TRUE, 8, TRUE
FROM equipment_categories ec WHERE ec.name = 'Small Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Air Fryer', 'air_fryer', 'medium', '5.8 quart', '{"temp_range": "180-400F", "timer": true}'::jsonb, 1, 'available', TRUE, 5, TRUE
FROM equipment_categories ec WHERE ec.name = 'Small Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Electric Kettle', 'kettle', 'standard', '1.7L', '{"auto_shutoff": true, "temp_control": false}'::jsonb, 1, 'available', FALSE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Small Appliances';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Toaster', 'toaster', '2-slice', '2 slots', '{"browning_levels": 7, "bagel_setting": true}'::jsonb, 1, 'available', FALSE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Small Appliances';

-- Cookware
INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Large Skillet', 'skillet', '12 inch', NULL, '{"material": "stainless", "oven_safe": true}'::jsonb, 1, 'available', TRUE, 5, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cookware';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Medium Skillet', 'skillet', '10 inch', NULL, '{"material": "nonstick", "oven_safe": false}'::jsonb, 1, 'available', TRUE, 3, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cookware';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Stock Pot', 'pot', 'large', '8 quart', '{"material": "stainless", "lid_included": true}'::jsonb, 1, 'available', TRUE, 5, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cookware';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Medium Saucepan', 'saucepan', 'medium', '3 quart', '{"material": "stainless", "lid_included": true}'::jsonb, 1, 'available', TRUE, 3, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cookware';

-- =============================================================================
-- SECTION 19: HYDRATION & CAFFEINE TRACKING (Week 1-2 Option B Implementation)
-- =============================================================================

-- Hydration logs - Track water and other beverage intake
CREATE TABLE hydration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Logging details
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount_oz DECIMAL(6,2) NOT NULL CHECK (amount_oz > 0 AND amount_oz <= 128),

    -- Beverage classification
    beverage_type VARCHAR(20) NOT NULL DEFAULT 'water'
        CHECK (beverage_type IN ('water', 'tea', 'other')),

    -- Optional metadata
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Caffeine logs - Track coffee, tea, and soda caffeine intake
CREATE TABLE caffeine_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Logging details
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Beverage details
    beverage_type VARCHAR(20) NOT NULL
        CHECK (beverage_type IN ('coffee', 'tea', 'soda', 'energy_drink', 'other')),
    volume_oz DECIMAL(6,2) NOT NULL CHECK (volume_oz > 0 AND volume_oz <= 64),
    caffeine_mg INTEGER NOT NULL CHECK (caffeine_mg >= 0 AND caffeine_mg <= 1000),

    -- Optional metadata
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User hydration goals - Personalized daily targets
CREATE TABLE user_hydration_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Daily water target (bodyweight / 2 formula or custom)
    daily_water_oz INTEGER NOT NULL DEFAULT 64 CHECK (daily_water_oz >= 32 AND daily_water_oz <= 256),

    -- Daily caffeine limit (FDA recommends max 400mg)
    daily_caffeine_limit_mg INTEGER NOT NULL DEFAULT 400 CHECK (daily_caffeine_limit_mg >= 0 AND daily_caffeine_limit_mg <= 600),

    -- Goal calculation settings
    personalized_formula_enabled BOOLEAN DEFAULT TRUE,
    -- When TRUE: daily_water_oz = user weight (lbs) / 2
    -- Minimum enforced: 64 oz

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One goal record per user
    UNIQUE(user_id)
);

-- Indexes for hydration tracking performance
CREATE INDEX idx_hydration_logs_user_date ON hydration_logs(user_id, logged_at DESC);
CREATE INDEX idx_hydration_logs_today ON hydration_logs(user_id, (logged_at::date));
CREATE INDEX idx_caffeine_logs_user_date ON caffeine_logs(user_id, logged_at DESC);
CREATE INDEX idx_caffeine_logs_today ON caffeine_logs(user_id, (logged_at::date));
CREATE INDEX idx_user_hydration_goals_user ON user_hydration_goals(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_hydration_logs_updated_at BEFORE UPDATE ON hydration_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caffeine_logs_updated_at BEFORE UPDATE ON caffeine_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_hydration_goals_updated_at BEFORE UPDATE ON user_hydration_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create hydration goals when user is created
CREATE OR REPLACE FUNCTION create_default_hydration_goals()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_hydration_goals (user_id, daily_water_oz, daily_caffeine_limit_mg, personalized_formula_enabled)
    VALUES (
        NEW.id,
        GREATEST(64, COALESCE(NEW.current_weight_kg * 2.205 / 2, 64)::INTEGER),  -- weight in lbs / 2, min 64
        400,  -- FDA recommended max
        TRUE
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_hydration_goals_on_user_create
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_default_hydration_goals();

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Small Saucepan', 'saucepan', 'small', '1.5 quart', '{"material": "stainless", "lid_included": true}'::jsonb, 1, 'available', TRUE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cookware';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Cast Iron Skillet', 'skillet', '10 inch', NULL, '{"material": "cast_iron", "pre_seasoned": true}'::jsonb, 1, 'available', FALSE, 5, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cookware';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Wok', 'wok', '14 inch', NULL, '{"material": "carbon_steel", "flat_bottom": true}'::jsonb, 1, 'available', FALSE, 5, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cookware';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Dutch Oven', 'dutch_oven', 'medium', '5.5 quart', '{"material": "enameled_cast_iron", "oven_safe_to": 500}'::jsonb, 1, 'available', TRUE, 8, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cookware';

-- Bakeware
INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Sheet Pan (Half)', 'sheet_pan', 'half', '18x13 inch', '{"material": "aluminum", "rimmed": true}'::jsonb, 2, 'available', TRUE, 3, TRUE
FROM equipment_categories ec WHERE ec.name = 'Bakeware';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Baking Dish (9x13)', 'baking_dish', '9x13 inch', '3 quart', '{"material": "glass", "lid_included": true}'::jsonb, 1, 'available', TRUE, 3, TRUE
FROM equipment_categories ec WHERE ec.name = 'Bakeware';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Roasting Pan', 'roasting_pan', 'large', '16x13 inch', '{"material": "stainless", "rack_included": true}'::jsonb, 1, 'available', TRUE, 8, TRUE
FROM equipment_categories ec WHERE ec.name = 'Bakeware';

-- Tools
INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Silicone Spatula Set', 'spatula', 'assorted', NULL, '{"heat_resistant_to": 600, "count": 3}'::jsonb, 1, 'available', TRUE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Tools';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Tongs', 'tongs', '12 inch', NULL, '{"locking": true, "silicone_tips": true}'::jsonb, 2, 'available', TRUE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Tools';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Wooden Spoon Set', 'spoon', 'assorted', NULL, '{"material": "bamboo", "count": 3}'::jsonb, 1, 'available', FALSE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Tools';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Whisk', 'whisk', '10 inch', NULL, '{"material": "stainless", "balloon_style": true}'::jsonb, 1, 'available', TRUE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Tools';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Colander', 'colander', 'large', '5 quart', '{"material": "stainless", "handles": true}'::jsonb, 1, 'available', TRUE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Tools';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Fine Mesh Strainer', 'strainer', 'medium', '6 inch', '{"material": "stainless", "fine_mesh": true}'::jsonb, 1, 'available', TRUE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Tools';

-- Cutting & Prep
INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Chef Knife', 'knife', '8 inch', NULL, '{"material": "stainless", "style": "german"}'::jsonb, 1, 'available', FALSE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cutting & Prep';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Paring Knife', 'knife', '3.5 inch', NULL, '{"material": "stainless", "style": "utility"}'::jsonb, 1, 'available', FALSE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cutting & Prep';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Cutting Board (Large)', 'cutting_board', 'large', '18x12 inch', '{"material": "wood", "juice_groove": true}'::jsonb, 1, 'available', FALSE, 3, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cutting & Prep';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Cutting Board (Small)', 'cutting_board', 'small', '12x8 inch', '{"material": "plastic", "dishwasher_safe": true}'::jsonb, 2, 'available', TRUE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cutting & Prep';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Box Grater', 'grater', 'standard', NULL, '{"sides": 4, "material": "stainless"}'::jsonb, 1, 'available', TRUE, 3, TRUE
FROM equipment_categories ec WHERE ec.name = 'Cutting & Prep';

-- Measuring
INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Measuring Cup Set', 'measuring_cups', 'set', '1/4 to 1 cup', '{"material": "stainless", "count": 4}'::jsonb, 1, 'available', TRUE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Measuring';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Measuring Spoon Set', 'measuring_spoons', 'set', '1/4 tsp to 1 tbsp', '{"material": "stainless", "count": 5}'::jsonb, 1, 'available', TRUE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Measuring';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Liquid Measuring Cup', 'measuring_cup', '2 cup', '16 oz', '{"material": "glass", "pour_spout": true}'::jsonb, 1, 'available', TRUE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Measuring';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Kitchen Scale', 'scale', 'digital', '11 lb max', '{"units": ["g", "oz", "lb"], "tare_function": true}'::jsonb, 1, 'available', FALSE, 1, TRUE
FROM equipment_categories ec WHERE ec.name = 'Measuring';

-- Storage
INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Glass Meal Prep Containers', 'container', 'medium', '28 oz each', '{"material": "glass", "microwave_safe": true, "count": 6}'::jsonb, 1, 'available', TRUE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Storage';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Plastic Storage Containers', 'container', 'assorted', 'various', '{"material": "plastic", "bpa_free": true, "count": 10}'::jsonb, 1, 'available', TRUE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Storage';

INSERT INTO equipment (user_id, category_id, name, equipment_type, size, capacity, features, quantity, status, is_dishwasher_safe, cleaning_time_minutes, is_active)
SELECT NULL, ec.id, 'Mason Jars', 'jar', 'quart', '32 oz each', '{"material": "glass", "wide_mouth": true, "count": 6}'::jsonb, 1, 'available', TRUE, 2, TRUE
FROM equipment_categories ec WHERE ec.name = 'Storage';

-- =============================================================================
-- SECTION 19: CREATE VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View for user daily nutrition summary
CREATE OR REPLACE VIEW v_user_daily_nutrition AS
SELECT
    u.id AS user_id,
    u.full_name,
    ds.date,
    ds.total_calories,
    ds.total_protein_g,
    ds.total_carbs_g,
    ds.total_fat_g,
    u.daily_calorie_target,
    u.daily_protein_target_g,
    ROUND((ds.total_calories::numeric / NULLIF(u.daily_calorie_target, 0) * 100), 1) AS calorie_adherence_pct,
    ROUND((ds.total_protein_g::numeric / NULLIF(u.daily_protein_target_g, 0) * 100), 1) AS protein_adherence_pct,
    ep.code AS pattern_code,
    ep.name AS pattern_name
FROM users u
JOIN daily_summaries ds ON u.id = ds.user_id
LEFT JOIN eating_patterns ep ON ds.pattern_id = ep.id;

-- View for inventory with freshness status
CREATE OR REPLACE VIEW v_inventory_freshness AS
SELECT
    ii.id,
    ii.user_id,
    COALESCE(c.name, ii.custom_name) AS item_name,
    ii.quantity,
    ii.unit,
    ii.storage_location,
    ii.expiry_date,
    ii.expiry_date - CURRENT_DATE AS days_until_expiry,
    CASE
        WHEN ii.expiry_date < CURRENT_DATE THEN 'expired'
        WHEN ii.expiry_date <= CURRENT_DATE + INTERVAL '2 days' THEN 'critical'
        WHEN ii.expiry_date <= CURRENT_DATE + INTERVAL '5 days' THEN 'warning'
        ELSE 'fresh'
    END AS freshness_status,
    ii.status
FROM inventory_items ii
LEFT JOIN components c ON ii.component_id = c.id
WHERE ii.status != 'out';

-- View for pattern effectiveness summary
CREATE OR REPLACE VIEW v_pattern_effectiveness_summary AS
SELECT
    pe.user_id,
    ep.code,
    ep.name,
    pe.times_used,
    pe.avg_adherence,
    pe.avg_satisfaction,
    pe.avg_energy,
    pe.avg_weight_change_when_used,
    pe.best_schedule_type,
    RANK() OVER (PARTITION BY pe.user_id ORDER BY pe.avg_adherence DESC) AS adherence_rank
FROM pattern_effectiveness pe
JOIN eating_patterns ep ON pe.pattern_id = ep.id;

-- View for shopping list with component details
CREATE OR REPLACE VIEW v_shopping_list_details AS
SELECT
    sl.id AS list_id,
    sl.user_id,
    sl.name AS list_name,
    sl.shopping_date,
    sl.status AS list_status,
    sli.id AS item_id,
    COALESCE(c.name, sli.custom_name) AS item_name,
    sli.quantity,
    sli.unit,
    sli.category,
    sli.estimated_price,
    sli.actual_price,
    sli.is_checked,
    sli.priority,
    sli.source
FROM shopping_lists sl
JOIN shopping_list_items sli ON sl.id = sli.shopping_list_id
LEFT JOIN components c ON sli.component_id = c.id;

-- =============================================================================
-- SECTION 20: ADDITIONAL PARTIAL INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for active inventory items only
CREATE INDEX idx_inventory_active
ON inventory_items(user_id, storage_location)
WHERE status = 'available';

-- Index for pending sync items only
CREATE INDEX idx_sync_pending
ON sync_queue(user_id, created_at)
WHERE status = 'pending';

-- Index for public active meal templates
CREATE INDEX idx_templates_public_active
ON meal_templates(meal_type, created_at DESC)
WHERE is_public = TRUE AND is_active = TRUE;

-- Index for active components
CREATE INDEX idx_components_active
ON components(category_id, name)
WHERE is_active = TRUE;

-- Index for expiring inventory items (next 7 days)
CREATE INDEX idx_inventory_expiring_soon
ON inventory_items(user_id, expiry_date)
WHERE expiry_date IS NOT NULL
  AND expiry_date <= CURRENT_DATE + INTERVAL '7 days'
  AND status = 'available';

-- =============================================================================
-- SECTION 21: FUNCTIONS FOR COMMON OPERATIONS
-- =============================================================================

-- Function to calculate daily nutrition totals
CREATE OR REPLACE FUNCTION calculate_daily_nutrition(
    p_user_id UUID,
    p_date DATE
)
RETURNS TABLE(
    total_calories INTEGER,
    total_protein DECIMAL,
    total_carbs DECIMAL,
    total_fat DECIMAL,
    meal_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(ml.actual_calories), 0)::INTEGER AS total_calories,
        COALESCE(SUM(ml.actual_protein_g), 0) AS total_protein,
        COALESCE(SUM(ml.actual_carbs_g), 0) AS total_carbs,
        COALESCE(SUM(ml.actual_fat_g), 0) AS total_fat,
        COUNT(ml.id)::INTEGER AS meal_count
    FROM meal_logs ml
    WHERE ml.user_id = p_user_id
      AND DATE(ml.logged_at) = p_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get items expiring soon
CREATE OR REPLACE FUNCTION get_expiring_items(
    p_user_id UUID,
    p_days INTEGER DEFAULT 3
)
RETURNS TABLE(
    item_id UUID,
    item_name TEXT,
    quantity DECIMAL,
    unit VARCHAR,
    expiry_date DATE,
    days_until_expiry INTEGER,
    storage_location VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ii.id AS item_id,
        COALESCE(c.name, ii.custom_name) AS item_name,
        ii.quantity,
        ii.unit,
        ii.expiry_date,
        (ii.expiry_date - CURRENT_DATE)::INTEGER AS days_until_expiry,
        ii.storage_location
    FROM inventory_items ii
    LEFT JOIN components c ON ii.component_id = c.id
    WHERE ii.user_id = p_user_id
      AND ii.status = 'available'
      AND ii.expiry_date IS NOT NULL
      AND ii.expiry_date <= CURRENT_DATE + (p_days || ' days')::INTERVAL
    ORDER BY ii.expiry_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to update inventory status based on quantity
CREATE OR REPLACE FUNCTION update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity <= 0 THEN
        NEW.status := 'out';
    ELSIF NEW.low_quantity_threshold IS NOT NULL AND NEW.quantity <= NEW.low_quantity_threshold THEN
        NEW.status := 'low';
    ELSIF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
        NEW.status := 'expired';
    ELSE
        NEW.status := 'available';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply inventory status trigger
CREATE TRIGGER update_inventory_status_trigger
BEFORE INSERT OR UPDATE OF quantity, expiry_date ON inventory_items
FOR EACH ROW EXECUTE FUNCTION update_inventory_status();

-- Function to calculate pattern effectiveness
CREATE OR REPLACE FUNCTION calculate_pattern_effectiveness(
    p_user_id UUID,
    p_pattern_id UUID
)
RETURNS TABLE(
    times_used BIGINT,
    avg_adherence DECIMAL,
    avg_satisfaction DECIMAL,
    avg_energy DECIMAL,
    best_schedule VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(dps.id) AS times_used,
        ROUND(AVG(dps.adherence_rating), 2) AS avg_adherence,
        ROUND(AVG(dps.satisfaction_rating), 2) AS avg_satisfaction,
        ROUND(AVG(dps.energy_rating), 2) AS avg_energy,
        MODE() WITHIN GROUP (ORDER BY dps.schedule_type) AS best_schedule
    FROM daily_pattern_selections dps
    WHERE dps.user_id = p_user_id
      AND dps.pattern_id = p_pattern_id
      AND dps.adherence_rating IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 20: WEEKLY ADS SYSTEM
-- =============================================================================
-- Supports progressive ad upload with 30% -> 85% accuracy learning
-- Includes OCR processing, template matching, and deal extraction

-- Stores reference table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    chain_name VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    store_type VARCHAR(50) CHECK (store_type IN ('grocery', 'warehouse', 'convenience', 'specialty', 'organic', 'discount')),
    logo_url TEXT,
    logo_hash VARCHAR(64),
    website_url TEXT,
    ad_schedule_day VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ad templates for store-specific parsing (must be before weekly_ads for FK)
CREATE TABLE ad_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    template_name VARCHAR(255) NOT NULL,
    version INTEGER DEFAULT 1,
    layout_type VARCHAR(20) CHECK (layout_type IN ('grid', 'list', 'mixed', 'circular', 'custom')),
    page_structure_json JSONB,
    extraction_rules_json JSONB,
    preprocessing_config JSONB,
    accuracy_rate INTEGER DEFAULT 30 CHECK (accuracy_rate BETWEEN 0 AND 100),
    times_used INTEGER DEFAULT 0,
    successful_extractions INTEGER DEFAULT 0,
    failed_extractions INTEGER DEFAULT 0,
    created_by_user_id UUID REFERENCES users(id),
    is_public BOOLEAN DEFAULT FALSE,
    is_official BOOLEAN DEFAULT FALSE,
    parent_template_id UUID REFERENCES ad_templates(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Weekly ads uploaded by users
CREATE TABLE weekly_ads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id),
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ad_period DATE NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('PDF', 'JPG', 'PNG', 'JPEG', 'GIF')),
    file_url TEXT NOT NULL,
    file_size INTEGER,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'complete', 'failed')),
    processing_error TEXT,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    template_id UUID REFERENCES ad_templates(id),
    template_match_confidence INTEGER CHECK (template_match_confidence BETWEEN 0 AND 100),
    ocr_confidence INTEGER CHECK (ocr_confidence BETWEEN 0 AND 100),
    ocr_text TEXT,
    ocr_metadata JSONB,
    deal_count INTEGER DEFAULT 0,
    matched_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Extracted deals from weekly ads
CREATE TABLE ad_deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weekly_ad_id UUID NOT NULL REFERENCES weekly_ads(id) ON DELETE CASCADE,
    product_name VARCHAR(500) NOT NULL,
    product_brand VARCHAR(255),
    product_size VARCHAR(100),
    product_unit VARCHAR(50),
    price DECIMAL(10,2),
    price_unit VARCHAR(50),
    original_price DECIMAL(10,2),
    savings_amount DECIMAL(10,2),
    savings_percent INTEGER,
    deal_type VARCHAR(50) CHECK (deal_type IN ('sale', 'bogo', 'percent_off', 'member', 'clearance', 'bundle')),
    deal_conditions TEXT,
    deal_valid_from DATE,
    deal_valid_until DATE,
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    extraction_method VARCHAR(20) CHECK (extraction_method IN ('regex', 'template', 'ml', 'manual')),
    deal_text_raw TEXT,
    page_number INTEGER,
    coordinates_json JSONB,
    matched_to_component_id UUID REFERENCES components(id),
    match_confidence INTEGER CHECK (match_confidence BETWEEN 0 AND 100),
    match_method VARCHAR(50),
    user_corrected BOOLEAN DEFAULT FALSE,
    correction_timestamp TIMESTAMP WITH TIME ZONE,
    corrected_by_user_id UUID REFERENCES users(id),
    original_values JSONB,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Match deals to shopping list items
CREATE TABLE deal_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ad_deal_id UUID NOT NULL REFERENCES ad_deals(id) ON DELETE CASCADE,
    shopping_list_item_id UUID NOT NULL REFERENCES shopping_list_items(id) ON DELETE CASCADE,
    match_confidence INTEGER CHECK (match_confidence BETWEEN 0 AND 100),
    match_method VARCHAR(50),
    match_factors JSONB,
    user_confirmed BOOLEAN DEFAULT FALSE,
    user_rejected BOOLEAN DEFAULT FALSE,
    auto_applied BOOLEAN DEFAULT FALSE,
    potential_savings DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ad_deal_id, shopping_list_item_id)
);

-- Track template corrections for ML training
CREATE TABLE ad_template_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ad_template_id UUID NOT NULL REFERENCES ad_templates(id) ON DELETE CASCADE,
    weekly_ad_id UUID REFERENCES weekly_ads(id),
    ad_deal_id UUID REFERENCES ad_deals(id),
    correction_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100),
    before_value TEXT,
    after_value TEXT,
    context_json JSONB,
    improved_accuracy BOOLEAN,
    accuracy_delta INTEGER,
    corrected_by_user_id UUID REFERENCES users(id),
    is_training_data BOOLEAN DEFAULT TRUE,
    training_batch_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECTION 20.1: WEEKLY ADS INDEXES
-- =============================================================================

CREATE INDEX idx_weekly_ads_user ON weekly_ads(user_id);
CREATE INDEX idx_weekly_ads_store ON weekly_ads(store_id);
CREATE INDEX idx_weekly_ads_status ON weekly_ads(processing_status);
CREATE INDEX idx_weekly_ads_period ON weekly_ads(ad_period);

CREATE INDEX idx_ad_deals_weekly_ad ON ad_deals(weekly_ad_id);
CREATE INDEX idx_ad_deals_component ON ad_deals(matched_to_component_id);
CREATE INDEX idx_ad_deals_confidence ON ad_deals(confidence_score);

CREATE INDEX idx_deal_matches_deal ON deal_matches(ad_deal_id);
CREATE INDEX idx_deal_matches_shopping_item ON deal_matches(shopping_list_item_id);

CREATE INDEX idx_ad_templates_store ON ad_templates(store_id);
CREATE INDEX idx_ad_templates_accuracy ON ad_templates(accuracy_rate DESC);

-- =============================================================================
-- SECTION 20.2: WEEKLY ADS TRIGGERS
-- =============================================================================

CREATE TRIGGER update_weekly_ads_updated_at BEFORE UPDATE ON weekly_ads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_deals_updated_at BEFORE UPDATE ON ad_deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_templates_updated_at BEFORE UPDATE ON ad_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 20.3: WEEKLY ADS SEED DATA - Common Grocery Stores
-- =============================================================================

INSERT INTO stores (name, chain_name, store_type, ad_schedule_day) VALUES
('Walmart', 'Walmart', 'grocery', 'Wednesday'),
('Target', 'Target', 'grocery', 'Sunday'),
('Kroger', 'Kroger', 'grocery', 'Wednesday'),
('Safeway', 'Albertsons', 'grocery', 'Wednesday'),
('Publix', 'Publix', 'grocery', 'Wednesday'),
('Whole Foods', 'Amazon', 'organic', 'Wednesday'),
('Costco', 'Costco', 'warehouse', 'Wednesday'),
('Aldi', 'Aldi', 'discount', 'Wednesday'),
('Trader Joes', 'Trader Joes', 'specialty', 'Friday'),
('H-E-B', 'H-E-B', 'grocery', 'Wednesday')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SECTION 21: MULTI-STORE OPTIMIZATION (Week 5-6 Implementation)
-- PRD User Story 1.1 - Save $20-40/week through intelligent store routing
-- =============================================================================

-- Store optimization weight profiles - User's preferred optimization settings
CREATE TABLE store_optimization_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Profile identification
    profile_name VARCHAR(50) NOT NULL DEFAULT 'balanced'
        CHECK (profile_name IN ('balanced', 'cost_focused', 'time_focused', 'quality_focused', 'custom')),
    display_name VARCHAR(100),

    -- Optimization weights (must sum to 1.0)
    price_weight DECIMAL(3,2) NOT NULL DEFAULT 0.40 CHECK (price_weight >= 0 AND price_weight <= 1),
    distance_weight DECIMAL(3,2) NOT NULL DEFAULT 0.30 CHECK (distance_weight >= 0 AND distance_weight <= 1),
    quality_weight DECIMAL(3,2) NOT NULL DEFAULT 0.20 CHECK (quality_weight >= 0 AND quality_weight <= 1),
    time_weight DECIMAL(3,2) NOT NULL DEFAULT 0.10 CHECK (time_weight >= 0 AND time_weight <= 1),

    -- Constraint: weights must sum to approximately 1.0
    CONSTRAINT weights_sum_to_one CHECK (
        ABS((price_weight + distance_weight + quality_weight + time_weight) - 1.0) < 0.01
    ),

    -- Profile settings
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One active profile per user
    UNIQUE(user_id, is_active) WHERE is_active = TRUE
);

-- Store routes - Optimized shopping routes for multi-store trips
CREATE TABLE store_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    optimization_profile_id UUID REFERENCES store_optimization_profiles(id) ON DELETE SET NULL,

    -- Route configuration
    start_location_lat DECIMAL(10,8),
    start_location_lng DECIMAL(11,8),
    start_location_address TEXT,

    -- Route optimization results
    route_json JSONB NOT NULL,  -- Full route details including waypoints
    visit_order UUID[],         -- Array of store IDs in optimal visit order

    -- Route metrics
    total_distance_miles DECIMAL(10,2),
    total_time_minutes INTEGER,
    total_estimated_savings DECIMAL(10,2),
    total_estimated_cost DECIMAL(10,2),

    -- Store breakdown
    store_distribution JSONB,   -- Items assigned to each store
    store_savings JSONB,        -- Savings per store

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    optimized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Store item assignments - Which items to buy at which store
CREATE TABLE store_item_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_route_id UUID NOT NULL REFERENCES store_routes(id) ON DELETE CASCADE,
    shopping_list_item_id UUID NOT NULL REFERENCES shopping_list_items(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id),

    -- Assignment details
    price_at_store DECIMAL(10,2),
    quality_rating DECIMAL(3,2),  -- 1-5 scale

    -- Scoring breakdown (for transparency/explanation)
    price_score DECIMAL(5,4),
    distance_score DECIMAL(5,4),
    quality_score DECIMAL(5,4),
    time_score DECIMAL(5,4),
    composite_score DECIMAL(5,4),

    -- Alternative stores considered
    alternatives JSONB,  -- Array of other store options with scores

    -- Manual override
    is_manual_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One assignment per item per route
    UNIQUE(store_route_id, shopping_list_item_id)
);

-- Store user ratings - User ratings for stores
CREATE TABLE store_user_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Overall rating
    overall_rating DECIMAL(3,2) CHECK (overall_rating >= 1 AND overall_rating <= 5),

    -- Category ratings
    price_rating DECIMAL(3,2) CHECK (price_rating >= 1 AND price_rating <= 5),
    quality_rating DECIMAL(3,2) CHECK (quality_rating >= 1 AND quality_rating <= 5),
    service_rating DECIMAL(3,2) CHECK (service_rating >= 1 AND service_rating <= 5),

    -- Estimated visit duration
    avg_visit_duration_minutes INTEGER,

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, store_id)
);

-- Store distance cache - Cache distances between user locations and stores
CREATE TABLE store_distance_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Origin and destination
    origin_lat DECIMAL(10,8) NOT NULL,
    origin_lng DECIMAL(11,8) NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Distance and time
    distance_miles DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    duration_in_traffic_minutes INTEGER,  -- Rush hour estimate

    -- Cache metadata
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',

    -- Index for quick lookup
    UNIQUE(origin_lat, origin_lng, store_id)
);

-- =============================================================================
-- SECTION 21.1: MULTI-STORE OPTIMIZATION INDEXES
-- =============================================================================

CREATE INDEX idx_optimization_profiles_user ON store_optimization_profiles(user_id);
CREATE INDEX idx_optimization_profiles_active ON store_optimization_profiles(user_id, is_active) WHERE is_active = TRUE;

CREATE INDEX idx_store_routes_user ON store_routes(user_id);
CREATE INDEX idx_store_routes_shopping_list ON store_routes(shopping_list_id);
CREATE INDEX idx_store_routes_status ON store_routes(status);

CREATE INDEX idx_store_item_assignments_route ON store_item_assignments(store_route_id);
CREATE INDEX idx_store_item_assignments_store ON store_item_assignments(store_id);

CREATE INDEX idx_store_user_ratings_user ON store_user_ratings(user_id);
CREATE INDEX idx_store_user_ratings_store ON store_user_ratings(store_id);

CREATE INDEX idx_store_distance_cache_origin ON store_distance_cache(origin_lat, origin_lng);
CREATE INDEX idx_store_distance_cache_store ON store_distance_cache(store_id);
CREATE INDEX idx_store_distance_cache_expires ON store_distance_cache(expires_at);

-- =============================================================================
-- SECTION 21.2: MULTI-STORE OPTIMIZATION TRIGGERS
-- =============================================================================

CREATE TRIGGER update_store_optimization_profiles_updated_at BEFORE UPDATE ON store_optimization_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_routes_updated_at BEFORE UPDATE ON store_routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_user_ratings_updated_at BEFORE UPDATE ON store_user_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 21.3: MULTI-STORE OPTIMIZATION SEED DATA - Default Profiles
-- =============================================================================

-- Note: These are template profiles. User-specific profiles are created on first use.
-- The profiles below show the preset configurations available.

-- Preset weight configurations reference:
-- balanced:       price=0.40, distance=0.30, quality=0.20, time=0.10
-- cost_focused:   price=0.70, distance=0.15, quality=0.10, time=0.05
-- time_focused:   price=0.20, distance=0.10, quality=0.20, time=0.50
-- quality_focused: price=0.15, distance=0.20, quality=0.55, time=0.10

-- =============================================================================
-- SECTION 22: GRANTS AND PERMISSIONS (for application user)
-- =============================================================================

-- These would be executed with appropriate role names in production
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO meal_app;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO meal_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO meal_app;

-- =============================================================================
-- SCHEMA COMPLETE
-- Total Tables: 48 (added 5 for Multi-Store Optimization, 6 for Weekly Ads)
-- Domains: 12 (Users, Patterns, Components, Meals, Tracking, Inventory,
--              Equipment, Prep Sessions, Shopping, Analytics, Sync, Optimization)
-- Seed Data: 7 Eating Patterns, 35 Ingredients, 40+ Equipment Items
-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
