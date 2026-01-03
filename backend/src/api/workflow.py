"""
Workflow API endpoints.
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from src.services.workflow import workflow_service, WorkflowService

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


@router.get("/current", response_model=CurrentWorkflowResponse)
async def get_current_workflow(
    user_id: str = Query(..., description="User identifier"),
) -> CurrentWorkflowResponse:
    """
    Get current active workflow for user.

    Returns the active workflow instance and current step info.
    """
    instance = await workflow_service.get_active_workflow(user_id)

    if not instance:
        return CurrentWorkflowResponse(instance=None, current_step=None)

    step_info = await workflow_service.get_current_step(instance.id)

    return CurrentWorkflowResponse(
        instance=WorkflowInstanceResponse(
            id=instance.id,
            user_id=instance.user_id,
            workflow_name=instance.workflow_name,
            current_step=instance.current_step,
            status=instance.status,
            context=instance.context,
            started_at=instance.started_at,
            completed_at=instance.completed_at,
        ),
        current_step=WorkflowStepResponse(**step_info) if step_info else None,
    )


@router.post("/start", response_model=WorkflowInstanceResponse)
async def start_workflow(
    user_id: str = Query(..., description="User identifier"),
    request: StartWorkflowRequest = ...,
) -> WorkflowInstanceResponse:
    """Start a new workflow for user."""
    # Check if workflow exists
    config = WorkflowService.get_workflow_config(request.workflow_name)
    if not config:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow '{request.workflow_name}' not found",
        )

    # Check if user already has active workflow
    existing = await workflow_service.get_active_workflow(user_id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="User already has an active workflow",
        )

    instance = await workflow_service.start_workflow(
        user_id,
        request.workflow_name,
        request.initial_context,
    )

    if not instance:
        raise HTTPException(
            status_code=500,
            detail="Failed to start workflow",
        )

    return WorkflowInstanceResponse(
        id=instance.id,
        user_id=instance.user_id,
        workflow_name=instance.workflow_name,
        current_step=instance.current_step,
        status=instance.status,
        context=instance.context,
        started_at=instance.started_at,
    )


@router.post("/{instance_id}/transition")
async def transition_workflow(
    instance_id: str,
    request: TransitionRequest,
) -> dict:
    """Transition workflow to next step."""
    can_transition = await workflow_service.can_transition(
        instance_id,
        request.to_step,
    )

    if not can_transition:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition to step '{request.to_step}'",
        )

    success = await workflow_service.transition(
        instance_id,
        request.to_step,
        request.data,
    )

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to transition workflow",
        )

    return {"success": True, "new_step": request.to_step}


@router.get("/list")
async def list_workflows() -> dict:
    """List available workflow types."""
    workflows = WorkflowService.list_workflows()
    return {
        "workflows": [
            {
                "name": name,
                "config": WorkflowService.get_workflow_config(name),
            }
            for name in workflows
        ]
    }
