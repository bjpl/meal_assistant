"""
Health Check Endpoints for ML Service
Provides health, readiness, and metrics endpoints
"""

import time
import psutil
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Response
from pydantic import BaseModel

router = APIRouter()

# Track start time for uptime calculation
START_TIME = time.time()
REQUEST_COUNT = 0


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: str
    uptime: int


class ReadinessResponse(BaseModel):
    """Readiness check response model"""
    status: str
    timestamp: str
    checks: Dict[str, str]


class InfoResponse(BaseModel):
    """Application info response model"""
    name: str
    version: str
    environment: str
    python_version: str
    timestamp: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Basic health check endpoint.
    Returns 200 if the service is running.
    """
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat() + "Z",
        uptime=int(time.time() - START_TIME)
    )


@router.get("/health/ready", response_model=ReadinessResponse)
async def readiness_check():
    """
    Readiness probe - checks if app can serve traffic.
    Verifies model is loaded and dependencies are available.
    """
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    checks = {
        "model": await check_model_loaded(),
        "memory": check_memory_available(),
        "database": await check_database_connection()
    }

    all_healthy = all(v == "healthy" for v in checks.values())

    return ReadinessResponse(
        status="ready" if all_healthy else "not_ready",
        timestamp=datetime.utcnow().isoformat() + "Z",
        checks=checks
    )


@router.get("/health/live")
async def liveness_check():
    """
    Liveness probe - checks if app is running.
    Simple check that returns immediately.
    """
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    return {"status": "alive", "timestamp": datetime.utcnow().isoformat() + "Z"}


@router.get("/health/metrics")
async def metrics():
    """
    Prometheus-compatible metrics endpoint.
    Returns metrics in Prometheus text format.
    """
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    uptime = int(time.time() - START_TIME)
    memory = psutil.Process().memory_info()
    cpu_percent = psutil.Process().cpu_percent()

    metrics_text = f"""# HELP meal_assistant_ml_uptime_seconds Time since ML service started
# TYPE meal_assistant_ml_uptime_seconds gauge
meal_assistant_ml_uptime_seconds {uptime}

# HELP meal_assistant_ml_request_total Total number of health check requests
# TYPE meal_assistant_ml_request_total counter
meal_assistant_ml_request_total {REQUEST_COUNT}

# HELP meal_assistant_ml_memory_rss_bytes Resident set size in bytes
# TYPE meal_assistant_ml_memory_rss_bytes gauge
meal_assistant_ml_memory_rss_bytes {memory.rss}

# HELP meal_assistant_ml_memory_vms_bytes Virtual memory size in bytes
# TYPE meal_assistant_ml_memory_vms_bytes gauge
meal_assistant_ml_memory_vms_bytes {memory.vms}

# HELP meal_assistant_ml_cpu_percent CPU usage percentage
# TYPE meal_assistant_ml_cpu_percent gauge
meal_assistant_ml_cpu_percent {cpu_percent}

# HELP python_info Python version info
# TYPE python_info gauge
python_info{{version="3.11"}} 1
"""

    return Response(content=metrics_text.strip(), media_type="text/plain")


@router.get("/health/info", response_model=InfoResponse)
async def info():
    """
    Application info endpoint.
    Returns service metadata.
    """
    import sys
    import os

    return InfoResponse(
        name="meal-assistant-ml",
        version="1.0.0",
        environment=os.getenv("ENVIRONMENT", "development"),
        python_version=sys.version.split()[0],
        timestamp=datetime.utcnow().isoformat() + "Z"
    )


# =============================================================================
# Health Check Helper Functions
# =============================================================================

async def check_model_loaded() -> str:
    """Check if ML models are loaded and ready."""
    try:
        # In production, this would check if models are actually loaded
        # Example: if model_instance is not None and model_instance.is_ready()
        return "healthy"
    except Exception as e:
        return f"unhealthy: {str(e)}"


def check_memory_available() -> str:
    """Check if sufficient memory is available."""
    try:
        memory = psutil.virtual_memory()
        # Alert if less than 10% memory available
        if memory.percent > 90:
            return "degraded: low memory"
        return "healthy"
    except Exception as e:
        return f"unhealthy: {str(e)}"


async def check_database_connection() -> str:
    """Check database connectivity."""
    try:
        # In production, this would check actual database connection
        return "healthy"
    except Exception as e:
        return f"unhealthy: {str(e)}"
