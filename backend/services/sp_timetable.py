"""Parse the Student Portal timetable report into a Skipp Timetable model.

Source URL: `POST/GET /students/report/studentTimeTableDetails.jsp`.
First-year students at SRM rely on the Student Portal rather than Academia.
This parser extracts student info, registered courses, and day-order schedules.
"""
from __future__ import annotations

import logging
import re
from typing import Optional, List, Dict
from bs4 import BeautifulSoup, Tag

from models.timetable import Course, StudentInfo, Timetable
from models.schedule import ClassPeriod, DayOrderSchedule
from services.schedule import abbreviate, _to_minutes
from services.academic_calendar_data import CALENDAR_DATA

log = logging.getLogger("skipp.services.sp_timetable")

# Standard SRMIST period timings (Batch 1 & Batch 2 hours)
STANDARD_PERIOD_TIMES = {
    1: ("08:00", "08:50"),
    2: ("08:50", "09:40"),
    3: ("09:45", "10:35"),
    4: ("10:40", "11:30"),
    5: ("11:35", "12:25"),
    6: ("12:30", "01:20"),
    7: ("01:25", "02:15"),
    8: ("02:20", "03:10"),
    9: ("03:10", "04:00"),
    10: ("04:00", "04:50"),
    11: ("04:50", "05:30"),
    12: ("05:30", "06:10"),
}

_CODE_RE = re.compile(r"\b([0-9]{2}[A-Z]{2,4}[0-9]{3,4}[A-Z0-9]?)\b")
_DAY_ORDER_RE = re.compile(r"day\s*(?:order)?\s*([1-5])", re.IGNORECASE)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def _clean_faculty(text: str | None) -> str | None:
    if not text:
        return None
    # Remove employee id like [ 100534 ]
    cleaned = re.sub(r"\s*\[\s*\d+\s*\]", "", text).strip()
    # If all uppercase, convert to title case
    if cleaned.isupper():
        cleaned = cleaned.title()
    return cleaned or None


def parse_sp_timetable(
    html: str,
    default_netid: Optional[str] = None,
    known_courses: Optional[List[Course]] = None,
) -> Optional[Timetable]:
    """Parse timetable HTML from studentTimeTableDetails.jsp."""
    if not html or len(html.strip()) < 50:
        return None

    if any(m in html.lower() for m in ("no record found", "no records found", "session expired")):
        return None

    soup = BeautifulSoup(html, "html.parser")
    
    student = _parse_student_header(soup, default_netid)
    courses = _parse_courses(soup, known_courses)
    day_orders = _parse_day_orders(soup, courses)

    # If we couldn't find day order schedules, default to empty 1-5
    if not day_orders:
        day_orders = [DayOrderSchedule(day_order=d, classes=[]) for d in range(1, 6)]

    return Timetable(
        student=student,
        courses=courses,
        academic_year="AY2026-27-ODD",
        day_orders=day_orders,
        calendar=CALENDAR_DATA,
    )


def _parse_student_header(soup: BeautifulSoup, default_netid: Optional[str] = None) -> StudentInfo:
    """Parse identity info if present in the page."""
    text = soup.get_text()
    reg_match = re.search(r"Registration\s*(?:Number|No)[:.\s]+([A-Za-z0-9]+)", text, re.IGNORECASE)
    name_match = re.search(r"Name[:.\s]+([A-Za-z\s.]+?)(?:\n|Batch|Mobile|Program|Department|$)", text, re.IGNORECASE)
    sec_match = re.search(r"Section[:.\s]+([A-Za-z0-9]+)", text, re.IGNORECASE)
    batch_match = re.search(r"Batch\s*([1-2])", text, re.IGNORECASE)

    reg = reg_match.group(1).strip() if reg_match else default_netid
    name = _clean(name_match.group(1)) if name_match else reg
    section = sec_match.group(1).strip() if sec_match else None
    batch = batch_match.group(1).strip() if batch_match else None

    return StudentInfo(
        registration_number=reg,
        name=name,
        program="B.Tech",
        department=None,
        section=section,
        semester="1",
        batch=batch,
        mobile=None,
    )


def _parse_courses(soup: BeautifulSoup, fallback_courses: Optional[List[Course]] = None) -> List[Course]:
    """Parse courses from the 'TIMETABLE DETAILS' table or generic tables."""
    courses: Dict[str, Course] = {}
    if fallback_courses:
        for c in fallback_courses:
            courses[c.code] = c

    # First attempt: Look for the structured "TIMETABLE DETAILS" table
    for table in soup.find_all("table"):
        first_row = table.find("tr")
        if not first_row:
            continue
        headers = [_clean(th.get_text()).lower() for th in first_row.find_all(["th", "td"])]
        
        # Check if this table has course headers
        if not any("code" in h for h in headers):
            continue

        code_col = name_col = credit_col = slot_col = faculty_col = building_col = floor_col = room_col = None
        for i, h in enumerate(headers):
            if "room" in h:
                room_col = i
            elif "course code" in h or h == "code":
                code_col = i
            elif "course name" in h or (("name" in h or "title" in h or "description" in h) and "faculty" not in h and "room" not in h):
                name_col = i
            elif "credit" in h:
                credit_col = i
            elif "slot" in h:
                slot_col = i
            elif "faculty" in h:
                faculty_col = i
            elif "building" in h:
                building_col = i
            elif "floor" in h:
                floor_col = i

        if code_col is not None:
            for tr in table.find_all("tr")[1:]:
                tds = tr.find_all(["td", "th"])
                if len(tds) <= code_col:
                    continue
                cells = [_clean(td.get_text()) for td in tds]
                raw_code = cells[code_col]
                m = _CODE_RE.search(raw_code)
                if not m:
                    continue
                code = m.group(1)

                raw_title = cells[name_col] if name_col is not None and name_col < len(cells) else code
                title = raw_title.title() if raw_title.isupper() else raw_title

                credit = None
                if credit_col is not None and credit_col < len(cells) and cells[credit_col].isdigit():
                    credit = int(cells[credit_col])

                slot = cells[slot_col] if slot_col is not None and slot_col < len(cells) else None
                faculty = _clean_faculty(cells[faculty_col]) if faculty_col is not None and faculty_col < len(cells) else None

                room_name = cells[room_col] if room_col is not None and room_col < len(cells) else None
                building = cells[building_col] if building_col is not None and building_col < len(cells) else None
                floor = cells[floor_col] if floor_col is not None and floor_col < len(cells) else None

                full_room = room_name
                if room_name and building:
                    full_room = f"{room_name} ({building.title()})"

                is_lab_course = (slot and any(x in slot for x in ("P", "L"))) or "lab" in title.lower() or "graphics" in title.lower() or "practical" in title.lower()

                courses[code] = Course(
                    code=code,
                    title=title,
                    credit=credit,
                    regn_type="Regular",
                    category="Practical" if is_lab_course else "Theory",
                    course_type="Lab Based Theory" if is_lab_course else "Theory",
                    faculty=faculty,
                    slot=slot,
                    room=full_room,
                    academic_year="AY2026-27-ODD",
                )

    # Fallback to general table scan if table didn't have standard headers
    if not courses:
        for tr in soup.find_all("tr"):
            cells = [_clean(td.get_text()) for td in tr.find_all(["td", "th"])]
            if len(cells) < 3:
                continue
            
            code = None
            for cell in cells:
                m = _CODE_RE.search(cell)
                if m:
                    code = m.group(1)
                    break
            
            if not code or code in courses:
                continue

            title = None
            slot = None
            room = None
            faculty = None

            for cell in cells:
                if cell == code:
                    continue
                if len(cell) > 4 and not title and not re.search(r"^(regular|theory|practical|lab)$", cell, re.I):
                    title = cell.title() if cell.isupper() else cell
                elif re.match(r"^[A-G]$", cell) or re.search(r"^[PL][0-9]+", cell):
                    slot = cell
                elif re.search(r"^(CLS|LH|TP|UB|BEL|BME)[0-9A-Za-z]+", cell):
                    room = cell

            is_lab_course = (slot and any(x in slot for x in ("P", "L"))) or (title and ("lab" in title.lower() or "practical" in title.lower()))
            courses[code] = Course(
                code=code,
                title=title or code,
                credit=None,
                regn_type="Regular",
                category="Practical" if is_lab_course else "Theory",
                course_type="Lab Based Theory" if is_lab_course else "Theory",
                faculty=faculty,
                slot=slot,
                room=room,
                academic_year="AY2026-27-ODD",
            )

    return list(courses.values())


def _parse_day_orders(soup: BeautifulSoup, courses: List[Course]) -> List[DayOrderSchedule]:
    """Parse Day Order grid (Rows: Day 1..5, Cols: Hour 1..10/12)."""
    course_by_code: Dict[str, Course] = {c.code: c for c in courses}
    day_schedules: Dict[int, List[ClassPeriod]] = {d: [] for d in range(1, 6)}

    # Scan for rows starting with "Day 1" .. "Day 5"
    for tr in soup.find_all("tr"):
        tds = tr.find_all(["td", "th"])
        if not tds or len(tds) < 2:
            continue

        first_text = _clean(tds[0].get_text())
        m = _DAY_ORDER_RE.search(first_text)
        if not m:
            continue

        day_order = int(m.group(1))
        hour = 1
        for td in tds[1:]:
            cell_text = _clean(td.get_text())
            colspan = 1
            try:
                if td.has_attr("colspan"):
                    colspan = int(td["colspan"])
            except (ValueError, TypeError):
                colspan = 1

            # Only process if not empty / free period
            if cell_text and cell_text != "-" and cell_text.lower() != "nil" and cell_text.lower() != "free":
                code_match = _CODE_RE.search(cell_text)
                matched_code = code_match.group(1) if code_match else cell_text.strip()
                matched_course = course_by_code.get(matched_code)
                
                if not matched_course:
                    for c in courses:
                        if c.code in cell_text or (len(c.title) > 4 and c.title.lower() in cell_text.lower()):
                            matched_course = c
                            break

                code = matched_course.code if matched_course else matched_code
                title = matched_course.title if matched_course else cell_text
                room = matched_course.room if matched_course else None
                faculty = matched_course.faculty if matched_course else None

                start_time, _ = STANDARD_PERIOD_TIMES.get(hour, ("08:00", "08:50"))
                _, end_time = STANDARD_PERIOD_TIMES.get(hour + colspan - 1, STANDARD_PERIOD_TIMES.get(hour, ("08:00", "08:50")))

                is_lab = (
                    colspan > 1
                    or (matched_course and matched_course.slot and any(x in matched_course.slot for x in ("P", "L")))
                    or "lab" in title.lower()
                    or "graphics" in title.lower()
                    or "practical" in title.lower()
                )

                day_schedules[day_order].append(
                    ClassPeriod(
                        hour=hour,
                        start=start_time,
                        end=end_time,
                        start_min=_to_minutes(start_time),
                        end_min=_to_minutes(end_time),
                        slot=matched_course.slot if (matched_course and matched_course.slot) else f"H{hour}",
                        code=code,
                        title=title,
                        abbrev=abbreviate(title, code),
                        faculty=faculty,
                        room=room,
                        is_lab=is_lab,
                    )
                )

            hour += colspan

    return [
        DayOrderSchedule(day_order=d, classes=day_schedules[d])
        for d in range(1, 6)
    ]
