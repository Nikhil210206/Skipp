"""Parse the student portal's internal marks report.

Source: `POST /students/report/studentInternalMarkDetails.jsp`.

    Code | Description | Mark / Max. Mark | (unlabelled)

HONEST LIMIT, READ THIS BEFORE TRUSTING IT
------------------------------------------
This parser has NEVER been run against populated data. On the account it was
written from (2026-08-17) the portal answered "No Record found." for marks,
exactly as academia does this term, so only the empty case is verified. The
column layout above is real; how a populated row fills the third cell is an
assumption, and the fourth column's purpose is unknown.

It is therefore written to fail loudly rather than plausibly: a row it cannot
read is skipped, and a page with no readable rows raises `MarksUnavailable` so
the route reports the section as gated instead of inventing an empty transcript.
**When marks publish, check this against a real page before believing a number.**

Note also that this is the LESS useful half of the student portal fallback:
marks were never the thing that broke on academia. It exists so the fallback is
complete, not because it is currently needed.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup, Tag

from models.marks import MarkComponent, Marks, SubjectMarks

#: "No Record found." is the portal's empty state, not an error page.
_EMPTY_MARKERS = ("no record found", "no records found")

#: A "scored / max" pair, e.g. "18.50/25.00" or "18.5 / 25".
_PAIR_RE = re.compile(r"(-?\d+(?:\.\d+)?)\s*/\s*(-?\d+(?:\.\d+)?)")

_COLUMNS = {
    "code": "code",
    "title": "description",
    "mark": "mark",
}


class MarksUnavailable(Exception):
    """The page loaded but published no marks (the ordinary case mid-term)."""


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def parse_marks(html: str) -> Marks:
    soup = BeautifulSoup(html, "html.parser")

    if any(m in soup.get_text().lower() for m in _EMPTY_MARKERS):
        raise MarksUnavailable("The student portal has not published marks yet.")

    table = _find_marks_table(soup)
    if table is None:
        raise MarksUnavailable("No marks table on the student portal page.")

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
                index.setdefault(field, i)
                break

    if "code" not in index or "mark" not in index:
        raise MarksUnavailable("Marks table is missing the columns we parse.")

    # A course may occupy several rows (one per assessment), so rows accumulate
    # into the subject their code names rather than each becoming a subject.
    by_code: dict[str, SubjectMarks] = {}
    order: list[str] = []

    for tr in table.find_all("tr"):
        cells = [_clean(c.get_text()) for c in tr.find_all("td")]
        if not cells:
            continue

        def cell(field: str) -> str:
            i = index.get(field)
            return cells[i] if i is not None and i < len(cells) else ""

        code = cell("code")
        if not code or any(m in code.lower() for m in _EMPTY_MARKERS):
            continue

        pair = _PAIR_RE.search(cell("mark"))
        if not pair:
            # Unreadable rather than zero: a subject silently scored 0 is the
            # one wrong answer a student would act on.
            continue
        scored, maximum = float(pair.group(1)), float(pair.group(2))

        subject = by_code.get(code)
        if subject is None:
            # Title deliberately left EMPTY. "Description" here names the
            # ASSESSMENT ("CLA-1"), not the course, so using it would put
            # "CLA-1" where the app prints a subject name. The route fills
            # titles from the timetable by code, exactly as /refresh already
            # does for academia's marks table.
            subject = SubjectMarks(code=code, title="")
            by_code[code] = subject
            order.append(code)

        subject.components.append(
            MarkComponent(
                name=cell("title") or "Internal",
                scored=scored,
                max=maximum,
            )
        )
        subject.scored_total += scored
        subject.max_total += maximum

    if not by_code:
        raise MarksUnavailable("Marks table held no readable rows.")

    return Marks(
        subjects=[by_code[c] for c in order],
        last_updated=datetime.now(timezone.utc).isoformat(),
    )


def _find_marks_table(soup: BeautifulSoup) -> Tag | None:
    for table in soup.find_all("table"):
        first = table.find("tr")
        if not first:
            continue
        head = " ".join(
            _clean(c.get_text()).lower() for c in first.find_all(["th", "td"])
        )
        if "code" in head and "mark" in head:
            return table
    return None
