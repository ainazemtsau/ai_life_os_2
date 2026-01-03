"""
Temporal Client singleton.

Provides a shared Temporal client for the entire application.
"""
import logging
from typing import Optional

from temporalio.client import Client

from src.config import settings

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


async def get_temporal_client() -> Client:
    """
    Get or create Temporal client singleton.

    Returns:
        Connected Temporal client
    """
    global _client

    if _client is None:
        logger.info("Connecting to Temporal server at %s", settings.temporal_host)
        _client = await Client.connect(settings.temporal_host)
        logger.info("Connected to Temporal server")

    return _client


async def close_temporal_client() -> None:
    """Close the Temporal client connection."""
    global _client

    if _client is not None:
        # Client doesn't have explicit close, just clear reference
        _client = None
        logger.info("Temporal client reference cleared")
