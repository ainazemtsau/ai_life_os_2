"""
Agent Service for managing AI agents.

Provides a registry for loading and accessing PydanticAI agents
configured via YAML files.
"""
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

import yaml
from pydantic_ai import Agent

from src.config import settings
from src.ai.context import AgentDeps

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Configuration for an AI agent."""

    name: str
    description: str
    system_prompt: str
    model: Optional[str] = None  # Override default model
    tools: list[str] = field(default_factory=list)
    response_format: Optional[dict] = None


@dataclass
class AgentResponse:
    """Standardized agent response."""

    content: str
    agent_name: str
    metadata: dict = field(default_factory=dict)


class AgentService:
    """
    Service for managing AI agents.

    Features:
    - Load agent configs from YAML
    - Create and cache PydanticAI agents
    - Run agents with standardized response format
    """

    def __init__(self):
        self._configs: dict[str, AgentConfig] = {}
        self._agents: dict[str, Agent] = {}
        self._tools: dict[str, Callable] = {}

    def register_tool(self, name: str, func: Callable) -> None:
        """Register a tool that can be used by agents."""
        self._tools[name] = func
        logger.debug("Registered tool: %s", name)

    def register_tools(self, tools: dict[str, Callable]) -> None:
        """Register multiple tools at once."""
        for name, func in tools.items():
            self.register_tool(name, func)

    def load_config(self, config_path: Path) -> Optional[AgentConfig]:
        """Load agent configuration from YAML file."""
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            config = AgentConfig(
                name=data["name"],
                description=data.get("description", ""),
                system_prompt=data.get("system_prompt", ""),
                model=data.get("model"),
                tools=data.get("tools", []),
                response_format=data.get("response_format"),
            )

            self._configs[config.name] = config
            logger.info("Loaded agent config: %s", config.name)
            return config

        except Exception as e:
            logger.error("Failed to load agent config from %s: %s", config_path, e)
            return None

    def load_configs_from_directory(self, directory: Path) -> int:
        """Load all agent configs from a directory."""
        if not directory.exists():
            logger.warning("Agent config directory not found: %s", directory)
            return 0

        count = 0
        for path in directory.glob("*.yaml"):
            if self.load_config(path):
                count += 1

        for path in directory.glob("*.yml"):
            if self.load_config(path):
                count += 1

        logger.info("Loaded %d agent configs from %s", count, directory)
        return count

    def register_config(self, config: AgentConfig) -> None:
        """Register an agent configuration programmatically."""
        self._configs[config.name] = config
        # Clear cached agent if exists
        if config.name in self._agents:
            del self._agents[config.name]
        logger.info("Registered agent config: %s", config.name)

    def get_config(self, name: str) -> Optional[AgentConfig]:
        """Get agent configuration by name."""
        return self._configs.get(name)

    def list_agents(self) -> list[str]:
        """List all registered agent names."""
        return list(self._configs.keys())

    def _resolve_model(self, model_config: Optional[str]) -> str:
        """
        Resolve model string from config.

        Supports formats:
        - None or empty -> use default from settings
        - "openai:gpt-5-mini" -> use as is
        - "gpt-5-mini" -> add default provider
        - "${LLM_MODEL}" -> resolve from environment
        """
        import os

        if not model_config:
            return settings.get_llm_model()

        # Check for environment variable reference
        if model_config.startswith("${") and model_config.endswith("}"):
            env_var = model_config[2:-1]
            model_config = os.getenv(env_var, settings.llm_model)

        # If no provider prefix, add default provider
        if ":" not in model_config:
            return f"{settings.llm_provider}:{model_config}"

        return model_config

    def _create_agent(self, config: AgentConfig) -> Agent:
        """Create a PydanticAI agent from configuration."""
        model = self._resolve_model(config.model)
        logger.info("Creating agent '%s' with model: %s", config.name, model)

        agent: Agent[AgentDeps, str] = Agent(
            model=model,
            deps_type=AgentDeps,
            system_prompt=config.system_prompt,
        )

        # Register tools
        for tool_name in config.tools:
            if tool_name in self._tools:
                agent.tool(self._tools[tool_name])
            else:
                logger.warning(
                    "Tool '%s' not found for agent '%s'",
                    tool_name,
                    config.name,
                )

        return agent

    def get_agent(self, name: str) -> Optional[Agent]:
        """
        Get or create an agent by name.

        Agents are cached after first creation.
        """
        if name in self._agents:
            return self._agents[name]

        config = self._configs.get(name)
        if not config:
            logger.error("Agent '%s' not found", name)
            return None

        agent = self._create_agent(config)
        self._agents[name] = agent
        logger.info("Created agent: %s", name)
        return agent

    async def run_agent(
        self,
        agent_name: str,
        message: str,
        deps: AgentDeps,
        context: Optional[dict] = None,
    ) -> Optional[AgentResponse]:
        """
        Run an agent with a message.

        Args:
            agent_name: Name of the agent to run
            message: User message
            deps: Agent dependencies
            context: Optional additional context

        Returns:
            AgentResponse or None if agent not found
        """
        agent = self.get_agent(agent_name)
        if not agent:
            return None

        try:
            result = await agent.run(message, deps=deps)

            # Extract response
            response_text = result.output if hasattr(result, "output") else str(result)

            return AgentResponse(
                content=response_text,
                agent_name=agent_name,
                metadata={
                    "context": context,
                },
            )

        except Exception as e:
            logger.exception("Error running agent '%s': %s", agent_name, e)
            return AgentResponse(
                content=f"Error: {str(e)}",
                agent_name=agent_name,
                metadata={"error": str(e)},
            )

    def clear_cache(self) -> None:
        """Clear cached agents (useful for config reload)."""
        self._agents.clear()
        logger.info("Cleared agent cache")


# Singleton instance
agent_service = AgentService()


def init_agent_service(
    config_dir: Optional[Path] = None,
    tools: Optional[dict[str, Callable]] = None,
) -> AgentService:
    """
    Initialize the agent service.

    Args:
        config_dir: Directory with agent YAML configs
        tools: Dictionary of tools to register

    Returns:
        Initialized AgentService
    """
    if tools:
        agent_service.register_tools(tools)

    if config_dir:
        agent_service.load_configs_from_directory(config_dir)

    return agent_service
