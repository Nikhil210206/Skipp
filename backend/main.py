"""Skipp backend: FastAPI scraper for the SRM academia portal.

Routes: /health, POST /timetable, POST /attendance. Marks lands later.

Security (non-negotiable): the password is never written to disk, a database,
or a log. It lives in memory for the duration of one request only, on the
`LoginRequest` model, and the authenticated session is closed before we
return. The net id alone is logged to stdout on a successful sign-in (see
`_login_or_4xx`), which the platform surfaces as ephemeral runtime logs and
never persists to a database.
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import logging
import os
import time

from core.client import (
    TimeBudgetExceeded,
    PAGE_ACADEMIC_PLANNER,
    PAGE_ATTENDANCE,
    PAGE_TIMETABLE,
    PAGE_UNIFIED_TIMETABLE,
)
from core.session import (
    AppSessionError,
    CaptchaRequired,
    SignInLimitReached,
    InvalidCredentials,
    PageError,
    PageInaccessible,
    PageNotFound,
    PortalError,
    UserNotFound,
    login,
)
from datetime import datetime, timezone

from models.attendance import Attendance
from models.marks import Marks
from models.schedule import CalendarDay
from models.snapshot import Snapshot
from models.timetable import Timetable
from services.academic_planner import parse_planner, semester_anchor
from services.attendance import AttendanceUnavailable, parse_attendance
from services.creator import PageEmptyError
from services.marks import MarksUnavailable, parse_marks
from services.schedule import build_day_orders
from services.timetable import parse_timetable
from services.unified_timetable import parse_unified_timetable


# The root logger defaults to WARNING with no attached handler, so an INFO
# call is silently dropped rather than reaching stdout. Every existing log
# call in this codebase is a `warning`, which is why that went unnoticed
# until an `info` call (the sign-in log below) needed to actually show up.
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("skipp.api")

# Attendance and marks both render on the attendance page; marks appears once
# the university publishes internal assessments.
PAGE_MARKS = PAGE_ATTENDANCE

app = FastAPI(title="Skipp API", version="0.0.1")

# CORS. In dev the frontend runs on :3000, on localhost or a LAN IP (so a phone
# on the same Wi-Fi can reach it). In production the deployed origin is named
# explicitly in SKIPP_ALLOWED_ORIGINS (comma separated), because the dev regex
# only matches http:// and would reject the real https:// site.
DEV_ORIGIN_RE = (
    r"http://(localhost|127\.0\.0\.1|"
    r"(?:192\.168|10|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+):3000"
)
_allowed = [
    o.strip().rstrip("/")
    for o in os.environ.get("SKIPP_ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    # Dropped in production: a deployment that names its origins should not also
    # accept every LAN address.
    allow_origin_regex=None if _allowed else DEV_ORIGIN_RE,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    """Credentials for a single scrape request. Never persisted."""

    username: str = Field(description="SRM net id or full email")
    password: str = Field(repr=False)


@app.get("/health")
def health() -> dict:
    """Liveness probe, plus the CORS config the process actually loaded.

    Origins are not secret (they are echoed in Access-Control-Allow-Origin on
    every successful preflight), and having the deployment state visible turns
    "why is CORS failing" from guesswork into one request. Nothing else about
    the environment is exposed.
    """
    return {
        "status": "ok",
        "service": "skipp-api",
        "allowedOrigins": _allowed,
        "devOriginRegexActive": not _allowed,
    }


# --- Abuse limits ------------------------------------------------------------
#
# Every request here spends a real Zoho sign-in against a real student's daily
# cap, so an unthrottled endpoint is not merely a load problem: anyone who knows
# the URL can burn a stranger's access to their own attendance, and the typed
# `user_not_found` / `wrong_password` replies make it a Net ID oracle while they
# are at it. CORS does not help, it restrains browsers and not curl.
#
# This is a floor, not a fix. Fluid Compute reuses instances so the counters do
# survive between requests, but they are per instance and reset on a cold start.
# The real answer is a shared secret in front or a KV backed limiter; until that
# is decided, this makes casual scripted abuse expensive without touching the
# normal path (a student signs in far below these numbers).

_RATE: dict[str, list[float]] = {}
_PER_IP_PER_HOUR = 20
_PER_ACCOUNT_PER_HOUR = 10
_WINDOW = 3600.0


def _client_ip(request: Request) -> str:
    """The caller, as far as the platform will tell us.

    `x-forwarded-for` is a chain and only the FIRST entry is the origin client;
    taking the last would let a caller append their own and rotate it freely.
    """
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_check(request: Request, username: str) -> None:
    """Refuse when one caller, or one account, is being hammered."""
    now = time.monotonic()
    for key, ceiling in (
        (f"ip:{_client_ip(request)}", _PER_IP_PER_HOUR),
        # Lowercased so casing cannot be used to multiply the allowance.
        (f"acct:{username.strip().lower()}", _PER_ACCOUNT_PER_HOUR),
    ):
        hits = [t for t in _RATE.get(key, []) if now - t < _WINDOW]
        if len(hits) >= ceiling:
            raise _fail(
                429,
                "captcha",
                "Too many sign-in attempts. Wait a while and try again.",
            )
        hits.append(now)
        _RATE[key] = hits

    # Unbounded growth would be its own denial of service on a long lived
    # instance, so drop keys nobody is using.
    if len(_RATE) > 2048:
        for k in [k for k, v in _RATE.items() if not v or now - v[-1] > _WINDOW]:
            _RATE.pop(k, None)


@app.exception_handler(TimeBudgetExceeded)
def _slow_portal(_: Request, exc: TimeBudgetExceeded) -> JSONResponse:
    """The portal outran our wall-clock budget, so we stopped on our own terms.

    504 rather than 500: nothing is broken and nothing the student typed is
    wrong. The session was logged out on the way down, so retrying is safe.
    """
    return JSONResponse(
        status_code=504,
        content={
            "detail": {
                "code": "slow_portal",
                "message": str(exc) or "The portal took too long to answer.",
            }
        },
    )


def _fail(status: int, code: str, message: str) -> HTTPException:
    """
    Errors carry a machine-readable code beside the prose.

    CAPTCHA and the daily sign-in cap are both 429 but need completely different
    advice, and matching on the message text would break the moment the wording
    changes.
    """
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def _login_or_4xx(req: LoginRequest):
    """Authenticate, mapping login failures to clean HTTP errors.

    Logs the net id (never the password) on a successful sign-in only, to
    stdout, so it shows up in the platform's runtime log stream and nowhere
    more permanent: not a database, not a file on disk.
    """
    try:
        session = login(req.username, req.password)
    except UserNotFound as e:
        raise _fail(404, "user_not_found", str(e)) from e
    except InvalidCredentials as e:
        raise _fail(401, "wrong_password", str(e)) from e
    except CaptchaRequired as e:
        raise _fail(429, "captcha", str(e)) from e
    except SignInLimitReached as e:
        raise _fail(429, "signin_limit", str(e)) from e
    except PortalError as e:
        raise _fail(502, "portal", str(e)) from e
    # TimeBudgetExceeded is deliberately NOT caught here: the app-level handler
    # turns it into a 504 wherever it is raised, login or page fetch alike.
    log.info("signed in: %s", req.username)
    return session


@app.post("/timetable", response_model=Timetable)
def timetable(req: LoginRequest, request: Request) -> Timetable:
    """Log in and return courses + day-order schedules + semester calendar.

    All three pages are fetched in one session. The day-order enrichment is
    best-effort: if the unified time table or planner can't be fetched/parsed,
    we still return the course list (empty dayOrders/calendar).
    """
    _rate_check(request, req.username)
    session = _login_or_4xx(req)
    try:
        tt = parse_timetable(session.fetch_page(PAGE_TIMETABLE))
        _enrich_with_day_orders(session, tt)
        return tt
    except PageEmptyError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except PageNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (AppSessionError, PageError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        session.close()


@app.post("/refresh", response_model=Snapshot)
def refresh(req: LoginRequest, request: Request) -> Snapshot:
    """Everything from ONE login: timetable + attendance + marks.

    This is the endpoint the app should use: a whole browsing session costs a
    single Zoho sign-in (which is daily-capped). Only a timetable failure is
    fatal; attendance/marks each carry their own status (ready/gated/error).
    """
    _rate_check(request, req.username)
    session = _login_or_4xx(req)
    try:
        tt = parse_timetable(session.fetch_page(PAGE_TIMETABLE))
        _enrich_with_day_orders(session, tt)

        att, att_status, att_msg = _try_section(
            lambda: parse_attendance(session.fetch_page(PAGE_ATTENDANCE)),
            _GATED_MSG,
        )
        marks, marks_status, marks_msg = _try_section(
            lambda: parse_marks(session.fetch_page(PAGE_MARKS)),
            _MARKS_GATED_MSG,
        )
        if marks:  # the marks table has no title column, fill from the timetable
            titles = {c.code: c.title for c in tt.courses}
            for s in marks.subjects:
                s.title = titles.get(s.code, s.code)
        return Snapshot(
            timetable=tt,
            attendance=att,
            attendance_status=att_status,
            attendance_message=att_msg,
            marks=marks,
            marks_status=marks_status,
            marks_message=marks_msg,
            fetched_at=datetime.now(timezone.utc).isoformat(),
        )
    except PageEmptyError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except PageNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (AppSessionError, PageError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        session.close()


def _try_section(fetch, gated_msg: str) -> tuple:
    """Run a section fetch, mapping gated/failed states to a status tuple.

    Returns (data_or_None, status, message). It never raises: a gated or broken
    section must not sink the whole snapshot.
    """
    try:
        return fetch(), "ready", None
    except TimeBudgetExceeded:
        # Not a section failure. Carrying on would spend the little time left
        # on calls that must also fail, and return a hollow 200 while doing it.
        raise
    except (PageInaccessible, AttendanceUnavailable, MarksUnavailable):
        return None, "gated", gated_msg
    except (PageNotFound, AppSessionError, PageEmptyError, PageError) as e:
        return None, "error", str(e)
    except Exception as e:  # noqa: BLE001  (a parser bug is non-fatal)
        log.warning("section fetch failed: %s", e)
        return None, "error", "Couldn't load this section."


def _enrich_with_day_orders(session, tt: Timetable) -> None:
    """Add day-order schedules + calendar to a parsed Timetable, best-effort."""
    try:
        grid = parse_unified_timetable(session.fetch_page(PAGE_UNIFIED_TIMETABLE))
        tt.day_orders = build_day_orders(tt.courses, grid)
    except TimeBudgetExceeded:
        raise
    except Exception as e:  # noqa: BLE001  (enrichment must never fail the call)
        log.warning("day-order enrichment failed: %s", e)
    try:
        year, month = semester_anchor(PAGE_ACADEMIC_PLANNER)
        raw = session.fetch_page(PAGE_ACADEMIC_PLANNER)
        tt.calendar = [CalendarDay(**d) for d in parse_planner(raw, year, month)]
    except TimeBudgetExceeded:
        raise
    except Exception as e:  # noqa: BLE001
        log.warning("calendar enrichment failed: %s", e)


@app.post("/attendance", response_model=Attendance)
def attendance(req: LoginRequest, request: Request) -> Attendance:
    """Log in and return attendance + the bunk predictor.

    The `My_Attendance` page is admin-gated at semester start; until it's live
    we return a clean 503. Once populated, the parser runs automatically.
    """
    _rate_check(request, req.username)
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
def marks(req: LoginRequest, request: Request) -> Marks:
    """Log in and return internal marks per subject.

    Marks publish onto the attendance page once assessments happen; until then
    this returns a clean 503, then works automatically.
    """
    _rate_check(request, req.username)
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


class _StripMountPath:
    """Serves the path the caller asked for, not the one the platform mounted.

    On Vercel this app is a function at `api/index.py` and `vercel.json`
    rewrites every request to `/api/index/$1`, so a request for `/health`
    arrives asking for `/api/index/health` and matches no route. The whole API
    then answers FastAPI's own `{"detail":"Not Found"}` while the middleware,
    and therefore CORS, keeps working perfectly, which reads as a broken login
    rather than a broken deployment.

    This has to live on the app rather than around it. Wrapping the ASGI app in
    `api/index.py` was tried first and had no effect in production: the runtime
    does not necessarily serve the object exported from that module. Middleware
    registered here provably runs, because the CORS rejection does.

    Locally there is no prefix to remove, so this is a no-op under uvicorn.
    """

    #: Where the serverless function is mounted.
    MOUNT = "/api/index"

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            path = scope.get("path", "")
            if path == self.MOUNT or path.startswith(self.MOUNT + "/"):
                trimmed = path[len(self.MOUNT) :] or "/"
                scope = {**scope, "path": trimmed, "raw_path": trimmed.encode()}
        await self.app(scope, receive, send)


# Added last so it is the outermost layer: the path is corrected before routing
# and before CORS ever looks at it.
app.add_middleware(_StripMountPath)
