"""Parse the academia timetable / course-registration page into JSON.

Source page: `My_Time_Table_2023_24` (the "My Time Table & Attendance" menu).
Its HTML is embedded in a pageSanitizer.sanitize('…') block (see creator.py),
and the course table's data cells are NOT wrapped in <tr> elements — so we map
cells by header position instead of trusting row boundaries.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

from models.timetable import Course, StudentInfo, Timetable

from .creator import extract_page_html

# Section suffix embedded in the department cell, e.g. "…(CS)-(E2 Section)".
_SECTION_RE = re.compile(r"\(\s*([A-Za-z0-9]+)\s+Section\s*\)", re.IGNORECASE)

# Maps a StudentInfo field to the label(s) it appears under in the info table.
_INFO_LABELS = {
    "registration_number": ("registration number",),
    "name": ("name",),
    "program": ("program",),
    "department": ("department",),
    "semester": ("semester",),
    "batch": ("batch",),
    "mobile": ("mobile",),
}

# Maps a Course field to a substring that identifies its column header.
_COURSE_COLUMNS = {
    "code": "course code",
    "title": "course title",
    "credit": "credit",
    "regn_type": "regn",
    "category": "category",
    "course_type": "course type",
    "faculty": "faculty",
    "slot": "slot",
    "room": "room",
    "academic_year": "academic year",
}


def _clean(text: str) -> str:
    """Collapse whitespace (incl. non-breaking spaces) and trim."""
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def _to_int(text: str) -> int | None:
    text = _clean(text)
    return int(text) if text.isdigit() else None


def parse_timetable(raw: str) -> Timetable:
    """Parse the raw Creator-page response into a Timetable."""
    html = extract_page_html(raw)
    soup = BeautifulSoup(html, "html.parser")

    student = _parse_student(soup)
    courses = _parse_courses(soup)
    academic_year = next(
        (c.academic_year for c in courses if c.academic_year), None
    )
    return Timetable(student=student, courses=courses, academic_year=academic_year)


def _parse_student(soup: BeautifulSoup) -> StudentInfo:
    """Read the label/value info table above the course list."""
    table = _find_table_containing(soup, "Registration Number")
    fields: dict[str, str | None] = {}
    if table is not None:
        cells = [_clean(td.get_text()) for td in table.find_all("td")]
        # Cells are label/value pairs: a cell ending in ':' is a label, the
        # next non-empty cell is its value.
        pairs: dict[str, str] = {}
        i = 0
        while i < len(cells) - 1:
            label = cells[i].rstrip(":").strip().lower()
            if cells[i].endswith(":") and label:
                pairs[label] = cells[i + 1]
                i += 2
            else:
                i += 1
        for field, labels in _INFO_LABELS.items():
            for label in labels:
                if label in pairs:
                    fields[field] = pairs[label] or None
                    break

    department = fields.get("department")
    section = None
    if department:
        m = _SECTION_RE.search(department)
        if m:
            section = m.group(1)
            # Drop the "-(E2 Section)" suffix from the department name.
            department = _clean(department[: m.start()].rstrip(" -"))

    return StudentInfo(
        registration_number=fields.get("registration_number"),
        name=fields.get("name"),
        program=fields.get("program"),
        department=department,
        section=section,
        semester=fields.get("semester"),
        batch=fields.get("batch"),
        mobile=fields.get("mobile"),
    )


def _parse_courses(soup: BeautifulSoup) -> list[Course]:
    table = soup.find("table", class_="course_tbl")
    if not isinstance(table, Tag):
        return []

    header_row = table.find("tr")
    if not isinstance(header_row, Tag):
        return []
    headers = [_clean(td.get_text()).lower() for td in header_row.find_all("td")]
    ncols = len(headers)
    if ncols == 0:
        return []

    # Column index for each Course field, by matching the header substring.
    col_index: dict[str, int] = {}
    for field, needle in _COURSE_COLUMNS.items():
        for idx, header in enumerate(headers):
            if needle in header:
                col_index[field] = idx
                break

    # Data cells follow the header cells in document order; chunk by ncols.
    all_tds = table.find_all("td")
    data_tds = all_tds[ncols:]
    courses: list[Course] = []
    for start in range(0, len(data_tds) - ncols + 1, ncols):
        row = [_clean(td.get_text()) for td in data_tds[start : start + ncols]]

        def cell(field: str) -> str | None:
            idx = col_index.get(field)
            if idx is None or idx >= len(row):
                return None
            return row[idx] or None

        code = cell("code")
        title = cell("title")
        if not code or not title:
            continue  # skip footer/blank rows that slipped in

        credit_raw = cell("credit")
        courses.append(
            Course(
                code=code,
                title=title,
                credit=_to_int(credit_raw) if credit_raw else None,
                regn_type=cell("regn_type"),
                category=cell("category"),
                course_type=cell("course_type"),
                faculty=cell("faculty"),
                slot=cell("slot"),
                room=cell("room"),
                academic_year=cell("academic_year"),
            )
        )
    return courses


def _find_table_containing(soup: BeautifulSoup, text: str) -> Tag | None:
    for table in soup.find_all("table"):
        if text.lower() in table.get_text().lower():
            return table
    return None
