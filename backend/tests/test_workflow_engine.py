"""
Integration tests for Stage 1.1 Workflow Engine.

Tests the workflow-agent integration:
- Workflow signals from agents
- Completion criteria checkers
- Step transitions
- Workflow context passing
"""
import pytest
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Add backend to path for imports (so 'from src.xxx' works)
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestWorkflowSignalModels:
    """Tests for WorkflowSignal and AgentOutput models."""

    def test_workflow_action_values(self):
        """Test WorkflowAction enum values."""
        from src.models.workflow_signal import WorkflowAction

        assert WorkflowAction.COMPLETE_STEP == "complete_step"
        assert WorkflowAction.STAY == "stay"
        assert WorkflowAction.NEED_INPUT == "need_input"

    def test_workflow_signal_default(self):
        """Test WorkflowSignal default values."""
        from src.models.workflow_signal import WorkflowSignal, WorkflowAction

        signal = WorkflowSignal()
        assert signal.action == WorkflowAction.STAY
        assert signal.data == {}
        assert signal.reason is None

    def test_workflow_signal_with_data(self):
        """Test WorkflowSignal with data."""
        from src.models.workflow_signal import WorkflowSignal, WorkflowAction

        signal = WorkflowSignal(
            action=WorkflowAction.COMPLETE_STEP,
            data={"key": "value"},
            reason="Test reason",
        )
        assert signal.action == WorkflowAction.COMPLETE_STEP
        assert signal.data == {"key": "value"}
        assert signal.reason == "Test reason"

    def test_agent_output_creation(self):
        """Test AgentOutput creation."""
        from src.models.workflow_signal import AgentOutput, WorkflowSignal

        output = AgentOutput(
            content="Hello",
            workflow_signal=WorkflowSignal(),
        )
        assert output.content == "Hello"
        assert output.workflow_signal is not None

    def test_agent_output_helper_stay(self):
        """Test AgentOutput.stay helper."""
        from src.models.workflow_signal import AgentOutput, WorkflowAction

        output = AgentOutput.stay("Continuing...", {"count": 1})
        assert output.content == "Continuing..."
        assert output.workflow_signal.action == WorkflowAction.STAY
        assert output.workflow_signal.data == {"count": 1}

    def test_agent_output_helper_complete(self):
        """Test AgentOutput.complete helper."""
        from src.models.workflow_signal import AgentOutput, WorkflowAction

        output = AgentOutput.complete(
            "Done!",
            data={"result": "success"},
            reason="User confirmed",
        )
        assert output.content == "Done!"
        assert output.workflow_signal.action == WorkflowAction.COMPLETE_STEP
        assert output.workflow_signal.data == {"result": "success"}
        assert output.workflow_signal.reason == "User confirmed"

    def test_agent_output_helper_need_input(self):
        """Test AgentOutput.need_input helper."""
        from src.models.workflow_signal import AgentOutput, WorkflowAction

        output = AgentOutput.need_input("Please fill the form")
        assert output.content == "Please fill the form"
        assert output.workflow_signal.action == WorkflowAction.NEED_INPUT


class TestCompletionCriteria:
    """Tests for completion criteria checkers."""

    @pytest.mark.asyncio
    async def test_agent_signal_checker(self):
        """Test AgentSignalChecker always returns satisfied."""
        from src.services.completion_criteria import AgentSignalChecker

        checker = AgentSignalChecker()
        result = await checker.check("wf-1", "user-1", {}, {})

        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_auto_complete_checker(self):
        """Test AutoCompleteChecker always returns satisfied."""
        from src.services.completion_criteria import AutoCompleteChecker

        checker = AutoCompleteChecker()
        result = await checker.check("wf-1", "user-1", {}, {})

        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_check_completion_criteria_agent_signal(self):
        """Test check_completion_criteria with agent_signal type."""
        from src.services.completion_criteria import check_completion_criteria

        result = await check_completion_criteria(
            {"type": "agent_signal"},
            "wf-1",
            "user-1",
            {},
        )

        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_check_completion_criteria_unknown_type(self):
        """Test check_completion_criteria with unknown type defaults to agent_signal."""
        from src.services.completion_criteria import check_completion_criteria

        result = await check_completion_criteria(
            {"type": "unknown_type"},
            "wf-1",
            "user-1",
            {},
        )

        # Should fallback to agent_signal which always passes
        assert result.satisfied is True


class TestWorkflowContext:
    """Tests for WorkflowContext dataclass."""

    def test_workflow_context_creation(self):
        """Test WorkflowContext creation."""
        from src.ai.context import WorkflowContext

        context = WorkflowContext(
            workflow_id="onboarding",
            instance_id="wf-123",
            current_step="greeting",
            step_agent="greeter",
            is_required=True,
            steps_completed=["previous"],
            step_data={"key": "value"},
            shared={},
        )

        assert context.workflow_id == "onboarding"
        assert context.current_step == "greeting"
        assert context.step_agent == "greeter"
        assert context.is_required is True

    def test_agent_deps_with_workflow_context(self):
        """Test AgentDeps with workflow context."""
        from src.ai.context import AgentDeps, WorkflowContext

        workflow_context = WorkflowContext(
            workflow_id="onboarding",
            instance_id="wf-123",
            current_step="greeting",
            step_agent="greeter",
            is_required=True,
        )

        deps = AgentDeps(
            user_id="user-1",
            workflow_context=workflow_context,
        )

        assert deps.workflow_context is not None
        assert deps.workflow_context.current_step == "greeting"

    def test_get_workflow_prompt_context(self):
        """Test AgentDeps.get_workflow_prompt_context method."""
        from src.ai.context import AgentDeps, WorkflowContext

        workflow_context = WorkflowContext(
            workflow_id="onboarding",
            instance_id="wf-123",
            current_step="discovery",
            step_agent="discovery",
            is_required=True,
            steps_completed=["greeting"],
        )

        deps = AgentDeps(
            user_id="user-1",
            workflow_context=workflow_context,
        )

        prompt = deps.get_workflow_prompt_context()

        assert "discovery" in prompt
        assert "greeting" in prompt
        assert "REQUIRED" in prompt

    def test_get_workflow_prompt_context_no_workflow(self):
        """Test AgentDeps.get_workflow_prompt_context without workflow."""
        from src.ai.context import AgentDeps

        deps = AgentDeps(user_id="user-1")
        prompt = deps.get_workflow_prompt_context()

        assert prompt == ""


class TestAgentServiceWorkflow:
    """Tests for AgentService workflow methods."""

    def test_agent_response_with_workflow_signal(self):
        """Test AgentResponse includes workflow_signal field."""
        from src.services.agent import AgentResponse
        from src.models.workflow_signal import WorkflowSignal, WorkflowAction

        signal = WorkflowSignal(action=WorkflowAction.COMPLETE_STEP)
        response = AgentResponse(
            content="Done",
            agent_name="greeter",
            workflow_signal=signal,
        )

        assert response.workflow_signal is not None
        assert response.workflow_signal.action == WorkflowAction.COMPLETE_STEP


class TestWorkflowServiceMethods:
    """Tests for WorkflowService new methods."""

    @pytest.fixture
    def setup_workflow(self):
        """Setup test workflow."""
        from src.services.workflow import WorkflowService

        WorkflowService.register_workflow(
            "test_onboarding",
            {
                "name": "test_onboarding",
                "initial_step": "greeting",
                "steps": [
                    {
                        "name": "greeting",
                        "agent": "greeter",
                        "is_required": True,
                        "completion_criteria": {"type": "agent_signal"},
                        "next_step": "discovery",
                    },
                    {
                        "name": "discovery",
                        "agent": "discovery",
                        "is_required": True,
                        "completion_criteria": {"type": "agent_signal"},
                        "next_step": None,
                    },
                ],
            },
        )

    def test_workflow_registered(self, setup_workflow):
        """Test workflow is registered."""
        from src.services.workflow import WorkflowService

        config = WorkflowService.get_workflow_config("test_onboarding")
        assert config is not None
        assert config["initial_step"] == "greeting"


class TestWorkflowProgressEndpoint:
    """Tests for workflow progress response model."""

    def test_workflow_progress_response_model(self):
        """Test WorkflowProgressResponse model."""
        from src.api.workflow import WorkflowProgressResponse

        progress = WorkflowProgressResponse(
            workflow_id="onboarding",
            instance_id="wf-1",
            current_step="discovery",
            current_step_index=1,
            total_steps=4,
            progress_percent=25,
            steps_completed=["greeting"],
            status="active",
        )

        assert progress.current_step == "discovery"
        assert progress.progress_percent == 25
        assert "greeting" in progress.steps_completed


class TestOnboardingWorkflowConfig:
    """Tests for onboarding workflow configuration."""

    def test_onboarding_workflow_loaded(self):
        """Test onboarding workflow is properly configured."""
        from src.config_loader import load_workflow_configs, WORKFLOWS_DIR
        from src.services.workflow import WorkflowService

        load_workflow_configs(WORKFLOWS_DIR)

        config = WorkflowService.get_workflow_config("onboarding")
        assert config is not None
        assert config["initial_step"] == "greeting"

        # Check steps
        steps = config.get("steps", [])
        step_names = [s["name"] for s in steps]
        assert "greeting" in step_names
        assert "discovery" in step_names
        assert "brain_dump" in step_names
        assert "setup_complete" in step_names

    def test_onboarding_steps_have_completion_criteria(self):
        """Test each step has completion_criteria defined."""
        from src.config_loader import load_workflow_configs, WORKFLOWS_DIR
        from src.services.workflow import WorkflowService

        load_workflow_configs(WORKFLOWS_DIR)
        config = WorkflowService.get_workflow_config("onboarding")

        for step in config.get("steps", []):
            assert "completion_criteria" in step, f"Step {step['name']} missing completion_criteria"
            assert "type" in step["completion_criteria"], f"Step {step['name']} missing criteria type"

    def test_onboarding_criteria_types(self):
        """Test completion criteria types are valid."""
        from src.config_loader import load_workflow_configs, WORKFLOWS_DIR
        from src.services.workflow import WorkflowService

        load_workflow_configs(WORKFLOWS_DIR)
        config = WorkflowService.get_workflow_config("onboarding")

        valid_types = {"agent_signal", "agent_signal_memory", "agent_signal_widget", "auto"}

        for step in config.get("steps", []):
            criteria_type = step["completion_criteria"]["type"]
            assert criteria_type in valid_types, f"Invalid criteria type: {criteria_type}"


class TestAgentConfigs:
    """Tests for agent configurations."""

    def test_agents_loaded(self):
        """Test all required agents are loaded."""
        from src.config_loader import load_agent_configs, AGENTS_DIR
        from src.services.agent import agent_service

        load_agent_configs(AGENTS_DIR)

        required_agents = ["coordinator", "greeter", "discovery", "inbox_collector"]
        for agent_name in required_agents:
            config = agent_service.get_config(agent_name)
            assert config is not None, f"Agent {agent_name} not found"

    def test_agents_have_system_prompts(self):
        """Test all agents have system prompts."""
        from src.config_loader import load_agent_configs, AGENTS_DIR
        from src.services.agent import agent_service

        load_agent_configs(AGENTS_DIR)

        for agent_name in agent_service.list_agents():
            config = agent_service.get_config(agent_name)
            assert config.system_prompt, f"Agent {agent_name} missing system_prompt"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
