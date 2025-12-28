"""
PydanticAI Agent definition for AI Life OS.

This module creates and configures the AI agent that handles
user interactions and manages data in Pocketbase.
"""
import logging

from pydantic_ai import Agent

from src.config import settings
from src.ai.context import AgentDeps
from src.ai.prompts import build_system_prompt
from src.ai import tools

logger = logging.getLogger(__name__)


def create_agent() -> Agent[AgentDeps, str]:
    """
    Create and configure the PydanticAI agent.

    Returns:
        Configured Agent instance
    """
    model = settings.get_llm_model()
    logger.info("Creating AI agent with model: %s", model)

    agent: Agent[AgentDeps, str] = Agent(
        model=model,
        deps_type=AgentDeps,
    )

    # Add dynamic system prompt
    @agent.system_prompt
    async def dynamic_system_prompt(ctx) -> str:
        """
        Build dynamic system prompt based on current context.

        This is called by PydanticAI before each request to build
        the system prompt with current collections and memories.
        """
        deps: AgentDeps = ctx.deps

        collections_summary = deps.get_collections_summary()
        memories_summary = deps.get_memories_summary()

        return build_system_prompt(collections_summary, memories_summary)

    # Register all tools
    agent.tool(tools.list_collections)
    agent.tool(tools.create_collection)
    agent.tool(tools.list_records)
    agent.tool(tools.create_record)
    agent.tool(tools.update_record)
    agent.tool(tools.delete_record)

    logger.info("AI agent created with %d tools", 6)
    return agent


# Singleton agent instance
coordinator_agent = create_agent()
