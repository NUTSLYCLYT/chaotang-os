from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.contracts.contract_review_pack import ContractReviewPackV1


class ContractLineageIdentityV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tenant_id: int = Field(gt=0)
    task_id: str = Field(min_length=1)
    mission_contract_id: str = Field(min_length=1)

    @model_validator(mode="after")
    def require_r0_mission_binding(self) -> "ContractLineageIdentityV1":
        if self.mission_contract_id != self.task_id:
            raise ValueError(
                "mission_contract_id must equal task_id for R0 compatibility"
            )
        return self

    @classmethod
    def for_task(cls, *, tenant_id: int, task_id: str) -> "ContractLineageIdentityV1":
        return cls(
            tenant_id=tenant_id,
            task_id=task_id,
            mission_contract_id=task_id,
        )


def require_r0_review_pack_binding(
    identity: ContractLineageIdentityV1,
    pack: ContractReviewPackV1,
) -> None:
    if (
        pack.tenant_id != str(identity.tenant_id)
        or pack.task_id != identity.task_id
        or pack.mission_contract_id != identity.mission_contract_id
    ):
        raise ValueError("review pack lineage does not match canonical task identity")
