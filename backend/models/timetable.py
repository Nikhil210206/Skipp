"""Response schemas for the timetable page.

The "My Time Table & Attendance" page (`My_Time_Table_2023_24`) gives the
student's registered courses + info header. We enrich the response with the
day-order schedules (from the Unified Time Table) and the semester calendar
(from the Academic Planner) so one login powers home + timetable + calendar.

JSON is camelCase (aliases) so the frontend `types/` mirror it directly.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from models.schedule import CalendarDay, DayOrderSchedule


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class StudentInfo(_CamelModel):
    """The identity header shown above the course table."""

    registration_number: str | None = Field(None, description="e.g. RA24...574")
    name: str | None = None
    program: str | None = Field(None, description="e.g. B.Tech")
    department: str | None = Field(None, description="dept without the section suffix")
    section: str | None = Field(None, description="e.g. E2")
    semester: str | None = None
    batch: str | None = None
    mobile: str | None = None


class Course(_CamelModel):
    """One registered course row from the course table."""

    code: str = Field(description='course code, e.g. "21CSC302J"')
    title: str
    credit: int | None = None
    regn_type: str | None = Field(None, description='e.g. "Regular"')
    category: str | None = Field(None, description='e.g. "Professional Core"')
    course_type: str | None = Field(None, description='e.g. "Lab Based Theory"')
    faculty: str | None = None
    slot: str | None = Field(None, description='e.g. "A" or "P37-P38-"')
    room: str | None = None
    academic_year: str | None = Field(None, description='e.g. "AY2026-27-ODD"')


class Timetable(_CamelModel):
    """Parsed timetable + day-order schedules + semester calendar."""

    student: StudentInfo
    courses: list[Course]
    academic_year: str | None = Field(
        None, description="AY of the course list, e.g. AY2026-27-ODD"
    )
    # Enrichment (empty if the unified TT / planner couldn't be fetched):
    day_orders: list[DayOrderSchedule] = Field(default_factory=list)
    calendar: list[CalendarDay] = Field(default_factory=list)
