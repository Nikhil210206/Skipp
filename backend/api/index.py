"""Vercel serverless entry point.

Vercel treats each file under `api/` as a function and serves an ASGI `app`
exported from it directly, so this re-exports the FastAPI application. The
`vercel.json` rewrite sends every path here, which keeps the routes identical
to running uvicorn locally (`/health`, `/refresh`, ...).

The repo root is not on sys.path for a function nested in `api/`, so it is
added before importing the app.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from main import app  # noqa: E402  (path must be set before this import)

__all__ = ["app"]
