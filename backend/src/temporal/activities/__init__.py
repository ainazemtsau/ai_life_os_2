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
from src.temporal.activities.config import get_step_configs
from src.temporal.activities.criteria import (
    check_step_criteria,
    CheckCriteriaInput,
    CheckCriteriaResult,
)
from src.temporal.activities.signal import (
    get_workflow_signal,
    GetSignalInput,
    SignalResult,
)

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
    # Config
    "get_step_configs",
    # Criteria
    "check_step_criteria",
    "CheckCriteriaInput",
    "CheckCriteriaResult",
    # Signal
    "get_workflow_signal",
    "GetSignalInput",
    "SignalResult",
]
