"""Memo Agent API endpoint."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request

from growth.app.services.memo_service import MemoRunError

router = APIRouter()


@router.post("/{show_id}/run")
def run_memo(
    show_id: UUID,
    request: Request,
    cycle_start: datetime = Query(..., description="ISO timestamp for cycle start"),
    cycle_end: datetime = Query(..., description="ISO timestamp for cycle end"),
):
    if cycle_start >= cycle_end:
        raise HTTPException(status_code=422, detail="cycle_start must be before cycle_end")

    container = request.app.state.container
    service = container.memo_service()

    try:
        result = service.run(show_id, cycle_start, cycle_end)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except MemoRunError as e:
        raise HTTPException(status_code=502, detail={
            "error": str(e),
            "run_id": str(e.run_id),
        })

    return {
        "run_id": str(result.run_id),
        "memo_id": str(result.memo_id),
        "what_worked": result.memo_output.what_worked,
        "what_failed": result.memo_output.what_failed,
        "cost_per_seat_cents": result.memo_output.cost_per_seat_cents,
        "cost_per_seat_explanation": result.memo_output.cost_per_seat_explanation,
        "next_three_tests": result.memo_output.next_three_tests,
        "policy_exceptions": result.memo_output.policy_exceptions,
        "reasoning_summary": result.memo_output.reasoning_summary,
        "turns_used": result.turns_used,
        "total_input_tokens": result.total_input_tokens,
        "total_output_tokens": result.total_output_tokens,
    }
