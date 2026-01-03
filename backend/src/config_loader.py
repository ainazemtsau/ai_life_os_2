"""
Configuration loader for agents and workflows.

Loads YAML configuration files at startup.
"""
import logging
from pathlib import Path

import yaml

from src.services.agent import agent_service, AgentConfig
from src.services.workflow import WorkflowService

logger = logging.getLogger(__name__)

# Default paths relative to backend directory
AGENTS_DIR = Path(__file__).parent.parent / "agents"
WORKFLOWS_DIR = Path(__file__).parent.parent / "workflows"


def load_agent_configs(directory: Path = AGENTS_DIR) -> int:
    """Load all agent configurations from directory."""
    if not directory.exists():
        logger.warning("Agents directory not found: %s", directory)
        return 0

    count = 0
    for path in directory.glob("*.yaml"):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            config = AgentConfig(
                name=data["name"],
                description=data.get("description", ""),
                system_prompt=data.get("system_prompt", ""),
                model=data.get("model"),
                tools=data.get("tools", []),
                response_format=data.get("response_format"),
            )
            agent_service.register_config(config)
            count += 1
            logger.debug("Loaded agent config: %s", config.name)

        except Exception as e:
            logger.error("Failed to load agent config %s: %s", path.name, e)

    for path in directory.glob("*.yml"):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            config = AgentConfig(
                name=data["name"],
                description=data.get("description", ""),
                system_prompt=data.get("system_prompt", ""),
                model=data.get("model"),
                tools=data.get("tools", []),
                response_format=data.get("response_format"),
            )
            agent_service.register_config(config)
            count += 1
            logger.debug("Loaded agent config: %s", config.name)

        except Exception as e:
            logger.error("Failed to load agent config %s: %s", path.name, e)

    logger.info("Loaded %d agent configurations", count)
    return count


def load_workflow_configs(directory: Path = WORKFLOWS_DIR) -> int:
    """Load all workflow configurations from directory."""
    if not directory.exists():
        logger.warning("Workflows directory not found: %s", directory)
        return 0

    count = 0
    for path in list(directory.glob("*.yaml")) + list(directory.glob("*.yml")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            WorkflowService.register_workflow(data["name"], data)
            count += 1
            logger.debug("Loaded workflow config: %s", data["name"])

        except Exception as e:
            logger.error("Failed to load workflow config %s: %s", path.name, e)

    logger.info("Loaded %d workflow configurations", count)
    return count


def load_all_configs() -> tuple[int, int]:
    """
    Load all configurations.

    Returns:
        Tuple of (agents_count, workflows_count)
    """
    agents = load_agent_configs()
    workflows = load_workflow_configs()
    return agents, workflows
