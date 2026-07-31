"""Validated immutable routing snapshots derived from approved draft edicts."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, model_validator

from app.agents.bureaus.profiles import bureau_profiles_for
from app.agents.chancellor_draft.models import DraftEdict
from app.agents.ministries.prompts import MINISTRIES


class ApprovedDepartmentRoute(BaseModel):
    """One approved ministry and its ordered required bureau identities."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    department: str
    required_bureaus: tuple[str, ...]

    @model_validator(mode="after")
    def _validate_roster(self) -> ApprovedDepartmentRoute:
        if self.department not in MINISTRIES:
            raise ValueError("department must be one of the six ministries")
        if not self.required_bureaus:
            raise ValueError("required_bureaus must not be empty")
        if len(set(self.required_bureaus)) != len(self.required_bureaus):
            raise ValueError("required_bureaus must not contain duplicates")
        allowed = {
            profile.bureau for profile in bureau_profiles_for(self.department)
        }
        if any(bureau not in allowed for bureau in self.required_bureaus):
            raise ValueError(
                "required_bureaus must contain only bureaus from the department"
            )
        return self


class ApprovedRouteSnapshot(BaseModel):
    """Ordered route authorized by an already validated draft."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    departments: tuple[ApprovedDepartmentRoute, ...]

    @model_validator(mode="after")
    def _validate_departments(self) -> ApprovedRouteSnapshot:
        if not self.departments:
            raise ValueError("departments must not be empty")
        names = [item.department for item in self.departments]
        if len(set(names)) != len(names):
            raise ValueError("departments must not contain duplicates")
        return self


def validate_route_snapshot(
    snapshot: ApprovedRouteSnapshot,
) -> ApprovedRouteSnapshot:
    """Revalidate a snapshot against the current ministry and bureau rosters."""

    return ApprovedRouteSnapshot.model_validate(
        snapshot.model_dump(mode="python")
    )


def build_route_snapshot(draft: DraftEdict) -> ApprovedRouteSnapshot:
    """Derive the immutable route from a validated draft edict."""

    if not isinstance(draft, DraftEdict):
        raise TypeError("draft must be a validated DraftEdict")
    return ApprovedRouteSnapshot(
        departments=tuple(
            ApprovedDepartmentRoute(
                department=item.department,
                required_bureaus=tuple(item.bureaus),
            )
            for item in draft.departments
        )
    )
