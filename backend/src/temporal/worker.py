"""
Temporal Worker.

Runs workflows and activities for the AI Life OS application.
"""
import logging
from typing import Optional

from temporalio.worker import Worker

from src.temporal.client import get_temporal_client
from src.temporal.activities.agent import run_workflow_agent
from src.temporal.activities.streaming import start_streaming
from src.temporal.activities.memory import search_memories, add_memory
from src.temporal.activities.notify import notify_user
from src.temporal.activities.pocketbase import (
    create_workflow_instance,
    update_workflow_step,
    complete_workflow,
    save_message,
    get_user_collections,
    get_or_create_conversation,
)
from src.temporal.activities.config import get_step_configs
from src.temporal.activities.criteria import check_step_criteria
from src.temporal.activities.signal import get_workflow_signal
from src.temporal.workflows.onboarding import OnboardingWorkflow

logger = logging.getLogger(__name__)

# Task queue name for this application
TASK_QUEUE = "ai-life-os"

# Global worker reference for shutdown
_worker: Optional[Worker] = None


async def run_worker() -> None:
    """
    Start the Temporal worker.

    This function blocks until the worker is stopped.
    """
    global _worker

    logger.info("Starting Temporal worker on queue: %s", TASK_QUEUE)

    client = await get_temporal_client()

    _worker = Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[
            OnboardingWorkflow,
        ],
        activities=[
            # Agent
            run_workflow_agent,
            # Streaming
            start_streaming,
            # Memory
            search_memories,
            add_memory,
            # Notify
            notify_user,
            # Pocketbase
            create_workflow_instance,
            update_workflow_step,
            complete_workflow,
            save_message,
            get_user_collections,
            get_or_create_conversation,
            # Config
            get_step_configs,
            # Criteria
            check_step_criteria,
            # Signal
            get_workflow_signal,
        ],
    )

    logger.info("Temporal worker started, processing tasks...")

    try:
        await _worker.run()
    except Exception as e:
        logger.error("Temporal worker error: %s", e)
        raise
    finally:
        _worker = None


async def stop_worker() -> None:
    """Stop the Temporal worker gracefully."""
    global _worker

    if _worker is not None:
        logger.info("Stopping Temporal worker...")
        # Worker will be stopped when run() returns
        _worker = None
