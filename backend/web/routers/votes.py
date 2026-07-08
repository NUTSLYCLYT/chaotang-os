"""协商/投票端点 —

  GET  /api/votes/proposals
  POST /api/votes/proposals
  POST /api/votes/proposals/{proposal_id}/vote
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.votes import ProposalCreateRequest, VoteRequest, VoteResult

router = APIRouter(prefix="/api/votes", tags=["votes"])


@router.get("/proposals")
def list_proposals(
    status: str | None = Query(default=None),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.agent_communication import NegotiationProtocol
        protocol = NegotiationProtocol()
        return {"proposals": protocol.list_proposals(status)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/proposals")
def create_proposal(
    body: ProposalCreateRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.agent_communication import NegotiationProtocol
        protocol = NegotiationProtocol()
        return protocol.create_proposal(
            proposal_id=body.proposal_id,
            proposer=body.proposer,
            topic=body.topic,
            options=body.options,
            voting_strategy=body.strategy,
            quorum=body.quorum,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/proposals/{proposal_id}/vote",
    response_model=VoteResult,
)
def cast_vote(
    proposal_id: str,
    body: VoteRequest,
    _: CurrentUser = Depends(get_current_user),
) -> VoteResult:
    try:
        from src.agent_communication import NegotiationProtocol
        protocol = NegotiationProtocol()
        ok = protocol.cast_vote(
            proposal_id=proposal_id,
            voter=body.voter,
            option_id=body.option_id,
            reason=body.reason,
        )
        return VoteResult(accepted=bool(ok))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
