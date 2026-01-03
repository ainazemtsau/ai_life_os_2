import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.health import router as health_router
from src.api.websocket import router as websocket_router
from src.api.test import router as test_router
from src.api.user import router as user_router
from src.api.workflow import router as workflow_router
from src.api.inbox import router as inbox_router
from src.api.conversations import router as conversations_router
from src.config import settings
from src.services.pocketbase import pocketbase, PocketbaseError
from src.services.memory import check_memory_service
from src.services.db_init import init_database
from src.config_loader import load_all_configs

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("Backend starting...")

    # Check Pocketbase connection
    try:
        health = await pocketbase.health_check()
        logger.info("Pocketbase connected: %s", health.get("message", "OK"))

        # Initialize database collections
        created, existing = await init_database()
        logger.info("Database: %d collections created, %d already existed", created, existing)
    except PocketbaseError as e:
        logger.error("Pocketbase connection failed: %s", e.message)

    # Load agent and workflow configurations
    agents_count, workflows_count = load_all_configs()
    logger.info("Loaded %d agents and %d workflows", agents_count, workflows_count)

    # Check Mem0/Memory service
    mem0_ok, mem0_msg = await check_memory_service()
    if mem0_ok:
        logger.info("Mem0: %s", mem0_msg)
    else:
        logger.warning("Mem0: %s (memory features will be disabled)", mem0_msg)

    logger.info("Backend started")

    yield

    # Shutdown
    logger.info("Backend shutting down...")


app = FastAPI(title="AI Life OS Backend", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(websocket_router)
app.include_router(test_router)
app.include_router(user_router)
app.include_router(workflow_router)
app.include_router(inbox_router)
app.include_router(conversations_router)
