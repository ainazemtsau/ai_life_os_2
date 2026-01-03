"""
Temporal Activities.

Activities are the building blocks of workflows - they perform
actual work like calling LLMs, accessing databases, sending notifications.
"""

from src.temporal.activities.agent import run_workflow_agent, AgentInput, AgentResult
from src.temporal.activities.memory import search_memories, add_memory, MemorySearchInput, MemoryAddInput
from src.temporal.activities.notify import notify_user, NotifyInput
from src.temporal.activities.pocketbase import (
    create_workflow_instance,
    update_workflow_step,
    complete_workflow,
    save_message,
    get_user_collections,
    get_or_create_conversation,
    CreateWorkflowInput,
    UpdateStepInput,
    SaveMessageInput,
)
from src.temporal.activities.streaming import start_streaming, StartStreamingInput

__all__ = [
    # Agent
    "run_workflow_agent",
    "AgentInput",
    "AgentResult",
    # Streaming
    "start_streaming",
    "StartStreamingInput",
    # Memory
    "search_memories",
    "add_memory",
    "MemorySearchInput",
    "MemoryAddInput",
    # Notify
    "notify_user",
    "NotifyInput",
    # Pocketbase
    "create_workflow_instance",
    "update_workflow_step",
    "complete_workflow",
    "save_message",
    "get_user_collections",
    "get_or_create_conversation",
    "CreateWorkflowInput",
    "UpdateStepInput",
    "SaveMessageInput",
]
