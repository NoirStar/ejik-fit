from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


RecommendationStream = Literal["matched", "explore"]


@dataclass(frozen=True)
class RecommendationWindow:
    pattern: tuple[RecommendationStream, ...]
    matched_offset: int
    exploration_offset: int


def recommendation_window(
    matched_total: int,
    exploration_total: int,
    *,
    offset: int,
    limit: int,
) -> RecommendationWindow:
    """Plan one stable 4:1 personalized/exploration result window."""

    if min(matched_total, exploration_total, offset, limit) < 0:
        raise ValueError("recommendation window values must be non-negative")

    matched_used = 0
    exploration_used = 0
    matched_offset = 0
    exploration_offset = 0
    pattern: list[RecommendationStream] = []
    available_total = matched_total + exploration_total
    target = min(available_total, offset + limit)

    for position in range(target):
        preferred: RecommendationStream = (
            "explore" if position % 5 == 4 else "matched"
        )
        if preferred == "matched" and matched_used < matched_total:
            selected: RecommendationStream = "matched"
        elif preferred == "explore" and exploration_used < exploration_total:
            selected = "explore"
        elif matched_used < matched_total:
            selected = "matched"
        else:
            selected = "explore"

        if position < offset:
            if selected == "matched":
                matched_offset += 1
            else:
                exploration_offset += 1
        else:
            pattern.append(selected)

        if selected == "matched":
            matched_used += 1
        else:
            exploration_used += 1

    return RecommendationWindow(
        pattern=tuple(pattern),
        matched_offset=matched_offset,
        exploration_offset=exploration_offset,
    )
