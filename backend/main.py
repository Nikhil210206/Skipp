"""Skipp backend — FastAPI scraper for the SRM academia portal.

Phase 0: only /health exists. Scraping routes (/login, /attendance, /marks,
/timetable) land in later phases. See PLAN.md.

Security (non-negotiable): credentials are never written to disk, a database,
or logs. They live in memory for the duration of one request only.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Skipp API", version="0.0.1")

# Dev CORS: the Next.js frontend runs on :3000. Tighten for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe. Returns OK if the service is up."""
    return {"status": "ok", "service": "skipp-api"}
