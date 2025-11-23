# =============================================================================
# Dockerfile.ml - Python ML Inference Container
# Meal Assistant ML Service
# =============================================================================

# Stage 1: Build
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir structlog sentry-sdk[fastapi] prometheus-client

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM python:3.11-slim AS production

# Create non-root user
RUN groupadd -r mluser && useradd -r -g mluser mluser

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY --chown=mluser:mluser src/ ./src/
COPY --chown=mluser:mluser config/ ./config/
COPY --chown=mluser:mluser models/ ./models/

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Expose port
EXPOSE 8000

# Switch to non-root user
USER mluser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use tini as init process
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the ML service
CMD ["uvicorn", "src.ml.inference.service:app", "--host", "0.0.0.0", "--port", "8000"]
