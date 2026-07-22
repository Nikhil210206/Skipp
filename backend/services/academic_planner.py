"""Parse the Academic Planner (`Academic_Planner_<AY>_<ODD|EVEN>`).

The planner is one big HTML table: rows are day-of-month (1..31) and columns are
6 month-blocks laid side by side, each block 5 columns:
    [ Date, Weekday, Event, Day Order, - ]
Day Order is a number 1..5 on a working day, or "-" on weekends/holidays/breaks.
Event holds holiday names ("Gandhi Jayanthi - Holiday") and academic milestones.

Output: an ordered list of calendar days for the semester, each with its date,
weekday, day order (or None), event text, and a holiday flag.
"""
from __future__ import annotations

import re
from calendar import monthrange
from datetime import date

from bs4 import BeautifulSoup

_COLS_PER_MONTH = 5
_MONTHS_PER_ROW = 6


class AcademicPlannerError(Exception):
    """The planner grid couldn't be parsed."""


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def parse_planner(
    raw: str, first_year: int, first_month: int
) -> list[dict]:
    """Return [{date, weekday, dayOrder|None, event|None, isHoliday}, ...].

    `raw` is the *unescaped* planner HTML. `first_year`/`first_month` anchor the
    leftmost month block (e.g. 2026, 7 for the 2026-27 ODD semester).
    """
    soup = BeautifulSoup(raw, "html.parser")
    table = _find_calendar_table(soup)
    if table is None:
        raise AcademicPlannerError("Calendar table not found.")

    # Month/year for each of the 6 blocks (left -> right), rolling over Dec->Jan.
    months = []
    y, m = first_year, first_month
    for _ in range(_MONTHS_PER_ROW):
        months.append((y, m))
        m += 1
        if m > 12:
            m, y = 1, y + 1

    days: dict[str, dict] = {}
    for tr in table.find_all("tr"):
        cells = [_clean(td.get_text()) for td in tr.find_all(["td", "th"])]
        for block, (yr, mo) in enumerate(months):
            base = block * _COLS_PER_MONTH
            group = cells[base : base + _COLS_PER_MONTH]
            if len(group) < 4:
                continue
            date_s, weekday, event, dayorder = group[0], group[1], group[2], group[3]
            if not date_s.isdigit():
                continue
            dnum = int(date_s)
            if not (1 <= dnum <= monthrange(yr, mo)[1]):
                continue
            iso = date(yr, mo, dnum).isoformat()
            do = int(dayorder) if dayorder.isdigit() else None
            ev = event if event and event != "-" else None
            days[iso] = {
                "date": iso,
                "weekday": weekday,
                "dayOrder": do,
                "event": ev,
                "isHoliday": bool(ev) and "holiday" in ev.lower(),
            }

    return [days[k] for k in sorted(days)]


def _find_calendar_table(soup: BeautifulSoup):
    """The calendar table has weekday abbreviations and many rows."""
    best = None
    best_rows = 0
    for t in soup.find_all("table"):
        text = t.get_text(" ", strip=True)
        if re.search(r"\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b", text):
            n = len(t.find_all("tr"))
            if n > best_rows:
                best, best_rows = t, n
    return best


def semester_anchor(page_name: str) -> tuple[int, int]:
    """Derive (first_year, first_month) from a planner page name.

    'Academic_Planner_2026_27_ODD' -> (2026, 7)   # ODD = Jul-Dec of first year
    'Academic_Planner_2026_27_EVEN' -> (2027, 1)   # EVEN = Jan-Jun of second year
    Falls back to (current year, 7/1) if the name doesn't match.
    """
    m = re.search(r"(\d{4})_(\d{2})_(ODD|EVEN)", page_name, re.IGNORECASE)
    if not m:
        today = date.today()
        return today.year, 7 if today.month >= 6 else 1
    y1 = int(m.group(1))
    if m.group(3).upper() == "ODD":
        return y1, 7
    return y1 + 1, 1
