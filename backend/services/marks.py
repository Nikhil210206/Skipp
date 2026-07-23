"""Parse the academia internal-marks table into JSON.

⚠️ Like attendance, this is written against the documented SRM academia marks
layout and is admin-gated at semester start — it needs a one-line sanity check
against a real capture once marks are published. Written defensively.

Expected layout: a "Mark Details / Test Performance" table where each course row
carries a nested table of components. The nested table's common form is two
aligned rows — component name + max on top, score below — e.g.

    | FT-I / 25.00 | FT-II / 25.00 |     (header cells: "<strong>FT-I</strong>25.00")
    |    20.50     |    18.00      |     (score cells)

We tolerate both that two-row form and a flat "name max score" cell form.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup, Tag

from models.marks import Marks, MarkComponent, SubjectMarks

from .creator import extract_page_html

_NUM = re.compile(r"-?\d+(?:\.\d+)?")


class MarksUnavailable(Exception):
    """The page loaded but held no recognizable marks table."""


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def parse_marks(raw: str) -> Marks:
    """Parse the raw Creator-page response into a Marks object."""
    html = extract_page_html(raw)
    soup = BeautifulSoup(html, "html.parser")

    table = _find_marks_table(soup)
    if table is None:
        raise MarksUnavailable(
            "No marks table found — page structure differs from expected "
            "(capture a live page to finalize the parser)."
        )

    subjects: list[SubjectMarks] = []
    for code, marks_cell in _course_rows(table):
        components = _parse_components(marks_cell) if marks_cell else []
        subjects.append(
            SubjectMarks(
                code=code,
                title="",  # marks table has no title column — enriched from timetable
                components=components,
                scored_total=round(sum(c.scored for c in components), 2),
                max_total=round(sum(c.max for c in components), 2),
            )
        )

    return Marks(
        subjects=subjects,
        last_updated=datetime.now(timezone.utc).isoformat(),
    )


def _find_marks_table(soup: BeautifulSoup) -> Tag | None:
    for table in soup.find_all("table"):
        text = table.get_text().lower()
        if "course code" in text and ("mark" in text or "test performance" in text):
            return table
    return None


def _course_rows(table: Tag):
    """Yield (code, marks_cell_or_None) per course row.

    A course row is one whose first cell looks like a course code. The marks
    cell (nested component table) may be absent before any tests are graded — we
    still yield the course so it shows with "no components yet".
    """
    for tr in table.find_all("tr"):
        cells = tr.find_all("td", recursive=False) or tr.find_all("td")
        if not cells:
            continue
        code = _clean(cells[0].get_text())
        if not re.match(r"^\d{2}[A-Z]{2,4}\d{3}[A-Z]?$", code):
            continue  # header / course-type / non-course row
        yield code, tr.find("table")


def _parse_components(nested: Tag) -> list[MarkComponent]:
    """Extract components from a course's nested mark table.

    Handles the two-row (name+max on top, score below) form and a flat form
    where a single cell holds name, max and score together.
    """
    rows = nested.find_all("tr")
    # Two-row aligned form.
    if len(rows) >= 2:
        head = rows[0].find_all("td")
        body = rows[1].find_all("td")
        if head and len(head) == len(body):
            out: list[MarkComponent] = []
            for h, b in zip(head, body):
                name, mx = _name_and_max(h)
                score = _first_num(b.get_text())
                if name and mx is not None:
                    out.append(MarkComponent(name=name, scored=score or 0.0, max=mx))
            if out:
                return out

    # Flat form: each cell holds "Name max score".
    out = []
    for td in nested.find_all("td"):
        name, mx = _name_and_max(td)
        nums = _NUM.findall(td.get_text())
        if name and mx is not None and nums:
            score = float(nums[-1])
            out.append(MarkComponent(name=name, scored=score, max=mx))
    return out


def _name_and_max(cell: Tag) -> tuple[str, float | None]:
    """A header cell like '<strong>FT-I</strong>25.00' -> ('FT-I', 25.0)."""
    strong = cell.find(["strong", "b"])
    if strong is not None:
        name = _clean(strong.get_text())
        rest = cell.get_text().replace(strong.get_text(), " ")
        mx = _first_num(rest)
        return name, mx
    text = _clean(cell.get_text())
    m = _NUM.search(text)
    if not m:
        return text, None
    name = text[: m.start()].strip(" /-") or text
    return name, float(m.group())


def _first_num(text: str) -> float | None:
    m = _NUM.search(text or "")
    return float(m.group()) if m else None
