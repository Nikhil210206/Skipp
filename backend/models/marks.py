"""Response schemas for the marks page (CLAUDE.md §5).

camelCase JSON via aliases so the frontend `types/` mirrors it directly.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class MarkComponent(_CamelModel):
    name: str = Field(description='e.g. "FT-I", "CLA-1"')
    scored: float
    max: float


class SubjectMarks(_CamelModel):
    code: str
    title: str = ""
    components: list[MarkComponent] = Field(default_factory=list)
    scored_total: float = 0.0
    max_total: float = 0.0


class Marks(_CamelModel):
    subjects: list[SubjectMarks]
    last_updated: str = Field(description="ISO timestamp of this fetch")
