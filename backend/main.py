"""Skipp backend — FastAPI scraper for the SRM academia portal.

Routes: /health, POST /timetable, POST /attendance. Marks lands later.

Security (non-negotiable): credentials are never written to disk, a database,
or logs. They live in memory for the duration of one request only, on the
`LoginRequest` model, and the authenticated session is closed before we return.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from core.client import PAGE_ATTENDANCE, PAGE_TIMETABLE
from core.session import (
    AppSessionError,
    CaptchaRequired,
    InvalidCredentials,
    PageError,
    PageInaccessible,
    PageNotFound,
    PortalError,
    UserNotFound,
    login,
)
from models.attendance import Attendance
from models.marks import Marks
from models.timetable import Timetable
from services.attendance import AttendanceUnavailable, parse_attendance
from services.creator import PageEmptyError
from services.marks import MarksUnavailable, parse_marks
from services.timetable import parse_timetable

# Attendance and marks both render on the attendance page; marks appears once
# the university publishes internal assessments.
PAGE_MARKS = PAGE_ATTENDANCE

app = FastAPI(title="Skipp API", version="0.0.1")

# Dev CORS: the Next.js frontend runs on :3000. Tighten for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    """Credentials for a single scrape request. Never persisted."""

    username: str = Field(description="SRM net id or full email")
    password: str = Field(repr=False)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe. Returns OK if the service is up."""
    return {"status": "ok", "service": "skipp-api"}


def _login_or_4xx(req: LoginRequest):
    """Authenticate, mapping login failures to clean HTTP errors."""
    try:
        return login(req.username, req.password)
    except UserNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except InvalidCredentials as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except CaptchaRequired as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    except PortalError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.post("/timetable", response_model=Timetable)
def timetable(req: LoginRequest) -> Timetable:
    """Log in and return the student's registered courses + info."""
    session = _login_or_4xx(req)
    try:
        raw = session.fetch_page(PAGE_TIMETABLE)
        return parse_timetable(raw)
    except PageEmptyError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except PageNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PageError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        session.close()


@app.post("/attendance", response_model=Attendance)
def attendance(req: LoginRequest) -> Attendance:
    """Log in and return attendance + the bunk predictor.

    The `My_Attendance` page is admin-gated at semester start; until it's live
    we return a clean 503. Once populated, the parser runs automatically.
    """
    session = _login_or_4xx(req)
    try:
        raw = session.fetch_page(PAGE_ATTENDANCE)
        return parse_attendance(raw)
    except (PageInaccessible, AttendanceUnavailable) as e:
        raise HTTPException(status_code=503, detail=_GATED_MSG) from e
    except PageNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (AppSessionError, PageEmptyError, PageError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        session.close()


@app.post("/marks", response_model=Marks)
def marks(req: LoginRequest) -> Marks:
    """Log in and return internal marks per subject.

    Marks publish onto the attendance page once assessments happen; until then
    this returns a clean 503, then works automatically.
    """
    session = _login_or_4xx(req)
    try:
        raw = session.fetch_page(PAGE_MARKS)
        return parse_marks(raw)
    except (PageInaccessible, MarksUnavailable) as e:
        raise HTTPException(status_code=503, detail=_MARKS_GATED_MSG) from e
    except PageNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (AppSessionError, PageEmptyError, PageError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        session.close()


_GATED_MSG = (
    "Attendance isn't available on the portal yet "
    "(the university enables it once classes are recorded)."
)
_MARKS_GATED_MSG = (
    "Marks aren't published on the portal yet "
    "(they appear once internal assessments are graded)."
)
