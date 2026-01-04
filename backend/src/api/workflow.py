"""
Workflow API endpoints.

Uses Temporal queries to get workflow state.
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from temporalio.service import RPCError

from src.temporal.client import get_temporal_client
from src.temporal.workflows.onboarding import OnboardingWorkflow, ONBOARDING_STEPS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/workflow", tags=["workflow"])


class WorkflowInstanceResponse(BaseModel):
    """Workflow instance response."""

    id: str
    user_id: str
    workflow_name: str
    current_step: str
    status: str
    context: dict
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class WorkflowStepResponse(BaseModel):
    """Current workflow step response."""

    name: str
    agent: Optional[str] = None
    is_required: bool = True
    completion_criteria: Optional[dict] = None
    next_step: Optional[str] = None


class CurrentWorkflowResponse(BaseModel):
    """Current workflow with step info."""

    instance: Optional[WorkflowInstanceResponse] = None
    current_step: Optional[WorkflowStepResponse] = None


class StartWorkflowRequest(BaseModel):
    """Request to start a workflow."""

    workflow_name: str
    initial_context: Optional[dict] = None


class TransitionRequest(BaseModel):
    """Request to transition workflow step."""

    to_step: str
    data: Optional[dict] = None


class WorkflowSignalRequest(BaseModel):
    """Request to send workflow signal (for testing)."""

    action: str  # complete_step, stay, need_input
    data: Optional[dict] = None
    reason: Optional[str] = None


class WorkflowProgressResponse(BaseModel):
    """Workflow progress information."""

    workflow_id: str
    instance_id: str
    current_step: str
    current_step_index: int
    total_steps: int
    progress_percent: int
    steps_completed: list[str]
    status: str
    # Message count fields
    messages_in_step: int = 0
    min_messages: int = 1
    max_messages: int = 20


@router.get("/current", response_model=CurrentWorkflowResponse)
async def get_current_workflow(
    user_id: str = Query(..., description="User identifier"),
) -> CurrentWorkflowResponse:
    """
    Get current active workflow for user.

    Returns the active workflow instance and current step info from Temporal.
    """
    try:
        client = await get_temporal_client()
        workflow_id = f"onboarding-{user_id}"

        # Try to get workflow state from Temporal
        handle = client.get_workflow_handle(workflow_id)
        state = await handle.query(OnboardingWorkflow.get_state)

        if not state:
            return CurrentWorkflowResponse(instance=None, current_step=None)

        # Build instance response
        current_step = state.get("current_step", "")
        step_config = ONBOARDING_STEPS.get(current_step, {})

        return CurrentWorkflowResponse(
            instance=WorkflowInstanceResponse(
                id=state.get("instance_id", ""),
                user_id=state.get("user_id", user_id),
                workflow_name=state.get("workflow_name", "onboarding"),
                current_step=current_step,
                status=state.get("status", "active"),
                context=state.get("context", {}),
            ),
            current_step=WorkflowStepResponse(
                name=current_step,
                agent=step_config.get("agent"),
                is_required=step_config.get("is_required", True),
                next_step=step_config.get("next"),
            ) if step_config else None,
        )

    except RPCError:
        # Workflow doesn't exist
        return CurrentWorkflowResponse(instance=None, current_step=None)
    except Exception as e:
        logger.error("Error getting workflow state: %s", e)
        return CurrentWorkflowResponse(instance=None, current_step=None)


@router.post("/start", response_model=WorkflowInstanceResponse)
async def start_workflow(
    user_id: str = Query(..., description="User identifier"),
    request: StartWorkflowRequest = ...,
) -> WorkflowInstanceResponse:
    """Start a new workflow for user via Temporal."""
    from src.temporal.worker import TASK_QUEUE

    # Only onboarding workflow is supported for now
    if request.workflow_name != "onboarding":
        raise HTTPException(
            status_code=404,
            detail=f"Workflow '{request.workflow_name}' not found",
        )

    try:
        client = await get_temporal_client()
        workflow_id = f"onboarding-{user_id}"

        # Check if user already has active workflow
        try:
            handle = client.get_workflow_handle(workflow_id)
            state = await handle.query(OnboardingWorkflow.get_state)
            if state and state.get("status") == "active":
                raise HTTPException(
                    status_code=400,
                    detail="User already has an active workflow",
                )
        except RPCError:
            # Workflow doesn't exist, continue to create
            pass

        # Start new workflow
        handle = await client.start_workflow(
            OnboardingWorkflow.run,
            args=[user_id, request.initial_context or {}],
            id=workflow_id,
            task_queue=TASK_QUEUE,
        )

        # Query initial state
        state = await handle.query(OnboardingWorkflow.get_state)

        return WorkflowInstanceResponse(
            id=state.get("instance_id", workflow_id),
            user_id=user_id,
            workflow_name="onboarding",
            current_step=state.get("current_step", "greeting"),
            status="active",
            context=state.get("context", {}),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to start workflow: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start workflow: {str(e)}",
        )


@router.get("/list")
async def list_workflows() -> dict:
    """List available workflow types."""
    # Currently only onboarding is supported
    return {
        "workflows": [
            {
                "name": "onboarding",
                "steps": list(ONBOARDING_STEPS.keys()),
            }
        ]
    }


@router.get("/{user_id}/progress", response_model=WorkflowProgressResponse)
async def get_workflow_progress(user_id: str) -> WorkflowProgressResponse:
    """
    Get workflow progress information from Temporal.

    Returns current step, completed steps, progress percentage,
    and message counts for the current step.
    """
    try:
        client = await get_temporal_client()
        workflow_id = f"onboarding-{user_id}"

        handle = client.get_workflow_handle(workflow_id)
        progress = await handle.query(OnboardingWorkflow.get_progress)

        return WorkflowProgressResponse(
            workflow_id="onboarding",
            instance_id=workflow_id,
            current_step=progress.get("current_step", ""),
            current_step_index=progress.get("completed", 0),
            total_steps=progress.get("total", len(ONBOARDING_STEPS)),
            progress_percent=progress.get("percentage", 0),
            steps_completed=progress.get("steps_completed", []),
            status="active" if progress.get("percentage", 0) < 100 else "completed",
            messages_in_step=progress.get("messages_in_step", 0),
            min_messages=progress.get("min_messages", 1),
            max_messages=progress.get("max_messages", 20),
        )

    except RPCError:
        raise HTTPException(status_code=404, detail="Workflow not found")
    except Exception as e:
        logger.error("Error getting workflow progress: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
