"""
Structlog Configuration for ML Service
Structured logging for the Python ML service
"""

import sys
import logging
import structlog
from typing import Any, Dict

# Get log level from environment
import os
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()


def configure_logging():
    """Configure structlog for the ML service."""

    # Configure standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, LOG_LEVEL, logging.INFO)
    )

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer() if os.getenv("LOG_FORMAT") == "json"
            else structlog.dev.ConsoleRenderer(colors=True)
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, LOG_LEVEL, logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = None) -> structlog.BoundLogger:
    """Get a configured logger instance."""
    return structlog.get_logger(name or __name__)


class RequestLogger:
    """Middleware for logging HTTP requests."""

    def __init__(self, logger: structlog.BoundLogger = None):
        self.logger = logger or get_logger("http")

    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        user_id: str = None,
        extra: Dict[str, Any] = None
    ):
        """Log an HTTP request."""
        log_data = {
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration_ms": round(duration_ms, 2),
        }

        if user_id:
            log_data["user_id"] = user_id

        if extra:
            log_data.update(extra)

        if status_code >= 500:
            self.logger.error("Request failed", **log_data)
        elif status_code >= 400:
            self.logger.warning("Request error", **log_data)
        else:
            self.logger.info("Request completed", **log_data)


class MLLogger:
    """Logger for ML-specific events."""

    def __init__(self, logger: structlog.BoundLogger = None):
        self.logger = logger or get_logger("ml")

    def log_prediction(
        self,
        model_name: str,
        input_shape: tuple,
        duration_ms: float,
        success: bool = True,
        extra: Dict[str, Any] = None
    ):
        """Log a model prediction."""
        log_data = {
            "model": model_name,
            "input_shape": str(input_shape),
            "duration_ms": round(duration_ms, 2),
            "success": success
        }

        if extra:
            log_data.update(extra)

        if success:
            self.logger.info("Prediction completed", **log_data)
        else:
            self.logger.error("Prediction failed", **log_data)

    def log_training(
        self,
        model_name: str,
        epoch: int,
        loss: float,
        metrics: Dict[str, float] = None
    ):
        """Log training progress."""
        log_data = {
            "model": model_name,
            "epoch": epoch,
            "loss": round(loss, 6)
        }

        if metrics:
            log_data["metrics"] = {k: round(v, 4) for k, v in metrics.items()}

        self.logger.info("Training epoch completed", **log_data)

    def log_model_load(
        self,
        model_name: str,
        duration_ms: float,
        success: bool = True
    ):
        """Log model loading."""
        log_data = {
            "model": model_name,
            "duration_ms": round(duration_ms, 2),
            "success": success
        }

        if success:
            self.logger.info("Model loaded", **log_data)
        else:
            self.logger.error("Model load failed", **log_data)


# Initialize logging on import
configure_logging()

# Export logger instances
logger = get_logger()
request_logger = RequestLogger()
ml_logger = MLLogger()
