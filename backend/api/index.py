"""Vercel serverless entry point.

Vercel treats each file under `api/` as a function and serves an ASGI `app`
exported from it. The `vercel.json` rewrite sends every path here carrying the
original path along (`/api/index/$1`), and `main._StripMountPath` takes the
mount prefix back off so the routes stay identical to running uvicorn locally
(`/health`, `/refresh`, ...).

That correction deliberately lives on the app, not here. Wrapping the app in
this module was tried and had no effect in production: the runtime does not
necessarily serve the object this file exports, so a wrapper here can be
silently skipped. Middleware registered on the app provably runs.

The repo root is not on sys.path for a function nested in `api/`, so it is
added before importing the app.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from main import app  # noqa: E402  (path must be set before this import)

__all__ = ["app"]
