"""
Integration tests for Stage 1.0 infrastructure.

Tests the integration of all services:
- WorkflowService with python-statemachine
- AgentService with PydanticAI
- ConversationService with Pocketbase
- MemoryService with Mem0
- WidgetService
"""
import asyncio
import pytest
import sys
from pathlib import Path

# Add backend to path for imports (so 'from src.xxx' works)
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestWorkflowService:
    """Tests for WorkflowService."""

    @pytest.fixture
    def workflow_service(self):
        from src.services.workflow import workflow_service, WorkflowService

        # Register test workflow
        WorkflowService.register_workflow(
            "test_workflow",
            {
                "name": "test_workflow",
                "initial_step": "step1",
                "steps": [
                    {
                        "name": "step1",
                        "agent": "greeter",
                        "is_required": True,
                        "next_step": "step2",
                    },
                    {
                        "name": "step2",
                        "agent": "coordinator",
                        "is_required": True,
                        "next_step": None,
                    },
                ],
            },
        )
        return workflow_service

    def test_register_workflow(self, workflow_service):
        """Test workflow registration."""
        from src.services.workflow import WorkflowService

        workflows = WorkflowService.list_workflows()
        assert "test_workflow" in workflows

    def test_get_workflow_config(self, workflow_service):
        """Test getting workflow config."""
        from src.services.workflow import WorkflowService

        config = WorkflowService.get_workflow_config("test_workflow")
        assert config is not None
        assert config["name"] == "test_workflow"
        assert config["initial_step"] == "step1"
        assert len(config["steps"]) == 2


class TestAgentService:
    """Tests for AgentService."""

    @pytest.fixture
    def agent_service(self):
        from src.services.agent import agent_service, AgentConfig

        # Register test agent
        agent_service.register_config(
            AgentConfig(
                name="test_agent",
                description="Test agent",
                system_prompt="You are a test agent.",
                tools=[],
            )
        )
        return agent_service

    def test_register_agent_config(self, agent_service):
        """Test agent config registration."""
        agents = agent_service.list_agents()
        assert "test_agent" in agents

    def test_get_agent_config(self, agent_service):
        """Test getting agent config."""
        config = agent_service.get_config("test_agent")
        assert config is not None
        assert config.name == "test_agent"
        assert config.system_prompt == "You are a test agent."


class TestConfigLoader:
    """Tests for configuration loading."""

    def test_load_agent_configs(self):
        """Test loading agent configs from files."""
        from src.config_loader import load_agent_configs, AGENTS_DIR
        from src.services.agent import agent_service

        count = load_agent_configs(AGENTS_DIR)
        # Should load at least the 4 agents we created
        assert count >= 4

        # Check that coordinator is loaded
        config = agent_service.get_config("coordinator")
        assert config is not None

    def test_load_workflow_configs(self):
        """Test loading workflow configs from files."""
        from src.config_loader import load_workflow_configs, WORKFLOWS_DIR
        from src.services.workflow import WorkflowService

        count = load_workflow_configs(WORKFLOWS_DIR)
        # Should load at least onboarding
        assert count >= 1

        # Check that onboarding is loaded
        config = WorkflowService.get_workflow_config("onboarding")
        assert config is not None
        assert config["initial_step"] == "greeting"


class TestConversationService:
    """Tests for ConversationService data structures."""

    def test_conversation_data_structure(self):
        """Test ConversationData dataclass."""
        from src.services.conversation import ConversationData

        data = ConversationData(
            id="test-id",
            user_id="user-1",
            agent_name="coordinator",
            status="active",
        )
        assert data.id == "test-id"
        assert data.user_id == "user-1"
        assert data.status == "active"

    def test_message_data_structure(self):
        """Test MessageData dataclass."""
        from src.services.conversation import MessageData

        data = MessageData(
            id="msg-1",
            conversation_id="conv-1",
            role="user",
            content="Hello",
        )
        assert data.id == "msg-1"
        assert data.role == "user"
        assert data.content == "Hello"

    def test_conversation_result_structure(self):
        """Test ConversationResult dataclass."""
        from src.services.conversation import ConversationResult

        result = ConversationResult(
            response="AI response",
            success=True,
            conversation_id="conv-1",
            message_id="msg-1",
        )
        assert result.success is True
        assert result.response == "AI response"


class TestWidgetService:
    """Tests for WidgetService data structures."""

    def test_widget_instance_structure(self):
        """Test WidgetInstance dataclass."""
        from src.services.widget import WidgetInstance

        widget = WidgetInstance(
            id="widget-1",
            message_id="msg-1",
            widget_type="list_input",
            config={"placeholder": "Enter items"},
            status="pending",
        )
        assert widget.id == "widget-1"
        assert widget.widget_type == "list_input"
        assert widget.status == "pending"


class TestDatabaseCollections:
    """Tests for database collection definitions."""

    def test_system_collections_defined(self):
        """Test that all system collections are defined."""
        from src.services.db_init import SYSTEM_COLLECTIONS

        expected = [
            "workflow_instances",
            "inbox_items",
            "conversations",
            "messages",
            "widget_instances",
        ]

        for name in expected:
            assert name in SYSTEM_COLLECTIONS
            assert "fields" in SYSTEM_COLLECTIONS[name]


class TestMemoryService:
    """Tests for MemoryService structure."""

    def test_memory_service_creation(self):
        """Test MemoryService can be instantiated."""
        from src.services.memory import MemoryService

        service = MemoryService(user_id="test-user")
        assert service.user_id == "test-user"


class TestAPIEndpoints:
    """Tests for API endpoint definitions."""

    def test_user_profile_model(self):
        """Test UserProfile model."""
        from src.api.user import UserProfile

        profile = UserProfile(
            user_id="user-1",
            memories=["fact 1", "fact 2"],
            memories_count=2,
        )
        assert profile.user_id == "user-1"
        assert len(profile.memories) == 2

    def test_inbox_item_model(self):
        """Test InboxItem model."""
        from src.api.inbox import InboxItem

        item = InboxItem(
            id="item-1",
            user_id="user-1",
            content="Test item",
            source="chat",
            status="new",
        )
        assert item.content == "Test item"
        assert item.status == "new"

    def test_workflow_instance_response_model(self):
        """Test WorkflowInstanceResponse model."""
        from src.api.workflow import WorkflowInstanceResponse

        instance = WorkflowInstanceResponse(
            id="wf-1",
            user_id="user-1",
            workflow_name="onboarding",
            current_step="greeting",
            status="active",
            context={},
        )
        assert instance.workflow_name == "onboarding"
        assert instance.current_step == "greeting"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
