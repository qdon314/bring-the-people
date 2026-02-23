"""Strategy API routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.services.strategy_service import StrategyRunError

router = APIRouter()


@router.post("/{show_id}/run")
def run_strategy(show_id: UUID, request: Request):
    """Run the Strategy Agent for a show."""
    container = request.app.state.container
    service = container.strategy_service()

    try:
        result = service.run(show_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except StrategyRunError as e:
        raise HTTPException(
            status_code=502,
            detail={"error": str(e), "run_id": str(e.run_id)},
        )

    return {
        "run_id": str(result.run_id),
        "segment_ids": [str(sid) for sid in result.segment_ids],
        "frame_ids": [str(fid) for fid in result.frame_ids],
        "reasoning_summary": result.strategy_output.reasoning_summary,
        "turns_used": result.turns_used,
        "total_input_tokens": result.total_input_tokens,
        "total_output_tokens": result.total_output_tokens,
    }
