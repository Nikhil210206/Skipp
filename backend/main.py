"""Skipp backend — FastAPI scraper for the SRM academia portal.

Routes: /health, POST /timetable, POST /attendance. Marks lands later.

Security (non-negotiable): credentials are never written to disk, a database,
or logs. They live in memory for the duration of one request only, on the
`LoginRequest` model, and the authenticated session is closed before we return.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from core.client import PAGE_TIMETABLE
from core.session import (
    InvalidCredentials,
    PageError,
    PageInaccessible,
    PageNotFound,
    PortalError,
    UserNotFound,
    login,
)
from models.timetable import Timetable
from services.creator import PageEmptyError
from services.timetable import parse_timetable

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


@app.post("/attendance")
def attendance(req: LoginRequest) -> dict:
    """Log in and return attendance.

    The `My_Attendance` page is admin-gated at semester start; until it's live
    we surface a clean 503 rather than a 500. The parser lands once we can
    capture a populated page.
    """
    session = _login_or_4xx(req)
    try:
        session.fetch_page("My_Attendance")
        # TODO(phase 2): parse_attendance(raw) once the page is populated.
        raise HTTPException(
            status_code=501,
            detail="Attendance parsing not implemented yet.",
        )
    except PageInaccessible as e:
        raise HTTPException(
            status_code=503,
            detail="Attendance isn't available on the portal yet "
            "(the university enables it once classes are recorded).",
        ) from e
    except PageNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PageError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        session.close()
