-- =============================================================================
-- PRICE INTELLIGENCE SCHEMA UPDATES
-- Week 7-8: Price Intelligence and Deal Quality Assessment
-- Version: 1.0.0
-- =============================================================================

-- =============================================================================
-- UPDATE EXISTING component_prices TABLE
-- =============================================================================

-- Add new columns to component_prices table
-- Run these ALTER statements if the table already exists

-- Data quality status based on number of price points
-- insufficient: <5 points, emerging: 5-10, reliable: 10-20, mature: 20+
ALTER TABLE component_prices
ADD COLUMN IF NOT EXISTS data_quality_status VARCHAR(20)
    DEFAULT 'insufficient'
    CHECK (data_quality_status IN ('insufficient', 'emerging', 'reliable', 'mature'));

-- Deal tracking fields
ALTER TABLE component_prices
ADD COLUMN IF NOT EXISTS is_deal BOOLEAN DEFAULT FALSE;

ALTER TABLE component_prices
ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2);

ALTER TABLE component_prices
ADD COLUMN IF NOT EXISTS savings_amount DECIMAL(10,2);

-- Deal source tracking
ALTER TABLE component_prices
ADD COLUMN IF NOT EXISTS deal_source VARCHAR(20)
    CHECK (deal_source IN ('ad', 'receipt', 'manual', 'api'));

-- Source reference (ad_id or receipt_id)
ALTER TABLE component_prices
ADD COLUMN IF NOT EXISTS source_reference_id UUID;

-- User who captured the price
ALTER TABLE component_prices
ADD COLUMN IF NOT EXISTS captured_by UUID REFERENCES users(id);

-- =============================================================================
-- PRICE TRENDS TABLE
-- Stores calculated trend data for component/store combinations
-- =============================================================================

CREATE TABLE IF NOT EXISTS price_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

    -- Trend direction
    trend_type VARCHAR(20) NOT NULL CHECK (trend_type IN ('rising', 'falling', 'stable', 'volatile', 'insufficient_data')),
    trend_strength DECIMAL(5,2), -- 0-100 scale indicating how strong the trend is

    -- Rolling averages
    avg_7_day DECIMAL(10,2),
    avg_30_day DECIMAL(10,2),
    avg_60_day DECIMAL(10,2),
    avg_90_day DECIMAL(10,2),

    -- Historical extremes
    historical_low DECIMAL(10,2),
    historical_low_date DATE,
    historical_high DECIMAL(10,2),
    historical_high_date DATE,

    -- Current price position (0-100 percentile)
    current_percentile DECIMAL(5,2),

    -- Standard deviation for volatility
    price_std_dev DECIMAL(10,4),

    -- Data quality
    data_points_count INTEGER DEFAULT 0,
    data_quality_status VARCHAR(20) DEFAULT 'insufficient',

    -- Prediction (only populated when 20+ data points)
    predicted_next_price DECIMAL(10,2),
    prediction_confidence DECIMAL(5,2),
    predicted_low_date DATE,

    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(component_id, store_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_price_trends_component ON price_trends(component_id);
CREATE INDEX IF NOT EXISTS idx_price_trends_store ON price_trends(store_id);
CREATE INDEX IF NOT EXISTS idx_price_trends_trend_type ON price_trends(trend_type);

-- =============================================================================
-- DEAL QUALITY SCORES TABLE
-- Stores quality assessments for deals from weekly ads
-- =============================================================================

CREATE TABLE IF NOT EXISTS deal_quality_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference to the deal being assessed
    ad_deal_id UUID, -- References deals from weekly_ad_deals table
    component_id UUID REFERENCES components(id),
    store_id UUID REFERENCES stores(id),
    user_id UUID REFERENCES users(id),

    -- Deal price being assessed
    deal_price DECIMAL(10,2) NOT NULL,
    regular_price DECIMAL(10,2),

    -- Quality score (1-10 scale)
    quality_score INTEGER NOT NULL CHECK (quality_score BETWEEN 1 AND 10),

    -- Assessment category
    assessment VARCHAR(20) NOT NULL CHECK (assessment IN (
        'excellent', 'good', 'average', 'poor', 'fake_deal', 'insufficient_data'
    )),

    -- Detailed comparisons (percentage difference from benchmarks)
    vs_7_day_avg DECIMAL(10,4),
    vs_30_day_avg DECIMAL(10,4),
    vs_60_day_avg DECIMAL(10,4),
    vs_90_day_avg DECIMAL(10,4),
    vs_historical_low DECIMAL(10,4),
    vs_historical_high DECIMAL(10,4),

    -- Stock-up recommendations
    stock_up_recommended BOOLEAN DEFAULT FALSE,
    recommended_quantity INTEGER,
    stock_up_reason TEXT,

    -- Considerations for recommendation
    storage_days INTEGER, -- How long the item can be stored
    typical_weekly_usage DECIMAL(10,2),
    usage_unit VARCHAR(20),

    -- Deal cycle prediction
    predicted_days_until_next_sale INTEGER,
    next_predicted_sale_date DATE,
    prediction_confidence DECIMAL(5,2),

    -- Analysis notes
    analysis_notes TEXT,

    -- Timestamps
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_deal_quality_ad ON deal_quality_scores(ad_deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_quality_component ON deal_quality_scores(component_id);
CREATE INDEX IF NOT EXISTS idx_deal_quality_store ON deal_quality_scores(store_id);
CREATE INDEX IF NOT EXISTS idx_deal_quality_score ON deal_quality_scores(quality_score);
CREATE INDEX IF NOT EXISTS idx_deal_quality_assessment ON deal_quality_scores(assessment);

-- =============================================================================
-- PRICE ALERTS TABLE
-- Stores user-configured price alerts and their status
-- =============================================================================

CREATE TABLE IF NOT EXISTS price_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id),
    store_id UUID REFERENCES stores(id), -- NULL means any store

    -- Alert configuration
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN (
        'price_drop', 'target_price', 'deal_quality', 'below_average'
    )),

    -- Threshold settings
    target_price DECIMAL(10,2),
    percentage_drop DECIMAL(5,2), -- e.g., 20 for 20% drop
    min_quality_score INTEGER CHECK (min_quality_score BETWEEN 1 AND 10),

    -- Alert status
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,

    -- Notification preferences
    notify_email BOOLEAN DEFAULT TRUE,
    notify_push BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_component ON price_alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active);

-- =============================================================================
-- RECEIPT SCANS TABLE
-- Stores receipt OCR results for price extraction
-- =============================================================================

CREATE TABLE IF NOT EXISTS receipt_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- File information
    file_url TEXT NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size INTEGER,

    -- Store identification
    store_id UUID REFERENCES stores(id),
    store_name VARCHAR(255),
    store_address TEXT,

    -- Receipt metadata
    receipt_date DATE,
    receipt_total DECIMAL(10,2),
    receipt_tax DECIMAL(10,2),
    receipt_subtotal DECIMAL(10,2),

    -- Processing status
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN (
        'pending', 'processing', 'completed', 'failed', 'needs_review'
    )),

    -- OCR results
    raw_text TEXT,
    extracted_items JSONB, -- Array of {name, quantity, unit, price, matched_component_id}
    confidence_score DECIMAL(5,2),

    -- Items matched to components
    items_found INTEGER DEFAULT 0,
    items_matched INTEGER DEFAULT 0,
    prices_captured INTEGER DEFAULT 0,

    -- Error handling
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receipt_scans_user ON receipt_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_store ON receipt_scans(store_id);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_date ON receipt_scans(receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_status ON receipt_scans(processing_status);

-- =============================================================================
-- DEAL CYCLES TABLE
-- Tracks historical deal patterns for prediction
-- =============================================================================

CREATE TABLE IF NOT EXISTS deal_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id),
    store_id UUID REFERENCES stores(id),

    -- Cycle analysis
    avg_days_between_sales DECIMAL(5,1),
    min_days_between_sales INTEGER,
    max_days_between_sales INTEGER,
    sale_frequency_per_month DECIMAL(5,2),

    -- Historical sale dates (JSONB array of {date, price, discount_pct})
    sale_history JSONB,

    -- Patterns detected
    tends_to_sale_on_holidays BOOLEAN DEFAULT FALSE,
    common_sale_days TEXT[], -- e.g., ['Monday', 'Thursday']
    seasonal_pattern VARCHAR(50), -- e.g., 'summer_high', 'year_round', 'holiday_spike'

    -- Prediction
    next_predicted_sale_start DATE,
    next_predicted_sale_end DATE,
    prediction_confidence DECIMAL(5,2),

    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(component_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_cycles_component ON deal_cycles(component_id);
CREATE INDEX IF NOT EXISTS idx_deal_cycles_store ON deal_cycles(store_id);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View: Current prices with trend information
CREATE OR REPLACE VIEW v_component_price_intelligence AS
SELECT
    cp.id AS price_id,
    cp.component_id,
    c.name AS component_name,
    c.category_id,
    cp.store_id,
    s.name AS store_name,
    cp.price,
    cp.price_per_unit,
    cp.recorded_date,
    cp.is_deal,
    cp.savings_amount,
    pt.trend_type,
    pt.avg_30_day,
    pt.avg_90_day,
    pt.historical_low,
    pt.historical_high,
    pt.data_points_count,
    pt.data_quality_status,
    CASE
        WHEN pt.avg_30_day IS NOT NULL AND pt.avg_30_day > 0
        THEN ROUND(((cp.price - pt.avg_30_day) / pt.avg_30_day * 100)::numeric, 2)
        ELSE NULL
    END AS vs_30_day_pct
FROM component_prices cp
JOIN components c ON cp.component_id = c.id
LEFT JOIN stores s ON cp.store_id = s.id
LEFT JOIN price_trends pt ON cp.component_id = pt.component_id
    AND (cp.store_id = pt.store_id OR (cp.store_id IS NULL AND pt.store_id IS NULL));

-- View: Active deals with quality scores
CREATE OR REPLACE VIEW v_active_deals_with_quality AS
SELECT
    dq.id AS quality_id,
    dq.ad_deal_id,
    dq.component_id,
    c.name AS component_name,
    dq.store_id,
    s.name AS store_name,
    dq.deal_price,
    dq.regular_price,
    dq.quality_score,
    dq.assessment,
    dq.vs_30_day_avg,
    dq.vs_historical_low,
    dq.stock_up_recommended,
    dq.recommended_quantity,
    dq.next_predicted_sale_date,
    dq.assessed_at
FROM deal_quality_scores dq
JOIN components c ON dq.component_id = c.id
LEFT JOIN stores s ON dq.store_id = s.id
WHERE dq.assessed_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY dq.quality_score DESC;

-- =============================================================================
-- FUNCTIONS FOR PRICE INTELLIGENCE
-- =============================================================================

-- Function to update data quality status based on price point count
CREATE OR REPLACE FUNCTION update_price_data_quality()
RETURNS TRIGGER AS $$
DECLARE
    price_count INTEGER;
    new_status VARCHAR(20);
BEGIN
    -- Count price points for this component/store combination
    SELECT COUNT(*) INTO price_count
    FROM component_prices
    WHERE component_id = NEW.component_id
      AND (store_id = NEW.store_id OR (NEW.store_id IS NULL AND store_id IS NULL));

    -- Determine quality status
    IF price_count < 5 THEN
        new_status := 'insufficient';
    ELSIF price_count < 10 THEN
        new_status := 'emerging';
    ELSIF price_count < 20 THEN
        new_status := 'reliable';
    ELSE
        new_status := 'mature';
    END IF;

    -- Update the new record
    NEW.data_quality_status := new_status;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update data quality status
DROP TRIGGER IF EXISTS trg_update_price_quality ON component_prices;
CREATE TRIGGER trg_update_price_quality
    BEFORE INSERT ON component_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_price_data_quality();

-- Function to calculate deal quality score
CREATE OR REPLACE FUNCTION calculate_deal_quality_score(
    p_deal_price DECIMAL,
    p_avg_30_day DECIMAL,
    p_avg_90_day DECIMAL,
    p_historical_low DECIMAL
) RETURNS INTEGER AS $$
DECLARE
    vs_30 DECIMAL;
    vs_90 DECIMAL;
    vs_low DECIMAL;
    weighted_score DECIMAL;
BEGIN
    -- Handle NULL cases
    IF p_avg_30_day IS NULL OR p_avg_30_day = 0 THEN
        RETURN 5; -- Default to average if no data
    END IF;

    -- Calculate percentage differences
    vs_30 := (p_deal_price - p_avg_30_day) / p_avg_30_day;
    vs_90 := COALESCE((p_deal_price - p_avg_90_day) / NULLIF(p_avg_90_day, 0), vs_30);
    vs_low := COALESCE((p_deal_price - p_historical_low) / NULLIF(p_historical_low, 0), vs_30);

    -- Calculate weighted score (inverted: negative difference = better deal)
    -- Weight: 40% vs 30-day, 30% vs 90-day, 30% vs historical low
    weighted_score := -1 * (vs_30 * 0.4 + vs_90 * 0.3 + vs_low * 0.3);

    -- Convert to 1-10 scale
    -- < -0.3 (30% below): 10 (excellent)
    -- -0.3 to -0.2: 9
    -- -0.2 to -0.1: 8
    -- -0.1 to -0.05: 7
    -- -0.05 to 0.05: 6
    -- 0.05 to 0.1: 5
    -- 0.1 to 0.2: 4
    -- 0.2 to 0.3: 3
    -- > 0.3: 2 (fake deal)
    -- > 0.5: 1

    IF weighted_score >= 0.3 THEN RETURN 10;
    ELSIF weighted_score >= 0.2 THEN RETURN 9;
    ELSIF weighted_score >= 0.1 THEN RETURN 8;
    ELSIF weighted_score >= 0.05 THEN RETURN 7;
    ELSIF weighted_score >= -0.05 THEN RETURN 6;
    ELSIF weighted_score >= -0.1 THEN RETURN 5;
    ELSIF weighted_score >= -0.2 THEN RETURN 4;
    ELSIF weighted_score >= -0.3 THEN RETURN 3;
    ELSIF weighted_score >= -0.5 THEN RETURN 2;
    ELSE RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SAMPLE DATA FOR TESTING (Optional)
-- =============================================================================

-- This can be uncommented to add sample data for testing

/*
-- Sample price trends
INSERT INTO price_trends (component_id, store_id, trend_type, avg_30_day, avg_90_day, historical_low, historical_high, data_points_count, data_quality_status)
SELECT
    c.id,
    s.id,
    CASE (random() * 3)::int
        WHEN 0 THEN 'rising'
        WHEN 1 THEN 'falling'
        ELSE 'stable'
    END,
    5.99 + random() * 10,
    5.99 + random() * 10,
    3.99 + random() * 2,
    8.99 + random() * 5,
    (random() * 50)::int + 5,
    CASE
        WHEN random() > 0.7 THEN 'mature'
        WHEN random() > 0.4 THEN 'reliable'
        WHEN random() > 0.2 THEN 'emerging'
        ELSE 'insufficient'
    END
FROM components c
CROSS JOIN stores s
WHERE random() > 0.7
ON CONFLICT (component_id, store_id) DO NOTHING;
*/
