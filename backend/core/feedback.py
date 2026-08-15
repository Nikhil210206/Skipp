"""Delivering student feedback to wherever the maintainer actually reads it.

Today that is a Discord webhook, named in `SKIPP_FEEDBACK_WEBHOOK`. The
destination is deliberately a message rather than a table: this backend has no
database and section 3 says it must not grow one, so feedback is forwarded and
then forgotten by this process. The record lives in a Discord channel, which is
somewhere a person reads rather than somewhere student data accumulates.

If the webhook is not configured the route says so as a typed error, instead of
accepting a message and dropping it, which would be the worst possible
behaviour for a feature whose whole promise is that somebody will see it.
"""
from __future__ import annotations

import os

import httpx

from models.feedback import FeedbackRequest

#: Where to post. Unset means the feature is off (see FeedbackNotConfigured).
WEBHOOK_ENV = "SKIPP_FEEDBACK_WEBHOOK"

#: A webhook post is a single small request; it must never sit on a function.
_TIMEOUT = 10.0


class FeedbackNotConfigured(RuntimeError):
    """No webhook set, so there is nowhere to send this."""


class FeedbackDeliveryFailed(RuntimeError):
    """The webhook refused or could not be reached."""


#: The app's own state colours, so a verdict reads the same in Discord as it
#: does on the attendance screen: red is trouble, amber is borderline, green is
#: fine. Triage happens by glance before anything is read.
_COLOURS = {1: 0xE2584F, 2: 0xE2584F, 3: 0xCF9B34, 4: 0x4FA97B, 5: 0x4FA97B}

_TITLES = {"bug": "Bug", "idea": "Idea", "other": "Feedback"}


def deliver(req: FeedbackRequest, user_agent: str | None = None) -> None:
    """Post one piece of feedback to the webhook.

    Raises `FeedbackNotConfigured` or `FeedbackDeliveryFailed`; returns nothing
    on success. Nothing is written to disk or logged here.
    """
    url = os.environ.get(WEBHOOK_ENV, "").strip()
    if not url:
        raise FeedbackNotConfigured(f"{WEBHOOK_ENV} is not set")

    who = " · ".join(
        p for p in (req.name, req.section, req.registration_number) if p
    )
    where = " · ".join(
        p
        for p in (
            req.program,
            f"Semester {req.semester}" if req.semester else None,
            f"{req.theme} theme" if req.theme else None,
            "installed" if req.installed else "browser",
        )
        if p
    )

    fields = [
        {"name": "Rating", "value": f"{req.rating} of 5", "inline": True},
        # A field value may not be empty, and an unsigned-in caller could leave
        # every identity field null, so both of these need a fallback.
        {"name": "From", "value": who or "not identified", "inline": True},
    ]
    if where:
        fields.append({"name": "Context", "value": where, "inline": False})
    if user_agent:
        fields.append({"name": "Device", "value": user_agent[:1024], "inline": False})

    payload = {
        "username": "Skipp feedback",
        # Nobody gets pinged by something a stranger typed into a text box.
        # Without this an "@everyone" in a message would be honoured by the
        # webhook, since webhooks carry that permission by default.
        "allowed_mentions": {"parse": []},
        "embeds": [
            {
                "title": _TITLES.get(req.kind, "Feedback"),
                "description": req.message.strip() or "(rating only, no message)",
                "color": _COLOURS.get(req.rating, 0x9D9DA7),
                "fields": fields,
            }
        ],
    }

    try:
        res = httpx.post(url, json=payload, timeout=_TIMEOUT)
    except httpx.HTTPError as e:
        raise FeedbackDeliveryFailed(f"webhook unreachable: {e}") from e
    if res.status_code >= 400:
        # The body can echo the webhook URL back, so only the status is kept:
        # the URL is a credential, anyone holding it can post to the channel.
        raise FeedbackDeliveryFailed(f"webhook returned {res.status_code}")
