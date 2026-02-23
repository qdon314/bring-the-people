"""Creative Agent API endpoint."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.services.creative_service import ConstraintViolationError, CreativeRunError

router = APIRouter()


@router.post("/{frame_id}/run")
def run_creative(frame_id: UUID, request: Request):
    container = request.app.state.container
    service = container.creative_service()

    try:
        result = service.run(frame_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConstraintViolationError as e:
        raise HTTPException(status_code=422, detail={
            "error": str(e),
            "run_id": str(e.run_id),
            "violations": e.violations,
        })
    except CreativeRunError as e:
        raise HTTPException(status_code=502, detail={
            "error": str(e),
            "run_id": str(e.run_id),
        })

    return {
        "run_id": str(result.run_id),
        "variant_ids": [str(vid) for vid in result.variant_ids],
        "reasoning_summary": result.creative_output.reasoning_summary,
        "turns_used": result.turns_used,
        "total_input_tokens": result.total_input_tokens,
        "total_output_tokens": result.total_output_tokens,
    }
