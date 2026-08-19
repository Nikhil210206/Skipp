"""Request/response schemas for the student portal fallback (WebView model).

The student signs in inside an in-app WebView (a real login, real captcha), the
WebView fetches the report pages same-origin and posts their HTML here. So the
request carries scraped HTML, never a password: the backend does not sign in for
this source. See core/student_portal.py for why.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from models.attendance import Attendance
from models.marks import Marks

SectionStatus = Literal["ready", "gated", "error"]


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class StudentPortalParseRequest(_CamelModel):
    """Report HTML captured by a real, signed-in WebView session.

    `attendance_html` is required; `marks_html` is optional because marks are
    the lesser half of this fallback and are frequently unpublished. Neither
    carries credentials: they are the report pages a real login produced.
    """

    attendance_html: str = Field(description="studentAttendanceDetails.jsp body")
    marks_html: str | None = Field(
        default=None, description="studentInternalMarkDetails.jsp body, if fetched"
    )

class StudentPortalCaptchaResponse(_CamelModel):
    """The initialized session and captcha image for a backend login."""
    session_cookie: str
    domain_field: str
    captcha_field: str
    random_delim: str
    honeypot_field: str
    captcha_base64: str

class StudentPortalLoginRequest(_CamelModel):
    """The submitted credentials, captcha, and session metadata to complete login."""
    username: str
    password: str
    captcha: str
    session_cookie: str
    domain_field: str
    captcha_field: str
    random_delim: str
    honeypot_field: str


class StudentPortalSnapshot(_CamelModel):
    """What one signed-in WebView session yields, parsed.

    Deliberately NOT a `Snapshot`: this source has no timetable, no calendar and
    no day orders, so returning the app's full snapshot shape would mean
    inventing three sections. The app merges this into what academia gave it.
    """

    attendance: Attendance | None = None
    attendance_status: SectionStatus = "error"
    attendance_message: str | None = None
    marks: Marks | None = None
    marks_status: SectionStatus = "error"
    marks_message: str | None = None
    #: The window the portal's own report covers, e.g.
    #: "21/Jul/2026 To 14/Aug/2026". The portal lags real time by a few days,
    #: and a student who just sat a class needs to know that before concluding
    #: their attendance is wrong.
    reported_period: str | None = None
    fetched_at: str = Field(description="ISO timestamp of this parse")
