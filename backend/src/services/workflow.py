"""
Workflow Service for managing workflow state machines.

Uses python-statemachine for state management and Pocketbase for persistence.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from statemachine import StateMachine, State

from src.services.pocketbase import pocketbase, PocketbaseError
from src.ai.context import WorkflowContext

logger = logging.getLogger(__name__)


@dataclass
class WorkflowInstance:
    """Workflow instance data."""

    id: str
    user_id: str
    workflow_name: str
    current_step: str
    status: str  # active, completed, paused
    context: dict = field(default_factory=dict)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class DynamicWorkflowMachine(StateMachine):
    """
    Dynamic state machine that can be configured at runtime.

    States and transitions are created from workflow configuration.
    """

    def __init__(self, steps: list[dict], initial_step: str, **kwargs):
        # Create states dynamically
        self._step_configs = {step["name"]: step for step in steps}

        # Build states
        for step in steps:
            state_name = step["name"]
            is_initial = state_name == initial_step
            state = State(state_name, initial=is_initial)
            setattr(self, state_name, state)

        # Build transitions from step configs
        self._transitions = {}
        for step in steps:
            next_step = step.get("next_step")
            if next_step:
                from_state = getattr(self, step["name"])
                to_state = getattr(self, next_step)
                transition_name = f"go_to_{next_step}"
                self._transitions[transition_name] = (from_state, to_state)

        super().__init__(**kwargs)

    def can_go_to(self, step_name: str) -> bool:
        """Check if transition to step is allowed."""
        current = self.current_state.id
        step_config = self._step_configs.get(current)
        if not step_config:
            return False
        return step_config.get("next_step") == step_name

    def get_current_step_config(self) -> Optional[dict]:
        """Get configuration for current step."""
        return self._step_configs.get(self.current_state.id)

    def get_next_step(self) -> Optional[str]:
        """Get the next step name if available."""
        config = self.get_current_step_config()
        return config.get("next_step") if config else None


class WorkflowService:
    """
    Service for managing workflow instances.

    Provides:
    - Workflow creation and lifecycle management
    - State transitions with validation
    - Context data management
    - Persistence to Pocketbase
    """

    # Cache for workflow configurations (loaded from YAML)
    _workflow_configs: dict[str, dict] = {}

    @classmethod
    def register_workflow(cls, name: str, config: dict) -> None:
        """Register a workflow configuration."""
        cls._workflow_configs[name] = config
        logger.info("Registered workflow: %s", name)

    @classmethod
    def get_workflow_config(cls, name: str) -> Optional[dict]:
        """Get workflow configuration by name."""
        return cls._workflow_configs.get(name)

    @classmethod
    def list_workflows(cls) -> list[str]:
        """List all registered workflow names."""
        return list(cls._workflow_configs.keys())

    async def start_workflow(
        self,
        user_id: str,
        workflow_name: str,
        initial_context: Optional[dict] = None,
    ) -> Optional[WorkflowInstance]:
        """
        Start a new workflow instance for a user.

        Args:
            user_id: User identifier
            workflow_name: Name of registered workflow
            initial_context: Optional initial context data

        Returns:
            WorkflowInstance if successful, None otherwise
        """
        config = self.get_workflow_config(workflow_name)
        if not config:
            logger.error("Workflow '%s' not found", workflow_name)
            return None

        initial_step = config.get("initial_step", config["steps"][0]["name"])

        try:
            record = await pocketbase.create_record(
                "workflow_instances",
                {
                    "user_id": user_id,
                    "workflow_name": workflow_name,
                    "current_step": initial_step,
                    "status": "active",
                    "context": initial_context or {},
                    "started_at": datetime.utcnow().isoformat(),
                },
            )

            instance = WorkflowInstance(
                id=record["id"],
                user_id=user_id,
                workflow_name=workflow_name,
                current_step=initial_step,
                status="active",
                context=initial_context or {},
                started_at=record.get("started_at"),
            )

            logger.info(
                "Started workflow '%s' for user %s: %s",
                workflow_name,
                user_id,
                instance.id,
            )
            return instance

        except PocketbaseError as e:
            logger.error("Failed to start workflow: %s", e.message)
            return None

    async def get_instance(self, instance_id: str) -> Optional[WorkflowInstance]:
        """Get workflow instance by ID."""
        try:
            record = await pocketbase.get_record("workflow_instances", instance_id)
            return WorkflowInstance(
                id=record["id"],
                user_id=record["user_id"],
                workflow_name=record["workflow_name"],
                current_step=record["current_step"],
                status=record["status"],
                context=record.get("context", {}),
                started_at=record.get("started_at"),
                completed_at=record.get("completed_at"),
            )
        except PocketbaseError as e:
            logger.error("Failed to get workflow instance: %s", e.message)
            return None

    async def get_active_workflow(self, user_id: str) -> Optional[WorkflowInstance]:
        """Get active workflow instance for a user."""
        try:
            result = await pocketbase.list_records(
                "workflow_instances",
                filter=f'user_id="{user_id}" && status="active"',
                sort="-created",
            )
            items = result.get("items", [])
            if not items:
                return None

            record = items[0]
            return WorkflowInstance(
                id=record["id"],
                user_id=record["user_id"],
                workflow_name=record["workflow_name"],
                current_step=record["current_step"],
                status=record["status"],
                context=record.get("context", {}),
                started_at=record.get("started_at"),
            )
        except PocketbaseError as e:
            logger.error("Failed to get active workflow: %s", e.message)
            return None

    async def get_current_step(self, instance_id: str) -> Optional[dict]:
        """
        Get current step info for a workflow instance.

        Returns step configuration with agent info.
        """
        instance = await self.get_instance(instance_id)
        if not instance:
            return None

        config = self.get_workflow_config(instance.workflow_name)
        if not config:
            return None

        for step in config.get("steps", []):
            if step["name"] == instance.current_step:
                return {
                    "name": step["name"],
                    "agent": step.get("agent"),
                    "is_required": step.get("is_required", True),
                    "completion_criteria": step.get("completion_criteria"),
                    "next_step": step.get("next_step"),
                }
        return None

    async def can_transition(self, instance_id: str, to_step: str) -> bool:
        """Check if transition to step is allowed."""
        instance = await self.get_instance(instance_id)
        if not instance or instance.status != "active":
            return False

        config = self.get_workflow_config(instance.workflow_name)
        if not config:
            return False

        # Find current step config
        for step in config.get("steps", []):
            if step["name"] == instance.current_step:
                return step.get("next_step") == to_step

        return False

    async def transition(
        self,
        instance_id: str,
        to_step: str,
        data: Optional[dict] = None,
    ) -> bool:
        """
        Transition workflow to a new step.

        Args:
            instance_id: Workflow instance ID
            to_step: Target step name
            data: Optional data to merge into context

        Returns:
            True if transition successful
        """
        if not await self.can_transition(instance_id, to_step):
            logger.warning(
                "Invalid transition to '%s' for instance %s",
                to_step,
                instance_id,
            )
            return False

        instance = await self.get_instance(instance_id)
        if not instance:
            return False

        # Merge data into context
        new_context = {**instance.context}
        if data:
            new_context.update(data)

        # Check if this is the final step
        config = self.get_workflow_config(instance.workflow_name)
        is_final = True
        if config:
            for step in config.get("steps", []):
                if step["name"] == to_step and step.get("next_step"):
                    is_final = False
                    break

        try:
            update_data = {
                "current_step": to_step,
                "context": new_context,
            }

            if is_final:
                update_data["status"] = "completed"
                update_data["completed_at"] = datetime.utcnow().isoformat()

            await pocketbase.update_record(
                "workflow_instances",
                instance_id,
                update_data,
            )

            logger.info(
                "Workflow %s transitioned: %s -> %s",
                instance_id,
                instance.current_step,
                to_step,
            )
            return True

        except PocketbaseError as e:
            logger.error("Failed to transition workflow: %s", e.message)
            return False

    async def update_context(
        self,
        instance_id: str,
        data: dict,
    ) -> bool:
        """Update workflow context without changing step."""
        instance = await self.get_instance(instance_id)
        if not instance:
            return False

        new_context = {**instance.context, **data}

        try:
            await pocketbase.update_record(
                "workflow_instances",
                instance_id,
                {"context": new_context},
            )
            return True
        except PocketbaseError as e:
            logger.error("Failed to update context: %s", e.message)
            return False

    async def pause_workflow(self, instance_id: str) -> bool:
        """Pause a workflow instance."""
        try:
            await pocketbase.update_record(
                "workflow_instances",
                instance_id,
                {"status": "paused"},
            )
            logger.info("Paused workflow: %s", instance_id)
            return True
        except PocketbaseError as e:
            logger.error("Failed to pause workflow: %s", e.message)
            return False

    async def resume_workflow(self, instance_id: str) -> bool:
        """Resume a paused workflow instance."""
        try:
            await pocketbase.update_record(
                "workflow_instances",
                instance_id,
                {"status": "active"},
            )
            logger.info("Resumed workflow: %s", instance_id)
            return True
        except PocketbaseError as e:
            logger.error("Failed to resume workflow: %s", e.message)
            return False

    async def complete_workflow(self, instance_id: str) -> bool:
        """Mark workflow as completed."""
        try:
            await pocketbase.update_record(
                "workflow_instances",
                instance_id,
                {
                    "status": "completed",
                    "completed_at": datetime.utcnow().isoformat(),
                },
            )
            logger.info("Completed workflow: %s", instance_id)
            return True
        except PocketbaseError as e:
            logger.error("Failed to complete workflow: %s", e.message)
            return False

    async def get_workflow_context(
        self,
        instance_id: str,
    ) -> Optional[WorkflowContext]:
        """
        Build WorkflowContext for agent execution.

        Contains current step info and historical data
        that agents need to make decisions.
        """
        instance = await self.get_instance(instance_id)
        if not instance:
            return None

        config = self.get_workflow_config(instance.workflow_name)
        if not config:
            return None

        step_info = await self.get_current_step(instance_id)
        if not step_info:
            return None

        # Calculate completed steps
        steps_completed = []
        for step in config.get("steps", []):
            if step["name"] == instance.current_step:
                break
            steps_completed.append(step["name"])

        return WorkflowContext(
            workflow_id=instance.workflow_name,
            instance_id=instance.id,
            current_step=instance.current_step,
            step_agent=step_info.get("agent", "coordinator"),
            is_required=step_info.get("is_required", True),
            steps_completed=steps_completed,
            step_data=instance.context.get("step_data", {}),
            shared=instance.context.get("shared", {}),
        )

    async def process_agent_signal(
        self,
        instance_id: str,
        signal: "WorkflowSignal",
        user_id: str,
    ) -> tuple[bool, Optional[str], Optional["CriteriaResult"]]:
        """
        Process a workflow signal from an agent.

        Args:
            instance_id: The workflow instance ID
            signal: The WorkflowSignal from the agent
            user_id: The user ID

        Returns:
            Tuple of (transitioned, new_step, criteria_result)
            - transitioned: Whether transition occurred
            - new_step: Name of new step if transitioned
            - criteria_result: Result of criteria check if attempted
        """
        from src.models.workflow_signal import WorkflowAction
        from src.services.completion_criteria import (
            check_completion_criteria,
            CriteriaResult,
        )

        # Only process complete_step signals
        if signal.action != WorkflowAction.COMPLETE_STEP:
            # Just update context with signal data if any
            if signal.data:
                await self.update_context(instance_id, signal.data)
            return False, None, None

        instance = await self.get_instance(instance_id)
        if not instance:
            logger.error("Workflow instance not found: %s", instance_id)
            return False, None, None

        # Get current step config
        step_info = await self.get_current_step(instance_id)
        if not step_info:
            logger.error("Current step not found for workflow: %s", instance_id)
            return False, None, None

        # Check completion criteria
        criteria_config = step_info.get(
            "completion_criteria",
            {"type": "agent_signal"},
        )
        criteria_result = await check_completion_criteria(
            criteria_config,
            instance_id,
            user_id,
            signal.data,
        )

        if not criteria_result.satisfied:
            logger.info(
                "Criteria not satisfied for step %s: %s",
                instance.current_step,
                criteria_result.missing,
            )
            return False, None, criteria_result

        # Transition to next step
        next_step = step_info.get("next_step")
        if not next_step:
            # This is the final step, complete the workflow
            await self.complete_workflow(instance_id)
            logger.info("Workflow %s completed", instance_id)
            return True, None, criteria_result

        # Build context update with step completion data
        step_data = instance.context.get("step_data", {})
        step_data[instance.current_step] = {
            "completed_at": datetime.utcnow().isoformat(),
            **(criteria_result.data or {}),
            **(signal.data or {}),
        }

        context_update = {
            "step_data": step_data,
        }

        # Transition to next step
        success = await self.transition(instance_id, next_step, context_update)
        if success:
            logger.info(
                "Workflow %s transitioned: %s -> %s",
                instance_id,
                instance.current_step,
                next_step,
            )
            return True, next_step, criteria_result

        return False, None, criteria_result


# Singleton instance
workflow_service = WorkflowService()
