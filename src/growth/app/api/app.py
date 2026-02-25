"""FastAPI application factory."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from growth.app.container import Container


@asynccontextmanager
async def lifespan(app: FastAPI):
    from growth.app.worker import worker_loop
    task = asyncio.create_task(worker_loop(app.state.container))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def create_app(container: Optional[Container] = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Bring The People — Growth API",
        version="0.3.0",
        description="API for managing growth experiments and decisions for live shows.",
        lifespan=lifespan,
    )

    # Configure CORS for frontend communication
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "0.3.0"}

    # Store container in app state for dependency injection
    if container is None:
        container = Container()
    app.state.container = container

    # Register routers
    from growth.app.api.shows import router as shows_router
    app.include_router(shows_router, prefix="/api/shows", tags=["shows"])

    from growth.app.api.experiments import router as experiments_router
    app.include_router(experiments_router, prefix="/api/experiments", tags=["experiments"])

    from growth.app.api.observations import router as observations_router
    app.include_router(observations_router, prefix="/api/observations", tags=["observations"])

    from growth.app.api.decisions import router as decisions_router
    app.include_router(decisions_router, prefix="/api/decisions", tags=["decisions"])

    from growth.app.api.strategy import router as strategy_router
    app.include_router(strategy_router, prefix="/api/strategy", tags=["strategy"])

    from growth.app.api.creative import router as creative_router
    app.include_router(creative_router, prefix="/api/creative", tags=["creative"])

    from growth.app.api.memo import router as memo_router
    app.include_router(memo_router, prefix="/api/memos", tags=["memos"])

    from growth.app.api.cycles import router as cycles_router
    app.include_router(cycles_router, prefix="/api/shows", tags=["cycles"])
    app.include_router(cycles_router, prefix="/api", tags=["cycles"])

    from growth.app.api.segments import router as segments_router
    app.include_router(segments_router, prefix="/api/segments", tags=["segments"])

    from growth.app.api.frames import router as frames_router
    app.include_router(frames_router, prefix="/api/frames", tags=["frames"])

    from growth.app.api.variants import router as variants_router
    app.include_router(variants_router, prefix="/api/variants", tags=["variants"])

    from growth.app.api.jobs import router as jobs_router
    app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])

    from growth.app.api.events import router as events_router
    app.include_router(events_router, prefix="/api/events", tags=["events"])

    return app
