"""
Temporal integration for AI Life OS.

This package provides Temporal workflows and activities for durable
workflow execution, replacing python-statemachine.

Note: Do not import client/activities here to avoid Temporal sandbox issues.
Import directly from submodules instead:
  from src.temporal.client import get_temporal_client
  from src.temporal.worker import run_worker, TASK_QUEUE
"""
