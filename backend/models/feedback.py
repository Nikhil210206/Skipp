"""Request schema for student feedback.

This is the one payload in the whole app that a student writes themselves and
sends deliberately, so unlike everything else here it carries an identity: who
said it and which section they are in, because feedback nobody can follow up
on is half a message. The student types none of that (the app fills it in from
the snapshot it already holds) and the sheet says so before they send.

It carries no password, so it spends no portal sign-in and cannot be used
against anyone's daily cap.

JSON is camelCase (aliases) so the frontend types mirror it directly.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


#: What the message is about, chosen by the student.
FeedbackKind = Literal["bug", "idea", "other"]


class FeedbackRequest(_CamelModel):
    """One thing a student wanted to say."""

    rating: int = Field(ge=1, le=5, description="stars, 1 to 5")
    kind: FeedbackKind = "other"
    # Bounded here as well as in the UI. This field is the only place a
    # stranger can put arbitrary text into a message addressed to a person, and
    # Discord refuses an embed description over 4096 characters outright, so an
    # unbounded one would fail delivery rather than merely being long.
    message: str = Field("", max_length=2000)

    # Identity, filled in by the app rather than typed.
    name: str | None = Field(None, max_length=120)
    section: str | None = Field(None, max_length=40)
    registration_number: str | None = Field(None, max_length=40)
    program: str | None = Field(None, max_length=120)
    semester: str | None = Field(None, max_length=40)

    # What they were looking at when they said it, which is most of the useful
    # context in a bug report and costs the student nothing.
    theme: str | None = Field(None, max_length=40)
    installed: bool | None = Field(None, description="running as an installed PWA")
