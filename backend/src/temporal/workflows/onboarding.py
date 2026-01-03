"""
Onboarding Workflow.

Guides new users through the onboarding process:
1. greeting - Welcome with greeter agent
2. discovery - Learn about user with discovery agent
3. brain_dump - Collect thoughts with inbox_collector agent
4. setup_complete - Finish with coordinator agent
"""
import logging
from dataclasses import dataclass, field, asdict
from datetime import timedelta
from typing import Any, Optional

from temporalio import workflow

# Import activities with activity stubs
with workflow.unsafe.imports_passed_through():
    from src.temporal.activities import (
        run_workflow_agent,
        AgentInput,
        start_streaming,
        StartStreamingInput,
        search_memories,
        MemorySearchInput,
        add_memory,
        MemoryAddInput,
        notify_user,
        NotifyInput,
        create_workflow_instance,
        CreateWorkflowInput,
        update_workflow_step,
        UpdateStepInput,
        save_message,
        SaveMessageInput,
        get_user_collections,
        get_or_create_conversation,
    )
    from src.temporal.activities.pocketbase import complete_workflow
    from src.temporal.workflows.mixins import StreamingMixin, StreamingResult

logger = logging.getLogger(__name__)


@dataclass
class WorkflowState:
    """Serializable workflow state."""

    workflow_name: str
    current_step: str
    user_id: str
    instance_id: str = ""
    conversation_id: str = ""
    context: dict = field(default_factory=dict)
    steps_completed: list[str] = field(default_factory=list)
    status: str = "active"


@dataclass
class UserMessage:
    """Signal payload for user messages."""

    content: str
    conversation_id: Optional[str] = None
    request_id: Optional[str] = None  # For streaming support


# Step configuration
ONBOARDING_STEPS = {
    "greeting": {
        "agent": "greeter",
        "next": "discovery",
        "is_required": True,
    },
    "discovery": {
        "agent": "discovery",
        "next": "brain_dump",
        "is_required": True,
    },
    "brain_dump": {
        "agent": "inbox_collector",
        "next": "setup_complete",
        "is_required": True,
    },
    "setup_complete": {
        "agent": "coordinator",
        "next": None,  # Final step
        "is_required": False,
    },
}


@workflow.defn
class OnboardingWorkflow(StreamingMixin):
    """
    Onboarding workflow for new users.

    Handles:
    - User messages via signals
    - Step transitions
    - Agent execution with streaming
    - Response delivery via WebSocket
    """

    def __init__(self):
        self.state: Optional[WorkflowState] = None
        self.pending_messages: list[UserMessage] = []
        self._init_streaming()  # Initialize streaming mixin

    @workflow.signal
    async def user_message(self, message: UserMessage) -> None:
        """Receive user message from API."""
        self.pending_messages.append(message)

    @workflow.signal
    async def user_connected(self) -> None:
        """Handle user connection event."""
        # Could trigger proactive greeting in future
        pass

    @workflow.query
    def get_state(self) -> dict:
        """Query current workflow state."""
        if self.state is None:
            return {}
        return asdict(self.state)

    @workflow.query
    def get_current_step(self) -> str:
        """Query current step name."""
        if self.state is None:
            return ""
        return self.state.current_step

    @workflow.query
    def get_progress(self) -> dict:
        """Query workflow progress."""
        if self.state is None:
            return {"completed": 0, "total": len(ONBOARDING_STEPS), "percentage": 0}

        completed = len(self.state.steps_completed)
        total = len(ONBOARDING_STEPS)

        return {
            "completed": completed,
            "total": total,
            "percentage": int((completed / total) * 100) if total > 0 else 0,
            "current_step": self.state.current_step,
            "steps_completed": self.state.steps_completed,
        }

    @workflow.run
    async def run(self, user_id: str, initial_context: Optional[dict] = None) -> dict:
        """
        Main workflow execution.

        Args:
            user_id: User ID
            initial_context: Optional initial context data

        Returns:
            Final workflow state as dict
        """
        workflow.logger.info("Starting onboarding workflow for user: %s", user_id)

        # Initialize state
        self.state = WorkflowState(
            workflow_name="onboarding",
            current_step="greeting",
            user_id=user_id,
            context=initial_context or {},
        )

        # Create workflow instance in database
        self.state.instance_id = await workflow.execute_activity(
            create_workflow_instance,
            CreateWorkflowInput(
                user_id=user_id,
                workflow_name="onboarding",
                initial_step="greeting",
                temporal_workflow_id=workflow.info().workflow_id,
            ),
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Get or create conversation
        self.state.conversation_id = await workflow.execute_activity(
            get_or_create_conversation,
            args=[user_id, self.state.instance_id],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Notify: workflow started
        await workflow.execute_activity(
            notify_user,
            NotifyInput(
                user_id=user_id,
                event_type="workflow.started",
                payload={
                    "workflow_id": self.state.instance_id,
                    "workflow_name": "onboarding",
                    "current_step": "greeting",
                },
            ),
            start_to_close_timeout=timedelta(seconds=10),
        )

        # Main workflow loop
        while self.state.status == "active":
            # Wait for user message
            await workflow.wait_condition(lambda: len(self.pending_messages) > 0)

            # Process message
            message = self.pending_messages.pop(0)
            await self._process_message(message)

            # Check if workflow is completed
            if self.state.status == "completed":
                break

        # Mark workflow as completed in DB
        await workflow.execute_activity(
            complete_workflow,
            args=[self.state.instance_id],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Notify: workflow completed
        await workflow.execute_activity(
            notify_user,
            NotifyInput(
                user_id=user_id,
                event_type="workflow.completed",
                payload={
                    "workflow_id": self.state.instance_id,
                    "workflow_name": "onboarding",
                },
            ),
            start_to_close_timeout=timedelta(seconds=10),
        )

        workflow.logger.info("Onboarding workflow completed for user: %s", user_id)
        return asdict(self.state)

    async def _process_message(self, message: UserMessage) -> None:
        """Process a user message."""
        step_config = ONBOARDING_STEPS.get(self.state.current_step)
        if not step_config:
            workflow.logger.error("Unknown step: %s", self.state.current_step)
            return

        # Save user message
        await workflow.execute_activity(
            save_message,
            SaveMessageInput(
                conversation_id=self.state.conversation_id,
                role="user",
                content=message.content,
            ),
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Load context for agent
        memories = await workflow.execute_activity(
            search_memories,
            MemorySearchInput(
                user_id=self.state.user_id,
                query=message.content,
                limit=5,
            ),
            start_to_close_timeout=timedelta(seconds=30),
        )

        collections = await workflow.execute_activity(
            get_user_collections,
            args=[self.state.user_id],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Build workflow context for agent
        workflow_context = {
            "workflow_id": self.state.workflow_name,
            "instance_id": self.state.instance_id,
            "current_step": self.state.current_step,
            "step_agent": step_config["agent"],
            "is_required": step_config["is_required"],
            "steps_completed": self.state.steps_completed,
            "step_data": self.state.context.get("step_data", {}),
            "shared": self.state.context.get("shared", {}),
        }

        # Choose execution path based on request_id
        use_streaming = message.request_id is not None

        if use_streaming:
            # Streaming path: start_streaming -> wait for signal
            agent_result = await self._process_with_streaming(
                message=message,
                step_config=step_config,
                workflow_context=workflow_context,
                collections=collections,
                memories=memories,
            )
        else:
            # Legacy path: run_workflow_agent -> notify
            agent_result = await self._process_without_streaming(
                message=message,
                step_config=step_config,
                workflow_context=workflow_context,
                collections=collections,
                memories=memories,
            )

        # Save assistant message
        await workflow.execute_activity(
            save_message,
            SaveMessageInput(
                conversation_id=self.state.conversation_id,
                role="assistant",
                content=agent_result.content,
                agent_name=step_config["agent"],
            ),
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Add to memory
        await workflow.execute_activity(
            add_memory,
            MemoryAddInput(
                user_id=self.state.user_id,
                messages=[
                    {"role": "user", "content": message.content},
                    {"role": "assistant", "content": agent_result.content},
                ],
            ),
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Process workflow signal
        await self._process_signal(agent_result.workflow_signal, step_config)

    async def _process_with_streaming(
        self,
        message: UserMessage,
        step_config: dict,
        workflow_context: dict,
        collections: list,
        memories: list,
    ):
        """Process message with streaming (sends chunks via WebSocket)."""
        from src.temporal.activities import AgentResult

        workflow.logger.info(
            "Processing with streaming, request_id=%s",
            message.request_id,
        )

        # Start streaming (non-blocking)
        await workflow.execute_activity(
            start_streaming,
            StartStreamingInput(
                request_id=message.request_id,
                user_id=self.state.user_id,
                conversation_id=self.state.conversation_id,
                workflow_id=workflow.info().workflow_id,
                agent_name=step_config["agent"],
                user_message=message.content,
                workflow_context=workflow_context,
                collections=collections,
                memories=memories,
            ),
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Wait for streaming to complete (via signal)
        streaming_result = await self.wait_for_stream(message.request_id)

        # Convert StreamingResult to AgentResult format
        workflow_signal = {"action": "stay", "data": {}, "reason": ""}
        if streaming_result.is_error:
            workflow.logger.error(
                "Streaming failed: %s",
                streaming_result.error,
            )

        return AgentResult(
            content=streaming_result.content,
            workflow_signal=workflow_signal,
            metadata={},
        )

    async def _process_without_streaming(
        self,
        message: UserMessage,
        step_config: dict,
        workflow_context: dict,
        collections: list,
        memories: list,
    ):
        """Process message without streaming (legacy path)."""
        # Notify: thinking
        await workflow.execute_activity(
            notify_user,
            NotifyInput(
                user_id=self.state.user_id,
                event_type="thinking",
                payload={},
            ),
            start_to_close_timeout=timedelta(seconds=10),
        )

        # Run agent (blocking)
        agent_result = await workflow.execute_activity(
            run_workflow_agent,
            AgentInput(
                agent_name=step_config["agent"],
                message=message.content,
                user_id=self.state.user_id,
                workflow_context=workflow_context,
                collections=collections,
                memories=memories,
            ),
            start_to_close_timeout=timedelta(minutes=2),
        )

        # Notify: new message (legacy format)
        await workflow.execute_activity(
            notify_user,
            NotifyInput(
                user_id=self.state.user_id,
                event_type="message.new",
                payload={
                    "message": {
                        "id": str(workflow.uuid4()),
                        "role": "assistant",
                        "content": agent_result.content,
                        "agent_name": step_config["agent"],
                    },
                },
            ),
            start_to_close_timeout=timedelta(seconds=10),
        )

        return agent_result

    async def _process_signal(self, signal: dict, step_config: dict) -> None:
        """Process workflow signal from agent."""
        action = signal.get("action", "stay")
        data = signal.get("data", {})

        workflow.logger.info(
            "Processing signal: action=%s for step=%s",
            action,
            self.state.current_step,
        )

        # Store step data
        if data:
            step_data = self.state.context.get("step_data", {})
            step_data[self.state.current_step] = data
            self.state.context["step_data"] = step_data

        if action == "complete_step":
            await self._transition_step(step_config)
        elif action == "need_input":
            # Widget handling would go here
            pass
        # "stay" action - continue on current step (default)

    async def _transition_step(self, step_config: dict) -> None:
        """Handle step transition."""
        old_step = self.state.current_step
        next_step = step_config.get("next")

        if next_step is None:
            # Workflow complete
            self.state.steps_completed.append(old_step)
            self.state.status = "completed"
            workflow.logger.info("Workflow completed at step: %s", old_step)
            return

        # Transition to next step
        self.state.steps_completed.append(old_step)
        self.state.current_step = next_step

        # Update DB
        await workflow.execute_activity(
            update_workflow_step,
            UpdateStepInput(
                instance_id=self.state.instance_id,
                new_step=next_step,
                context_update=self.state.context,
            ),
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Get new step config
        new_step_config = ONBOARDING_STEPS.get(next_step, {})

        # Notify: step changed
        await workflow.execute_activity(
            notify_user,
            NotifyInput(
                user_id=self.state.user_id,
                event_type="workflow.step_changed",
                payload={
                    "workflow_id": self.state.instance_id,
                    "previous_step": old_step,
                    "step": next_step,
                    "agent": new_step_config.get("agent"),
                },
            ),
            start_to_close_timeout=timedelta(seconds=10),
        )

        # Notify: agent changed
        if new_step_config.get("agent"):
            await workflow.execute_activity(
                notify_user,
                NotifyInput(
                    user_id=self.state.user_id,
                    event_type="agent.changed",
                    payload={
                        "agent": new_step_config.get("agent"),
                    },
                ),
                start_to_close_timeout=timedelta(seconds=10),
            )

        workflow.logger.info(
            "Transitioned from '%s' to '%s'",
            old_step,
            next_step,
        )
