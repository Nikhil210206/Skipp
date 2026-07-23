"""Parse the academia attendance page (`My_Attendance`) into JSON.

⚠️ Built against the documented SRM academia attendance layout — the page is
admin-gated at semester start, so this parser is written defensively (matches
columns by header text, tolerates ordering/naming variation) and will need a
one-line sanity check against a real capture once the page goes live. The rest
of the pipeline (login, app-auth, fetch, pageSanitizer extraction) is proven.

Expected table columns (any order, matched by substring):
  Course Code | Course Title | Category | Faculty Name | Slot |
  Hours Conducted | Hours Absent | Attn %
`attended` is derived as conducted - absent; `percentage` is taken from the
Attn % column when present, else computed.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup, Tag

from models.attendance import Attendance, Subject

from .creator import extract_page_html
from .predictor import predict

# Course field -> substring identifying its column header.
_COLUMNS = {
    "code": "course code",
    "title": "course title",
    "category": "category",
    "faculty": "faculty",
    "slot": "slot",
    "conducted": "conducted",
    "absent": "absent",
    "attn": "attn",
}


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


# SRM course code, e.g. 21CSC302J / 21MAB302T. The attendance cell appends the
# registration type ("21CSC302JRegular"), so extract just the code.
_COURSE_CODE = re.compile(r"\d{2}[A-Z]{2,4}\d{3}[A-Z]?")


def _course_code(cell: str) -> str:
    m = _COURSE_CODE.search(cell or "")
    return m.group() if m else _clean(cell)


def parse_attendance(raw: str, threshold: float = 75.0) -> Attendance:
    """Parse the raw Creator-page response into an Attendance object."""
    html = extract_page_html(raw)
    soup = BeautifulSoup(html, "html.parser")

    table = _find_attendance_table(soup)
    if table is None:
        raise AttendanceUnavailable(
            "No attendance table found — page structure differs from expected "
            "(capture a live page to finalize the parser)."
        )

    headers = [_clean(td.get_text()).lower() for td in _header_cells(table)]
    ncols = len(headers)
    col_index: dict[str, int] = {}
    for field, needle in _COLUMNS.items():
        for idx, header in enumerate(headers):
            if needle in header:
                col_index[field] = idx
                break

    subjects: list[Subject] = []
    for row in _data_rows(table, ncols):
        def cell(field: str) -> str:
            idx = col_index.get(field)
            return row[idx] if idx is not None and idx < len(row) else ""

        code = _course_code(cell("code"))
        if not code:
            continue

        conducted = _to_int(cell("conducted"))
        absent = _to_int(cell("absent"))
        attended = max(0, conducted - absent)
        attn_pct = _to_float(cell("attn"))

        p = predict(attended, conducted, threshold)
        subjects.append(
            Subject(
                code=code,
                title=cell("title"),
                category=cell("category"),
                faculty=cell("faculty") or None,
                slot=cell("slot") or None,
                conducted=conducted,
                attended=attended,
                percentage=attn_pct if attn_pct is not None else p.percentage,
                can_skip=p.can_skip,
                must_attend=p.must_attend,
                is_safe=p.is_safe,
            )
        )

    total_conducted = sum(s.conducted for s in subjects)
    total_attended = sum(s.attended for s in subjects)
    overall = round(total_attended / total_conducted * 100, 2) if total_conducted else 0.0

    return Attendance(
        subjects=subjects,
        overall_percentage=overall,
        threshold=threshold,
        last_updated=datetime.now(timezone.utc).isoformat(),
    )


def _find_attendance_table(soup: BeautifulSoup) -> Tag | None:
    """The attendance table is the one whose headers mention conducted/attn."""
    for table in soup.find_all("table"):
        text = table.get_text().lower()
        if "conducted" in text and ("attn" in text or "absent" in text):
            return table
    return None


def _header_cells(table: Tag) -> list[Tag]:
    header_row = table.find("tr")
    return header_row.find_all(["td", "th"]) if isinstance(header_row, Tag) else []


def _data_rows(table: Tag, ncols: int) -> list[list[str]]:
    """Rows of cell-text. Handles both proper <tr> rows and the flat-<td>
    layout seen on these Creator pages (data cells not wrapped in <tr>)."""
    rows = table.find_all("tr")
    # Proper rows: more than just the header row present.
    if len(rows) > 1:
        out = []
        for tr in rows[1:]:
            cells = [_clean(td.get_text()) for td in tr.find_all(["td", "th"])]
            if cells:
                out.append(cells)
        return out
    # Flat layout: chunk all cells after the header by column count.
    all_cells = [_clean(td.get_text()) for td in table.find_all("td")]
    data = all_cells[ncols:]
    return [data[i : i + ncols] for i in range(0, len(data) - ncols + 1, ncols)]
