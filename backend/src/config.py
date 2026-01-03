from dataclasses import dataclass
from datetime import timedelta
from functools import lru_cache
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


@dataclass(frozen=True)
class StreamingConfig:
    """
    Immutable streaming configuration.

    Centralized settings for LLM streaming behavior.
    All timeouts and limits are explicitly named for clarity.
    """

    # Stream lifecycle timeouts
    stream_start_timeout: timedelta = timedelta(seconds=30)
    stream_completion_timeout: timedelta = timedelta(minutes=5)
    activity_schedule_timeout: timedelta = timedelta(seconds=10)

    # Connection lifecycle (React StrictMode handling)
    disconnect_delay: timedelta = timedelta(seconds=1)

    # Retry policy for transient failures
    max_retry_attempts: int = 3
    initial_retry_interval: timedelta = timedelta(seconds=1)
    retry_backoff_multiplier: float = 2.0

    # Buffer settings for chunk aggregation
    chunk_buffer_size: int = 10

    @property
    def disconnect_delay_ms(self) -> int:
        """Delay in milliseconds for frontend compatibility."""
        return int(self.disconnect_delay.total_seconds() * 1000)

    @property
    def stream_start_timeout_seconds(self) -> float:
        """Timeout in seconds for Temporal activities."""
        return self.stream_start_timeout.total_seconds()

    @property
    def stream_completion_timeout_seconds(self) -> float:
        """Timeout in seconds for stream completion."""
        return self.stream_completion_timeout.total_seconds()


# Singleton streaming config
streaming_config = StreamingConfig()


class Settings(BaseSettings):
    # Pocketbase
    pocketbase_url: str = "http://pocketbase:8090"
    pocketbase_admin_email: Optional[str] = None
    pocketbase_admin_password: Optional[str] = None

    # Redis (для Mem0)
    redis_url: str = "redis://redis:6379"

    # LLM Providers
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    ollama_host: Optional[str] = None
    ollama_model: Optional[str] = None

    # Mem0 settings
    mem0_llm_provider: str = "openai"
    mem0_llm_model: str = "gpt-5-mini"
    mem0_embedder_provider: str = "openai"
    mem0_embedder_model: str = "text-embedding-3-small"

    # Default AI Agent LLM settings (can be overridden per agent)
    llm_provider: str = "openai"  # openai, anthropic, ollama
    llm_model: str = "gpt-5-mini"  # default model for agents

    # Temporal
    temporal_host: str = "temporal:7233"

    # App settings
    log_level: str = "INFO"

    @field_validator("pocketbase_url")
    @classmethod
    def pocketbase_url_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("POCKETBASE_URL is required and cannot be empty")
        return v

    @field_validator("redis_url")
    @classmethod
    def redis_url_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("REDIS_URL is required and cannot be empty")
        return v

    def get_llm_model(self) -> str:
        """
        Get the LLM model string for pydantic-ai.

        Returns model in format: "provider:model" or just "model" for openai
        """
        if self.llm_provider == "openai":
            return f"openai:{self.llm_model}"
        elif self.llm_provider == "anthropic":
            return f"anthropic:{self.llm_model}"
        elif self.llm_provider == "ollama":
            host = self.ollama_host or "http://localhost:11434"
            model = self.ollama_model or self.llm_model
            return f"ollama:{model}"
        else:
            return self.llm_model

    def get_mem0_config(self) -> dict:
        """Build Mem0 configuration dict."""
        config = {
            "vector_store": {
                "provider": "redis",
                "config": {
                    "redis_url": self.redis_url,
                },
            },
            "llm": {
                "provider": self.mem0_llm_provider,
                "config": {
                    "model": self.mem0_llm_model,
                },
            },
            "embedder": {
                "provider": self.mem0_embedder_provider,
                "config": {
                    "model": self.mem0_embedder_model,
                },
            },
        }

        # Add API keys based on provider
        if self.mem0_llm_provider == "openai" and self.openai_api_key:
            config["llm"]["config"]["api_key"] = self.openai_api_key

        if self.mem0_embedder_provider == "openai" and self.openai_api_key:
            config["embedder"]["config"]["api_key"] = self.openai_api_key

        return config

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Singleton для удобного импорта
settings = get_settings()
