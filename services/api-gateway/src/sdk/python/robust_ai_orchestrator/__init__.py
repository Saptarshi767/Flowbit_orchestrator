"""
Robust AI Orchestrator Python SDK

This SDK provides a convenient interface for interacting with the
Robust AI Orchestrator API from Python applications.
"""

from .client import RobustAIOrchestrator, create_client
from .types import *
from .exceptions import *

__version__ = "1.0.0"
__author__ = "Robust AI Orchestrator Team"
__email__ = "sdk@robust-ai-orchestrator.com"

__all__ = [
    "RobustAIOrchestrator",
    "create_client",
    # Types
    "ApiResponse",
    "Workflow",
    "Execution",
    "User",
    "Alert",
    "Metric",
    "MarketplaceWorkflow",
    # Exceptions
    "ApiError",
    "ValidationError",
    "AuthenticationError",
    "AuthorizationError",
    "NotFoundError",
    "RateLimitError",
]