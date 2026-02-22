"""FastAPI application factory."""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI

from growth.app.container import Container


def create_app(container: Optional[Container] = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Bring The People — Growth API",
        version="0.2.0",
        description="API for managing growth experiments and decisions for live shows.",
    )

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "0.2.0"}

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

    return app
