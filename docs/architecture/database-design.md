# Meal Assistant Database Architecture

## Overview

This document describes the database architecture for the Meal Assistant application, designed to support the Flexible Eating System with 7 interchangeable patterns, shared component library, kitchen equipment management, and comprehensive tracking.

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Primary Database | PostgreSQL 15+ | Relational data, transactions, complex queries |
| Media Storage | MongoDB / S3 | Meal photos, progress images, documents |
| Cache | Redis | Session data, real-time equipment status |
| Search | PostgreSQL Full-Text | Component and meal searching |

## Entity Relationship Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USERS & PROFILES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌──────────────────────┐     ┌─────────────────────┐  │
│  │   users     │──┬──│ user_dietary_        │     │   user_goals        │  │
│  │             │  │  │ restrictions         │     │                     │  │
│  │ - id        │  │  │                      │     │ - target_value      │  │
│  │ - email     │  │  │ - restriction_type   │     │ - target_date       │  │
│  │ - profile   │  │  │ - name               │     │ - is_achieved       │  │
│  │ - targets   │  │  │ - severity           │     │                     │  │
│  └─────────────┘  │  └──────────────────────┘     └─────────────────────┘  │
│         │         │                                                         │
│         │         └─────────────────────────────────────────┐               │
└─────────│───────────────────────────────────────────────────│───────────────┘
          │                                                   │
          ▼                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EATING PATTERNS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌────────────────────────┐                       │
│  │ eating_patterns  │◄────│ user_pattern_          │                       │
│  │                  │     │ preferences            │                       │
│  │ - code (A-G)     │     │                        │                       │
│  │ - meal_structure │     │ - preference_rank      │                       │
│  │ - total_calories │     │ - custom_meal_times    │                       │
│  └──────────────────┘     └────────────────────────┘                       │
│          │                                                                  │
│          ▼                                                                  │
│  ┌────────────────────────┐                                                │
│  │ daily_pattern_         │                                                │
│  │ selections             │                                                │
│  │                        │                                                │
│  │ - date                 │                                                │
│  │ - decision_factors     │                                                │
│  │ - ratings              │                                                │
│  └────────────────────────┘                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPONENTS & MEALS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │ component_       │◄────│ components       │────►│ component_       │   │
│  │ categories       │     │                  │     │ variations       │   │
│  │                  │     │ - name           │     │                  │   │
│  │ - Proteins       │     │ - nutrition      │     │ - cooking_method │   │
│  │ - Carbs          │     │ - portion_info   │     │ - modifiers      │   │
│  │ - Vegetables     │     │ - prep_notes     │     │                  │   │
│  │ - etc.           │     │                  │     │                  │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│                                   │                                        │
│                                   ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                         meal_templates                                │ │
│  │                                                                       │ │
│  │  ┌──────────────────┐       ┌────────────────────────────────┐      │ │
│  │  │ meal_templates   │◄──────│ meal_template_components       │      │ │
│  │  │                  │       │                                │      │ │
│  │  │ - name           │       │ - component_id                 │      │ │
│  │  │ - meal_type      │       │ - quantity                     │      │ │
│  │  │ - total_calories │       │ - layer_name                   │      │ │
│  │  │ - instructions   │       │ - is_optional                  │      │ │
│  │  └──────────────────┘       │ - alternative_components       │      │ │
│  │                             └────────────────────────────────┘      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           MEAL TRACKING                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐                             │
│  │ meal_logs        │────►│ meal_log_items   │                             │
│  │                  │     │                  │                             │
│  │ - logged_at      │     │ - component_id   │                             │
│  │ - actual_nutrition│    │ - quantity       │                             │
│  │ - ratings        │     │ - nutrition      │                             │
│  │ - photo_urls     │     │                  │                             │
│  └──────────────────┘     └──────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    INVENTORY & EQUIPMENT                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐                             │
│  │ inventory_items  │────►│ inventory_       │                             │
│  │                  │     │ transactions     │                             │
│  │ - quantity       │     │                  │                             │
│  │ - expiry_date    │     │ - type (add/use) │                             │
│  │ - storage_loc    │     │ - quantity       │                             │
│  └──────────────────┘     └──────────────────┘                             │
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │ equipment_       │◄────│ equipment        │────►│ equipment_       │   │
│  │ categories       │     │                  │     │ usage_logs       │   │
│  │                  │     │ - name           │     │                  │   │
│  │ - Appliances     │     │ - type           │     │ - started_at     │   │
│  │ - Cookware       │     │ - status         │     │ - ended_at       │   │
│  │ - Tools          │     │ - features       │     │ - needs_cleaning │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         PREP SESSIONS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │ prep_sessions    │────►│ prep_session_    │────►│ prep_session_    │   │
│  │                  │     │ tasks            │     │ outputs          │   │
│  │ - scheduled_date │     │                  │     │                  │   │
│  │ - status         │     │ - task_name      │     │ - servings       │   │
│  │ - prep_for_days  │     │ - duration       │     │ - storage_loc    │   │
│  │                  │     │ - equipment      │     │ - expiry_date    │   │
│  └──────────────────┘     │ - dependencies   │     └──────────────────┘   │
│                           └──────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHOPPING                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │ shopping_lists   │────►│ shopping_list_   │     │ stores           │   │
│  │                  │     │ items            │     │                  │   │
│  │ - shopping_date  │     │                  │     │ - name           │   │
│  │ - status         │     │ - quantity       │     │ - address        │   │
│  │ - totals         │     │ - is_checked     │     │ - is_preferred   │   │
│  └──────────────────┘     │ - prices         │     └──────────────────┘   │
│                           └──────────────────┘             │               │
│                                                            ▼               │
│                                               ┌──────────────────┐        │
│                                               │ component_prices │        │
│                                               │                  │        │
│                                               │ - price          │        │
│                                               │ - store_id       │        │
│                                               │ - recorded_date  │        │
│                                               └──────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ANALYTICS                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │ weight_logs      │     │ daily_summaries  │     │ weekly_summaries │   │
│  │                  │     │                  │     │                  │   │
│  │ - weight_kg      │     │ - totals         │     │ - weight_change  │   │
│  │ - measurements   │     │ - ratings        │     │ - averages       │   │
│  │ - photo_url      │     │ - exercise       │     │ - patterns_used  │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│                                                                             │
│                           ┌──────────────────┐                             │
│                           │ pattern_         │                             │
│                           │ effectiveness    │                             │
│                           │                  │                             │
│                           │ - times_used     │                             │
│                           │ - avg_adherence  │                             │
│                           │ - weight_correl  │                             │
│                           └──────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Tables Description

### 1. Users Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Core user profile and targets | email, current_weight, calorie_target |
| `user_dietary_restrictions` | Allergies, intolerances, preferences | type, name, severity |
| `user_goals` | Weight and health goals | target_value, target_date, is_achieved |

### 2. Patterns Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `eating_patterns` | 7 predefined patterns (A-G) | code, meal_structure (JSONB), totals |
| `user_pattern_preferences` | User's pattern rankings | preference_rank, custom overrides |
| `daily_pattern_selections` | Daily pattern log with decision factors | date, ratings, decision factors |

### 3. Components Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `component_categories` | Proteins, Carbs, Vegetables, etc. | name, display_order |
| `components` | Master ingredient library | nutrition, portion info, prep notes |
| `component_variations` | Cooking method variations | modifiers, additional ingredients |

### 4. Meals Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `meal_templates` | Reusable meal recipes | nutrition totals, instructions |
| `meal_template_components` | Components in a meal | quantity, layer, alternatives |
| `meal_template_equipment` | Equipment needed for meal | type, duration, alternatives |

### 5. Tracking Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `meal_logs` | Historical meal consumption | logged_at, actual nutrition, ratings |
| `meal_log_items` | Individual items in logged meal | component, quantity, nutrition |

### 6. Inventory Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `inventory_items` | Current food stock | quantity, expiry, storage location |
| `inventory_transactions` | Usage and addition log | type, quantity, context |

### 7. Equipment Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `equipment_categories` | Equipment organization | name, parent category |
| `equipment` | Kitchen equipment inventory | type, status, features (JSONB) |
| `equipment_usage_logs` | Equipment usage tracking | timing, cleaning status |

### 8. Prep Sessions Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `prep_sessions` | Meal prep orchestration | scheduled date, duration, status |
| `prep_session_tasks` | Individual prep tasks | timing, dependencies, equipment |
| `prep_session_outputs` | What was produced | servings, storage, expiry |

### 9. Shopping Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `shopping_lists` | Shopping list headers | date, status, totals |
| `shopping_list_items` | Items to buy | quantity, checked, prices |
| `stores` | Store information | name, location, preferred |
| `component_prices` | Price history | price, store, date |

### 10. Analytics Domain

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `weight_logs` | Weight and measurement tracking | weight, measurements, date |
| `daily_summaries` | Pre-calculated daily stats | nutrition totals, ratings |
| `weekly_summaries` | Weekly aggregations | weight change, pattern usage |
| `pattern_effectiveness` | Pattern performance metrics | adherence, satisfaction, weight correlation |

## Sample Queries

### Get User's Daily Meal Plan with Pattern

```sql
SELECT
    u.full_name,
    ep.name as pattern_name,
    ep.meal_structure,
    ep.total_calories,
    ep.total_protein_g,
    dps.date,
    dps.schedule_type,
    dps.adherence_rating
FROM users u
JOIN daily_pattern_selections dps ON u.id = dps.user_id
JOIN eating_patterns ep ON dps.pattern_id = ep.id
WHERE u.id = $1 AND dps.date = CURRENT_DATE;
```

### Get Available Components for a Meal Type

```sql
SELECT
    c.id,
    c.name,
    cc.name as category,
    c.subcategory,
    c.calories,
    c.protein_g,
    c.default_portion_size,
    c.portion_unit
FROM components c
JOIN component_categories cc ON c.category_id = cc.id
WHERE c.is_active = TRUE
    AND c.subcategory = 'lean_protein'
ORDER BY c.calories ASC;
```

### Get Weekly Nutrition Summary

```sql
SELECT
    date,
    total_calories,
    total_protein_g,
    total_carbs_g,
    total_fat_g,
    overall_adherence,
    energy_level
FROM daily_summaries
WHERE user_id = $1
    AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### Check Equipment Availability for Prep Session

```sql
SELECT
    e.id,
    e.name,
    e.equipment_type,
    e.status,
    e.quantity,
    COALESCE(active_usage.in_use_count, 0) as currently_in_use
FROM equipment e
LEFT JOIN (
    SELECT
        equipment_id,
        COUNT(*) as in_use_count
    FROM equipment_usage_logs
    WHERE ended_at IS NULL
    GROUP BY equipment_id
) active_usage ON e.id = active_usage.equipment_id
WHERE e.user_id = $1
    AND e.equipment_type = $2
    AND e.status != 'unavailable';
```

### Get Pattern Effectiveness for User

```sql
SELECT
    ep.code,
    ep.name,
    pe.times_used,
    ROUND(pe.avg_adherence, 1) as avg_adherence,
    ROUND(pe.avg_satisfaction, 1) as avg_satisfaction,
    ROUND(pe.avg_weight_change_when_used, 2) as weight_impact,
    pe.best_schedule_type
FROM pattern_effectiveness pe
JOIN eating_patterns ep ON pe.pattern_id = ep.id
WHERE pe.user_id = $1
ORDER BY pe.avg_adherence DESC;
```

### Get Inventory Items Near Expiry

```sql
SELECT
    ii.id,
    COALESCE(c.name, ii.custom_name) as item_name,
    ii.quantity,
    ii.unit,
    ii.expiry_date,
    ii.storage_location,
    ii.expiry_date - CURRENT_DATE as days_until_expiry
FROM inventory_items ii
LEFT JOIN components c ON ii.component_id = c.id
WHERE ii.user_id = $1
    AND ii.status = 'available'
    AND ii.expiry_date IS NOT NULL
    AND ii.expiry_date <= CURRENT_DATE + INTERVAL '3 days'
ORDER BY ii.expiry_date ASC;
```

### Generate Shopping List from Prep Session

```sql
WITH required_components AS (
    SELECT
        mtc.component_id,
        SUM(mtc.quantity) as total_needed,
        mtc.unit
    FROM prep_sessions ps
    JOIN prep_session_tasks pst ON ps.id = pst.prep_session_id
    JOIN meal_template_components mtc ON pst.meal_template_id = mtc.meal_template_id
    WHERE ps.id = $1
    GROUP BY mtc.component_id, mtc.unit
),
inventory_available AS (
    SELECT
        component_id,
        SUM(quantity) as available
    FROM inventory_items
    WHERE user_id = $2 AND status = 'available'
    GROUP BY component_id
)
SELECT
    c.name,
    rc.total_needed,
    COALESCE(ia.available, 0) as in_stock,
    GREATEST(rc.total_needed - COALESCE(ia.available, 0), 0) as to_buy,
    rc.unit,
    cc.name as category
FROM required_components rc
JOIN components c ON rc.component_id = c.id
JOIN component_categories cc ON c.category_id = cc.id
LEFT JOIN inventory_available ia ON rc.component_id = ia.component_id
WHERE rc.total_needed > COALESCE(ia.available, 0)
ORDER BY cc.display_order, c.name;
```

## Migration Strategy

### Phase 1: Core Tables (Week 1)
1. Create users and authentication tables
2. Create eating patterns with seed data
3. Create component categories and components

### Phase 2: Meals and Tracking (Week 2)
1. Create meal templates structure
2. Create meal logging tables
3. Set up initial test data

### Phase 3: Inventory and Equipment (Week 3)
1. Create inventory management tables
2. Create equipment tracking tables
3. Link to meal templates

### Phase 4: Prep and Shopping (Week 4)
1. Create prep session orchestration
2. Create shopping list system
3. Price tracking setup

### Phase 5: Analytics (Week 5)
1. Create analytics tables
2. Set up summary generation triggers
3. Pattern effectiveness tracking

### Phase 6: Sync and Optimization (Week 6)
1. Implement sync queue
2. Add device management
3. Performance optimization

## Indexing Recommendations

### High Priority Indexes (created in schema)

| Table | Index | Purpose |
|-------|-------|---------|
| `meal_logs` | `(user_id, logged_at DESC)` | Timeline queries |
| `inventory_items` | `(user_id, status)` | Available stock queries |
| `daily_summaries` | `(user_id, date DESC)` | Daily lookups |
| `components` | `GIN(to_tsvector(name))` | Full-text search |
| `equipment` | `(user_id, status)` | Equipment availability |

### Partial Indexes for Performance

```sql
-- Active inventory only
CREATE INDEX idx_inventory_active
ON inventory_items(user_id, storage_location)
WHERE status = 'available';

-- Pending sync items only
CREATE INDEX idx_sync_pending
ON sync_queue(user_id, created_at)
WHERE status = 'pending';

-- Public meal templates only
CREATE INDEX idx_templates_public
ON meal_templates(meal_type, created_at DESC)
WHERE is_public = TRUE AND is_active = TRUE;
```

## Offline Sync Design

### Sync Queue Structure

The `sync_queue` table captures all local changes made while offline:

1. **Insert Operations**: Full record data stored in JSONB
2. **Update Operations**: Changed fields only
3. **Delete Operations**: Record ID only

### Conflict Resolution Strategy

| Scenario | Resolution |
|----------|------------|
| Same field edited | Server timestamp wins (last-write-wins) |
| Delete vs Update | Delete wins |
| New records | UUID prevents conflicts |

### Sync Priority

1. **Critical**: Meal logs, weight logs
2. **High**: Inventory updates, shopping list changes
3. **Medium**: Pattern selections, ratings
4. **Low**: Analytics, preferences

## Performance Considerations

### Query Optimization

1. **Pre-calculated Summaries**: `daily_summaries` and `weekly_summaries` avoid expensive aggregations
2. **Partial Indexes**: Only index active records to reduce index size
3. **JSONB for Flexibility**: Pattern structures and equipment features use JSONB for schema flexibility

### Estimated Data Sizes

| Table | Rows/Month | Size/Year |
|-------|------------|-----------|
| meal_logs | ~90/user | ~10MB |
| inventory_transactions | ~200/user | ~5MB |
| daily_summaries | 30/user | ~2MB |
| components | ~500 total | ~1MB |

### Recommended Hardware (Production)

- **Database**: PostgreSQL 15+ on 4+ CPU, 16GB+ RAM
- **Connection Pooling**: PgBouncer with 100 max connections
- **Backup**: Daily full + hourly incremental

## Security Considerations

1. **Password Storage**: bcrypt with cost factor 12
2. **Row-Level Security**: Users can only access their own data
3. **API Keys**: Stored encrypted, rotated regularly
4. **PII Handling**: Weight and health data encrypted at rest

## Future Enhancements

1. **Graph-based Recommendations**: Component pairing suggestions
2. **Time-series Analytics**: Pattern trends over months
3. **Social Features**: Shared meal templates, community patterns
4. **AI Integration**: Meal suggestions based on inventory
