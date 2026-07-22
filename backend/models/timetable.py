"""Response schemas for the timetable / course-registration page.

The academia "My Time Table & Attendance" page (`My_Time_Table_2023_24`) is, in
practice, the student's registered-course list plus an info header — not a
day/time grid. We model exactly what the page provides; a true weekly grid needs
the slot -> time mapping, which is a later enhancement.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class StudentInfo(BaseModel):
    """The identity header shown above the course table."""

    registration_number: str | None = Field(None, description="e.g. RA24...574")
    name: str | None = None
    program: str | None = Field(None, description="e.g. B.Tech")
    department: str | None = Field(None, description="dept without the section suffix")
    section: str | None = Field(None, description="e.g. E2")
    semester: str | None = None
    batch: str | None = None
    mobile: str | None = None


class Course(BaseModel):
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


class Timetable(BaseModel):
    """Parsed result of the timetable / course-registration page."""

    student: StudentInfo
    courses: list[Course]
    academic_year: str | None = Field(
        None, description="AY of the course list, e.g. AY2026-27-ODD"
    )
