#!/bin/sh
# =============================================================================
# Docker Health Check Script
# Used by Docker containers to verify service health
# =============================================================================

set -e

# Get service type from environment or default
SERVICE_TYPE="${SERVICE_TYPE:-api}"
PORT="${PORT:-3000}"

case $SERVICE_TYPE in
    api)
        # Node.js API health check
        wget --no-verbose --tries=1 --spider "http://localhost:${PORT}/health" || exit 1
        ;;
    ml)
        # Python ML service health check
        curl -f "http://localhost:${PORT}/health" || exit 1
        ;;
    *)
        echo "Unknown service type: $SERVICE_TYPE"
        exit 1
        ;;
esac

exit 0
