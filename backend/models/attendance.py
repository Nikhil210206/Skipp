"""Response schemas for the attendance page.

Mirrors the `Subject` / `Attendance` shapes in CLAUDE.md §5, plus per-subject
bunk-predictor fields (see services/predictor.py). Field names are camelCase via
aliases so the JSON matches the frontend `types/` directly.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Subject(_CamelModel):
    code: str = Field(description='course code, e.g. "21CSC302J"')
    title: str = ""
    category: str = ""
    faculty: str | None = None
    slot: str | None = None
    conducted: int = Field(0, description="total classes held")
    attended: int = Field(0, description="classes attended")
    percentage: float = Field(0.0, description="attended / conducted * 100")
    # Bunk predictor, relative to the target threshold (default 75%):
    can_skip: int = Field(
        0, description="classes you can still miss and stay >= target"
    )
    must_attend: int = Field(
        0, description="consecutive classes needed to reach target (0 if safe)"
    )
    is_safe: bool = Field(True, description="at/above the target threshold")


class Attendance(_CamelModel):
    subjects: list[Subject]
    overall_percentage: float = 0.0
    threshold: float = Field(75.0, description="target % used for the predictor")
    last_updated: str = Field(description="ISO timestamp of this fetch")
