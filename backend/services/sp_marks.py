"""Parse the student portal's internal marks report.

Source: `POST /students/report/studentInternalMarkDetails.jsp`.

Populated layout:
    Code | Description | Mark / Max. Mark | (Assessment / Test Name)

    e.g.
    21MAB302T | DISCRETE MATHEMATICS | 5.00/5.00 | FT1
    21ASO301T | ELEMENTS OF AERONAUTICS | 4.50/5.00 | FT1
    21CSC301T | FORMAL LANGUAGE AND AUTOMATA | 2.00/5.00 | FT1
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup, Tag

from models.marks import MarkComponent, Marks, SubjectMarks

#: "No Record found." is the portal's empty state, not an error page.
_EMPTY_MARKERS = ("no record found", "no records found")

#: A "scored / max" pair, e.g. "18.50/25.00" or "18.5 / 25" or "5/5".
_PAIR_RE = re.compile(r"(-?\d+(?:\.\d+)?)\s*/\s*(-?\d+(?:\.\d+)?)")

#: Standard course code pattern, e.g. 21MAB302T, 21ASO301T.
_CODE_RE = re.compile(r"^\d{2}[A-Z]{2,4}\d{3}[A-Z]?$")


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

    code_col: int | None = None
    desc_col: int | None = None
    mark_col: int | None = None
    test_col: int | None = None

    for i, head in enumerate(headers):
        if "code" in head and code_col is None:
            code_col = i
        elif any(k in head for k in ("desc", "course", "subject", "title")) and desc_col is None:
            desc_col = i
        elif "mark" in head and mark_col is None:
            mark_col = i
        elif any(k in head for k in ("test", "exam", "assess", "component", "eval", "type")) and test_col is None:
            test_col = i

    by_code: dict[str, SubjectMarks] = {}
    order: list[str] = []

    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue
        cells = [_clean(c.get_text()) for c in tds]

        # 1. Identify course code
        actual_code_idx: int | None = None
        code: str = ""
        if code_col is not None and code_col < len(cells) and _CODE_RE.match(cells[code_col]):
            actual_code_idx = code_col
            code = cells[code_col]
        else:
            for i, c in enumerate(cells):
                if _CODE_RE.match(c):
                    actual_code_idx = i
                    code = c
                    break

        if not code or any(m in code.lower() for m in _EMPTY_MARKERS):
            continue

        # 2. Identify mark (scored / max)
        actual_mark_idx: int | None = None
        pair: re.Match[str] | None = None
        if mark_col is not None and mark_col < len(cells):
            pair = _PAIR_RE.search(cells[mark_col])
            if pair:
                actual_mark_idx = mark_col

        if not pair:
            for i, c in enumerate(cells):
                if i == actual_code_idx:
                    continue
                pair = _PAIR_RE.search(c)
                if pair:
                    actual_mark_idx = i
                    break

        if not pair or actual_mark_idx is None:
            continue

        scored, maximum = float(pair.group(1)), float(pair.group(2))

        # 3. Identify course description / title
        actual_desc_idx: int | None = None
        if desc_col is not None and desc_col < len(cells) and desc_col not in (actual_code_idx, actual_mark_idx):
            actual_desc_idx = desc_col
        else:
            for i, c in enumerate(cells):
                if i not in (actual_code_idx, actual_mark_idx) and len(c) > 3:
                    actual_desc_idx = i
                    break

        desc = cells[actual_desc_idx] if actual_desc_idx is not None and actual_desc_idx < len(cells) else ""

        # 4. Identify test / assessment name (e.g. "FT1", "CT 1", "CLA-1")
        test_name: str = ""

        # Strategy A: Explicit test column from header
        if test_col is not None and test_col < len(cells) and test_col not in (actual_code_idx, actual_mark_idx, actual_desc_idx):
            val = cells[test_col].strip()
            if val:
                test_name = val

        # Strategy B: Any remaining cell that is not code, marks, or description
        # (in the portal report, this is the 4th column whose header is often unlabelled)
        if not test_name:
            excluded = {actual_code_idx, actual_mark_idx, actual_desc_idx}
            other_indices = [i for i in range(len(cells)) if i not in excluded]
            for i in other_indices:
                candidate = cells[i].strip()
                if not candidate and i < len(tds):
                    inp = tds[i].find(["input", "button", "a", "span"])
                    if inp:
                        candidate = _clean(inp.get("value") or inp.get_text() or inp.get("title") or "")
                # Skip S.No / pure numbers and portal navigation keywords
                if candidate and not re.match(r"^\d+$", candidate) and candidate.lower() not in ("view", "details", "nil", "-", "na", "n/a"):
                    if candidate.lower() != desc.lower():
                        test_name = candidate
                        break

        # Strategy C: Check if test name was prefixed/suffixed inside the mark cell (e.g. "FT1: 5/5")
        if not test_name:
            mark_text = cells[actual_mark_idx]
            leftover = mark_text.replace(pair.group(0), "").strip(" :-/()")
            if leftover and len(leftover) >= 2 and re.search(r"[A-Za-z]", leftover) and leftover.lower() != desc.lower():
                test_name = leftover

        # Strategy D: Check if test name was appended to the description (e.g. "DISCRETE MATHEMATICS - FT1")
        if not test_name and desc:
            m = re.search(r"[-–/]\s*([A-Za-z0-9\s]{2,15})$", desc)
            if m:
                test_name = m.group(1).strip()
                desc = desc[: m.start()].strip(" -–/")

        subject = by_code.get(code)
        if subject is None:
            # Store the course description from the portal (e.g. "DISCRETE MATHEMATICS")
            # so s.title is never blank, and can be title-cased or enriched from timetable.
            subject = SubjectMarks(code=code, title=desc)
            by_code[code] = subject
            order.append(code)
        elif not subject.title and desc:
            subject.title = desc

        # Final fallback for test name: never use the subject description or generic "Internal"!
        if not test_name or test_name.lower() in (desc.lower(), "internal", "test"):
            test_num = len(subject.components) + 1
            if maximum <= 5:
                test_name = f"FT{test_num}"
            else:
                test_name = f"CT {test_num}"

        subject.components.append(
            MarkComponent(
                name=test_name,
                scored=scored,
                max=maximum,
            )
        )
        subject.scored_total = round(subject.scored_total + scored, 2)
        subject.max_total = round(subject.max_total + maximum, 2)

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
