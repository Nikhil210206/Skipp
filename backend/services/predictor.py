"""Attendance bunk predictor — the math from CLAUDE.md §6.

Given classes attended (a) and conducted (c) and a target percentage T:

- can_skip:   most classes you can still miss and stay >= T.
              largest x with a / (c + x) >= T/100  ->  x = floor(a/(T/100) - c).
- must_attend: if already below T, fewest classes you must attend (in a row) to
              reach T.  smallest y with (a + y)/(c + y) >= T/100
              ->  y = ceil((T/100 * c - a) / (1 - T/100)).
"""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class Prediction:
    percentage: float
    can_skip: int
    must_attend: int
    is_safe: bool


def predict(attended: int, conducted: int, threshold: float = 75.0) -> Prediction:
    """Compute attendance % and the bunk/attend numbers for one subject."""
    if conducted <= 0:
        return Prediction(percentage=0.0, can_skip=0, must_attend=0, is_safe=True)

    pct = attended / conducted * 100
    t = threshold / 100
    is_safe = pct >= threshold

    if is_safe:
        can_skip = max(0, math.floor(attended / t - conducted)) if t > 0 else 0
        must_attend = 0
    else:
        can_skip = 0
        # (1 - t) == 0 only if threshold is 100%, where you can never recover a miss.
        must_attend = (
            math.ceil((t * conducted - attended) / (1 - t)) if t < 1 else -1
        )
        must_attend = max(0, must_attend)

    return Prediction(
        percentage=round(pct, 2),
        can_skip=can_skip,
        must_attend=must_attend,
        is_safe=is_safe,
    )
