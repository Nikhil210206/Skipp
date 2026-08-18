"""Parse the student portal's attendance report into the same shape academia gives.

Source: `POST /students/report/studentAttendanceDetails.jsp`, captured from a
real signed-in session (2026-08-17). The page carries two tables; the first is
the one that matters:

    Code | Description | Max. hours | Att. hours | Absent hours | Total Percentage

THE ONE REAL DIFFERENCE FROM ACADEMIA, AND IT IS NOT COSMETIC
-------------------------------------------------------------
Academia splits a course into separate **Theory** and **Practical** rows sharing
one course code, which is why the whole app keys attendance by `code + lab-ness`
(`::th` / `::lab`, see CLAUDE.md §6). The student portal does not: it publishes
**one merged row per code**, hours combined, and carries no category column at
all. Verified against a real account: 7 rows, 7 distinct codes, zero duplicates,
and the strings "Theory" and "Practical" appear nowhere on the page.

So `category` is left EMPTY here rather than guessed at. Empty is honest and the
frontend can branch on it; inventing "Theory" would put a label on a number that
covers both, and the leave planner would then quietly project lab absences onto
a row claiming to be theory.

The arithmetic is unaffected: a merged row counts every hour of the course, so a
missed period of either kind is one more conducted hour against that same row.
What is lost is only the ability to SAY which half is short.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup, Tag

from models.attendance import Attendance, Subject

from .predictor import predict

#: Subject field -> substring identifying its column header. Matched by text so
#: a reordered or renamed column does not silently shift every value one across.
_COLUMNS = {
    "code": "code",
    "title": "description",
    "conducted": "max",
    "attended": "att",
    "absent": "absent",
    "percentage": "percentage",
}

#: The report states the window it covers, e.g.
#: "- During the Period: 21/Jul/2026 To 14/Aug/2026". Worth surfacing: the
#: portal lags real time by a few days, so a student who just sat a class and
#: sees no change is looking at a report that has not reached today yet.
_PERIOD_RE = re.compile(
    r"During\s+the\s+Period\s*:\s*(.+?To\s*\d{1,2}/\w{3}/\d{4})", re.I
)


class AttendanceUnavailable(Exception):
    """The page loaded but held no recognizable attendance table."""


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def _to_int(text: str) -> int:
    m = re.search(r"-?\d+", text or "")
    return int(m.group()) if m else 0


def _to_float(text: str) -> float | None:
    m = re.search(r"-?\d+(?:\.\d+)?", text or "")
    return float(m.group()) if m else None


def parse_attendance(html: str, threshold: float = 75.0) -> Attendance:
    """Attendance rows -> the same `Attendance` model the academia parser returns."""
    soup = BeautifulSoup(html, "html.parser")
    table = _find_attendance_table(soup)
    if table is None:
        raise AttendanceUnavailable(
            "No attendance table on the student portal page."
        )

    headers = [_clean(c.get_text()).lower() for c in table.find_all("th")]
    if not headers:
        first = table.find("tr")
        headers = (
            [_clean(c.get_text()).lower() for c in first.find_all(["th", "td"])]
            if first
            else []
        )

    index: dict[str, int] = {}
    for field, needle in _COLUMNS.items():
        for i, head in enumerate(headers):
            if needle in head:
                # "att. hours" also contains "att", and so does nothing else,
                # but "absent hours" must not be claimed by the "att" probe.
                if field == "attended" and "absent" in head:
                    continue
                index.setdefault(field, i)
                break

    if "code" not in index or "conducted" not in index:
        raise AttendanceUnavailable(
            "Attendance table is missing the columns we parse."
        )

    subjects: list[Subject] = []
    for cells in _data_rows(table, len(headers)):

        def cell(field: str) -> str:
            i = index.get(field)
            return cells[i] if i is not None and i < len(cells) else ""

        code = cell("code")
        if not code or "no record" in code.lower():
            continue

        conducted = _to_int(cell("conducted"))
        attended_cell = cell("attended")
        # Prefer the stated attended hours; fall back to conducted - absent so a
        # portal that drops the column still parses rather than reading as zero.
        attended = (
            _to_int(attended_cell)
            if attended_cell
            else conducted - _to_int(cell("absent"))
        )
        attended = max(0, min(attended, conducted))

        p = predict(attended, conducted, threshold)
        stated = _to_float(cell("percentage"))
        subjects.append(
            Subject(
                code=code,
                # Raw, exactly as academia's parser passes it through. The
                # portal SHOUTS course names where academia does not, so the
                # route enriches these from the timetable's own course list by
                # code; title-casing here instead would read "Advanced Sql".
                title=cell("title"),
                # Deliberately empty: the portal merges Theory and Practical.
                category="",
                conducted=conducted,
                attended=attended,
                percentage=stated if stated is not None else p.percentage,
                can_skip=p.can_skip,
                must_attend=p.must_attend,
                is_safe=p.is_safe,
            )
        )

    if not subjects:
        raise AttendanceUnavailable("Attendance table held no course rows.")

    total_conducted = sum(s.conducted for s in subjects)
    total_attended = sum(s.attended for s in subjects)
    overall = (
        round(total_attended / total_conducted * 100, 2) if total_conducted else 0.0
    )

    return Attendance(
        subjects=subjects,
        overall_percentage=overall,
        threshold=threshold,
        last_updated=datetime.now(timezone.utc).isoformat(),
    )


def reported_period(html: str) -> str | None:
    """The window the report covers, if it states one."""
    m = _PERIOD_RE.search(_clean(BeautifulSoup(html, "html.parser").get_text()))
    return _clean(m.group(1)) if m else None


def _find_attendance_table(soup: BeautifulSoup) -> Tag | None:
    """The first table whose header names both a code and an hours column.

    The page carries a cumulative month table too, so taking `table[0]` by
    position would work today and break the day they reorder the cards.
    """
    for table in soup.find_all("table"):
        head = " ".join(
            _clean(c.get_text()).lower()
            for c in (table.find("tr").find_all(["th", "td"]) if table.find("tr") else [])
        )
        if "code" in head and "hours" in head:
            return table
    return None


def _data_rows(table: Tag, ncols: int) -> list[list[str]]:
    rows: list[list[str]] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:  # header row
            continue
        rows.append([_clean(c.get_text()) for c in cells])
    return rows
