"""Parse the Unified Time Table (`Unified_Time_Table_2025_batch_<n>`).

This is the university-wide **slot grid**: for each Day Order (1..5) and each
hour of the day, which slot sits there and at what time. Combined with a
student's slot->course map, it yields their real day-order schedule.

Captured grid shape (batch 2):
    Hour:  1     2     3     4     5     6     7     8     9    10   11   12
    Time: 08:00 08:50 09:45 10:40 11:35 12:30 01:25 02:20 03:10 04:00 04:50 ...
    Day1:  P1   P2/X  P3/X   P4   P5    A     A     F     F    G    L11  L12
    Day2:  B    B/X   G/X    G    A     P16   ...
    ...
Cells may carry a `/X` secondary marker — we keep the primary slot before `/`.
Slots: A-G = theory, P## = practical periods, L## = end-of-day lab slots.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .creator import extract_page_html

_TIME_RANGE = re.compile(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})")
_DAY_ROW = re.compile(r"day\s*(\d+)", re.IGNORECASE)


class UnifiedTimetableError(Exception):
    """The grid couldn't be located/parsed in the page."""


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def _primary_slot(cell: str) -> str:
    """'B / X' -> 'B', 'P2/X' -> 'P2', 'G' -> 'G', '-' -> ''."""
    token = _clean(cell).split("/")[0].strip()
    return "" if token in {"-", ""} else token


def parse_unified_timetable(raw: str) -> dict[int, list[dict]]:
    """Return { day_order: [ {hour, start, end, slot}, ... ] }.

    Only cells with a real slot are included (blank/`-` hours dropped).
    """
    html = extract_page_html(raw)
    soup = BeautifulSoup(html, "html.parser")

    times: list[tuple[str, str]] = []
    day_rows: dict[int, list[str]] = {}

    for tr in soup.find_all("tr"):
        cells = [_clean(td.get_text()) for td in tr.find_all(["td", "th"])]
        if not cells:
            continue
        joined = " ".join(cells)
        # The time header row: a run of "HH:MM - HH:MM" ranges.
        if not times and joined.count(":") >= 4 and _TIME_RANGE.search(joined):
            times = _TIME_RANGE.findall(joined)
        m = _DAY_ROW.match(cells[0])
        if m:
            day_rows[int(m.group(1))] = cells[1:]

    if not times or not day_rows:
        raise UnifiedTimetableError("Could not find the time header / day rows.")

    grid: dict[int, list[dict]] = {}
    for day, slots in sorted(day_rows.items()):
        periods = []
        for hour, cell in enumerate(slots):
            slot = _primary_slot(cell)
            if not slot or hour >= len(times):
                continue
            start, end = times[hour]
            periods.append(
                {
                    "hour": hour + 1,
                    "start": _norm_time(start),
                    "end": _norm_time(end),
                    "slot": slot,
                }
            )
        grid[day] = periods
    return grid


def _norm_time(t: str) -> str:
    """Zero-pad to HH:MM (the grid prints '8:00' and '01:20' inconsistently)."""
    h, m = t.split(":")
    return f"{int(h):02d}:{m}"
