"""Vercel serverless entry point.

Vercel treats each file under `api/` as a function and serves an ASGI `app`
exported from it directly. The `vercel.json` rewrite sends every path here,
carrying the original path along (`/api/index/$1`), so the routes stay
identical to running uvicorn locally (`/health`, `/refresh`, ...).

The repo root is not on sys.path for a function nested in `api/`, so it is
added before importing the app.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from main import app as _app  # noqa: E402  (path must be set before this import)

#: Where this function is mounted. A request for `/health` arrives rewritten to
#: `/api/index/health`, and whether the runtime hands that over whole or with
#: the mount already stripped is not something we should have to depend on.
_MOUNT = "/api/index"


class _StripMount:
    """Presents the app with the path the caller actually asked for.

    Without this the app saw the function's own path, matched no route, and
    answered FastAPI's `{"detail":"Not Found"}` on every single endpoint, while
    the middleware (and therefore CORS) went on working perfectly. That
    combination reads as a broken login rather than a broken deployment, which
    is what made it expensive to find: the frontend turned the bare 404 into
    "no account with that Net ID" and blamed the student's credentials.

    Written to be correct whichever way the runtime behaves, so a change there
    cannot silently take the whole API down again.
    """

    def __init__(self, inner):
        self._inner = inner

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            path = scope.get("path", "")
            if path == _MOUNT or path.startswith(_MOUNT + "/"):
                trimmed = path[len(_MOUNT) :] or "/"
                scope = {**scope, "path": trimmed, "raw_path": trimmed.encode()}
        await self._inner(scope, receive, send)


app = _StripMount(_app)

__all__ = ["app"]
