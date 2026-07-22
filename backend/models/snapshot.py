"""Combined snapshot: everything from ONE portal login.

The backend is stateless (one Zoho sign-in per request), and Zoho enforces a
daily sign-in cap. Fetching timetable + attendance + marks in a single session
keeps a whole browsing session down to one sign-in. Attendance/marks may be
admin-gated, so each carries its own status instead of failing the whole call.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from models.attendance import Attendance
from models.marks import Marks
from models.timetable import Timetable

SectionStatus = Literal["ready", "gated", "error"]


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Snapshot(_CamelModel):
    timetable: Timetable
    attendance: Attendance | None = None
    attendance_status: SectionStatus = "error"
    attendance_message: str | None = None
    marks: Marks | None = None
    marks_status: SectionStatus = "error"
    marks_message: str | None = None
    fetched_at: str = Field(description="ISO timestamp of this fetch")
