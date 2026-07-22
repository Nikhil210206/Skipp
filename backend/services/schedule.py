"""Fuse the unified slot grid + a student's courses into day-order schedules.

For each Day Order, walk the grid's periods; whenever a period's slot maps to one
of the student's course slots, that's a real class at that time. Course slots are
either a theory letter ("A".."G") or a lab range ("P37-P38-", "L51-L52-") that
expands to the individual practical/lab slots on the grid.
"""
from __future__ import annotations

import re

from models.schedule import ClassPeriod, DayOrderSchedule
from models.timetable import Course

# Curated abbreviations where title initials don't give the familiar name.
_ABBREV_OVERRIDES = {
    "21CSE742P": "DBMS",  # "Advanced SQL and Modern Database Features"
}
_ABBREV_STOPWORDS = {"and", "of", "the", "for", "to", "in", "a", "an", "&"}


def build_day_orders(
    courses: list[Course], grid: dict[int, list[dict]]
) -> list[DayOrderSchedule]:
    """Return a DayOrderSchedule per day order present in the grid."""
    slot_map = _slot_to_course(courses)

    schedules: list[DayOrderSchedule] = []
    for day_order in sorted(grid):
        classes: list[ClassPeriod] = []
        for p in grid[day_order]:
            course = slot_map.get(p["slot"])
            if course is None:
                continue
            classes.append(
                ClassPeriod(
                    hour=p["hour"],
                    start=p["start"],
                    end=p["end"],
                    start_min=_to_minutes(p["start"]),
                    end_min=_to_minutes(p["end"]),
                    slot=p["slot"],
                    code=course.code,
                    title=course.title,
                    abbrev=abbreviate(course.title, course.code),
                    faculty=course.faculty,
                    room=course.room,
                    is_lab=p["slot"].startswith(("P", "L")),
                )
            )
        classes.sort(key=lambda c: c.start_min)
        schedules.append(DayOrderSchedule(day_order=day_order, classes=classes))
    return schedules


def _slot_to_course(courses: list[Course]) -> dict[str, Course]:
    """Map every slot token a student holds to its course.

    Theory: the slot letter itself. Lab: each token in a range like
    "P37-P38-" / "L51-L52-" maps to the same (lab) course row.
    """
    mapping: dict[str, Course] = {}
    for c in courses:
        for token in _expand_slot(c.slot):
            mapping[token] = c
    return mapping


def _expand_slot(slot: str | None) -> list[str]:
    if not slot:
        return []
    tokens = [t for t in re.split(r"[-\s]+", slot.strip()) if t]
    return tokens


def abbreviate(title: str, code: str) -> str:
    """A short course tag: override, else initials of significant words."""
    if code in _ABBREV_OVERRIDES:
        return _ABBREV_OVERRIDES[code]
    words = [w for w in re.split(r"[^A-Za-z0-9]+", title) if w]
    initials = [w[0].upper() for w in words if w.lower() not in _ABBREV_STOPWORDS]
    return "".join(initials)[:4] or (title[:2].upper() if title else "?")


def _to_minutes(t: str) -> int:
    """'08:00' -> 480, '01:20' -> 800 (afternoon). Classes run 08:00-18:00, so
    an hour of 1..6 is always PM."""
    h, m = (int(x) for x in t.split(":"))
    if h < 7:
        h += 12
    return h * 60 + m
