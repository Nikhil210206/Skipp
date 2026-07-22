"""Shared helpers for Zoho Creator pages.

Every academia section (timetable, attendance, marks) is a Creator page whose
real content is embedded inside a JS string:

    document.getElementById(...).innerHTML = pageSanitizer.sanitize('<...>');

The string is JS-escaped (\\xNN hex escapes, \\/ , \\' , \\" , \\n , ...). This
module extracts that payload and unescapes it back into parseable HTML, so each
`services/<section>.py` can just BeautifulSoup the result.
"""
from __future__ import annotations

import re

# Matches each  pageSanitizer.sanitize('....')  call and captures the argument.
# The argument is single-quoted; real single quotes inside it are escaped as
# \x27, so a non-greedy match up to the first unescaped quote is safe.
_SANITIZE_CALL = re.compile(r"pageSanitizer\.sanitize\('(.*?)'\)", re.DOTALL)

# \xNN and \uNNNN numeric escapes.
_HEX_ESCAPE = re.compile(r"\\x([0-9A-Fa-f]{2})")
_UNI_ESCAPE = re.compile(r"\\u([0-9A-Fa-f]{4})")


class PageEmptyError(Exception):
    """The page loaded but carried no Creator content (e.g. the SPA shell)."""


def js_unescape(s: str) -> str:
    """Undo the JS string escaping used inside a sanitize('…') argument.

    Handles numeric \\xNN / \\uNNNN escapes, newline/tab escapes, and generic
    backslash-escaped punctuation (\\/ -> /, \\- -> -, \\' -> ', \\" -> ").
    Deliberately NOT Python's `unicode_escape` codec, which mis-decodes UTF-8
    bytes and produces mojibake.
    """
    s = _HEX_ESCAPE.sub(lambda m: chr(int(m.group(1), 16)), s)
    s = _UNI_ESCAPE.sub(lambda m: chr(int(m.group(1), 16)), s)
    s = s.replace("\\n", "\n").replace("\\t", "\t").replace("\\r", "")
    # Any remaining `\X` -> `X` (covers \/, \-, \', \", \\ ...).
    s = re.sub(r"\\(.)", r"\1", s)
    return s


def extract_page_html(raw: str) -> str:
    """Return the unescaped inner HTML from a Creator page response.

    Concatenates every pageSanitizer.sanitize('…') block found (a page can have
    more than one). Raises PageEmptyError if none are present — which is what a
    bare SPA shell / an error page looks like.
    """
    blocks = _SANITIZE_CALL.findall(raw)
    if not blocks:
        raise PageEmptyError(
            "No pageSanitizer content — got the SPA shell or an error page, "
            "not a rendered Creator page."
        )
    return "\n".join(js_unescape(b) for b in blocks)
