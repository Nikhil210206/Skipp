"""Day-order schedule + calendar schemas (camelCase JSON for the frontend)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ClassPeriod(_CamelModel):
    hour: int = Field(description="1-based period index within the day")
    start: str = Field(description='display time, e.g. "08:00" or "01:20"')
    end: str
    start_min: int = Field(description="minutes since midnight (24h), for ordering")
    end_min: int
    slot: str
    code: str
    title: str
    abbrev: str
    faculty: str | None = None
    room: str | None = None
    is_lab: bool = False


class DayOrderSchedule(_CamelModel):
    day_order: int
    classes: list[ClassPeriod]


class CalendarDay(_CamelModel):
    date: str = Field(description="ISO date, YYYY-MM-DD")
    weekday: str
    day_order: int | None = None
    event: str | None = None
    is_holiday: bool = False
