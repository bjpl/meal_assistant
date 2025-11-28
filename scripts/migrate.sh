#!/bin/bash
# =============================================================================
# Database Migration Script
# Meal Assistant Application
# =============================================================================

set -e

# Configuration
MIGRATIONS_DIR="${MIGRATIONS_DIR:-./src/database/migrations}"
DATABASE_URL="${DATABASE_URL:-postgresql://meal_user:changeme@localhost:5432/meal_assistant}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if psql is available
if ! command -v psql &> /dev/null; then
    log_error "psql command not found. Please install PostgreSQL client."
    exit 1
fi

# Parse command line arguments
ACTION=${1:-"up"}
VERSION=${2:-""}

case $ACTION in
    up)
        log_info "Running migrations..."

        # Get list of migration files
        for file in $(ls -v "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v rollback); do
            filename=$(basename "$file")

            # Skip if already applied (check schema_migrations table)
            version=$(echo "$filename" | sed 's/[^0-9]*\([0-9]*\).*/\1/' | head -c 5)

            log_info "Applying migration: $filename"

            if psql "$DATABASE_URL" -f "$file"; then
                log_info "Successfully applied: $filename"
            else
                log_error "Failed to apply: $filename"
                exit 1
            fi
        done

        log_info "All migrations applied successfully!"
        ;;

    down)
        if [ -z "$VERSION" ]; then
            log_error "Please specify version to rollback to: ./migrate.sh down 001"
            exit 1
        fi

        rollback_file="$MIGRATIONS_DIR/rollback_${VERSION}.sql"

        if [ ! -f "$rollback_file" ]; then
            log_error "Rollback file not found: $rollback_file"
            exit 1
        fi

        log_warn "Rolling back to version $VERSION..."
        log_warn "This may result in data loss. Press Ctrl+C to cancel."
        sleep 5

        if psql "$DATABASE_URL" -f "$rollback_file"; then
            log_info "Rollback completed successfully!"
        else
            log_error "Rollback failed!"
            exit 1
        fi
        ;;

    status)
        log_info "Checking migration status..."

        psql "$DATABASE_URL" -c "SELECT version, applied_at, description FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"
        ;;

    create)
        if [ -z "$VERSION" ]; then
            log_error "Please specify migration name: ./migrate.sh create add_new_table"
            exit 1
        fi

        # Get next migration number
        last_num=$(ls -v "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v rollback | tail -1 | sed 's/.*\([0-9]\{3\}\).*/\1/' || echo "000")
        next_num=$(printf "%03d" $((10#$last_num + 1)))

        new_file="$MIGRATIONS_DIR/${next_num}_${VERSION}.sql"
        rollback_file="$MIGRATIONS_DIR/rollback_${next_num}.sql"

        # Create migration template
        cat > "$new_file" << EOF
-- =============================================================================
-- Migration: ${next_num}_${VERSION}
-- Description: TODO: Add description
-- Version: 1.0.${next_num}
-- =============================================================================

-- Check if migration was already applied
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '1.0.${next_num}') THEN
        RAISE NOTICE 'Migration 1.0.${next_num} already applied, skipping...';
        RETURN;
    END IF;

    -- TODO: Add your migration SQL here

    -- Record migration
    INSERT INTO schema_migrations (version, description)
    VALUES ('1.0.${next_num}', '${VERSION}');

    RAISE NOTICE 'Migration 1.0.${next_num} applied successfully';
END
\$\$;
EOF

        # Create rollback template
        cat > "$rollback_file" << EOF
-- =============================================================================
-- Rollback: ${next_num}_${VERSION}
-- Description: Rollback for migration ${next_num}
-- =============================================================================

-- TODO: Add your rollback SQL here

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '1.0.${next_num}';
EOF

        log_info "Created migration: $new_file"
        log_info "Created rollback: $rollback_file"
        ;;

    *)
        echo "Usage: $0 {up|down|status|create} [version/name]"
        echo ""
        echo "Commands:"
        echo "  up              Apply all pending migrations"
        echo "  down VERSION    Rollback to specific version (e.g., down 001)"
        echo "  status          Show migration status"
        echo "  create NAME     Create new migration files"
        exit 1
        ;;
esac
