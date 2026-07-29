import pytest

from ejikfit.posting_recommendations import recommendation_window


def test_recommendation_window_uses_four_matches_then_one_exploration() -> None:
    window = recommendation_window(
        matched_total=12,
        exploration_total=4,
        offset=0,
        limit=10,
    )

    assert window.pattern == (
        "matched",
        "matched",
        "matched",
        "matched",
        "explore",
        "matched",
        "matched",
        "matched",
        "matched",
        "explore",
    )
    assert window.matched_offset == 0
    assert window.exploration_offset == 0


def test_recommendation_window_starts_each_stream_at_the_page_offset() -> None:
    window = recommendation_window(
        matched_total=20,
        exploration_total=10,
        offset=3,
        limit=4,
    )

    assert window.pattern == (
        "matched",
        "explore",
        "matched",
        "matched",
    )
    assert window.matched_offset == 3
    assert window.exploration_offset == 0


def test_recommendation_window_backfills_after_matched_stream_exhaustion() -> None:
    window = recommendation_window(
        matched_total=2,
        exploration_total=5,
        offset=0,
        limit=7,
    )

    assert window.pattern == (
        "matched",
        "matched",
        "explore",
        "explore",
        "explore",
        "explore",
        "explore",
    )


def test_recommendation_window_backfills_after_exploration_exhaustion() -> None:
    window = recommendation_window(
        matched_total=7,
        exploration_total=1,
        offset=0,
        limit=8,
    )

    assert window.pattern == (
        "matched",
        "matched",
        "matched",
        "matched",
        "explore",
        "matched",
        "matched",
        "matched",
    )


def test_adjacent_recommendation_windows_equal_one_larger_window() -> None:
    first = recommendation_window(11, 4, offset=0, limit=6)
    second = recommendation_window(11, 4, offset=6, limit=6)
    combined = recommendation_window(11, 4, offset=0, limit=12)

    assert first.pattern + second.pattern == combined.pattern
    assert second.matched_offset == first.pattern.count("matched")
    assert second.exploration_offset == first.pattern.count("explore")


def test_recommendation_window_handles_empty_and_zero_length_windows() -> None:
    empty = recommendation_window(0, 0, offset=0, limit=20)
    zero_limit = recommendation_window(3, 2, offset=2, limit=0)

    assert empty.pattern == ()
    assert zero_limit.pattern == ()
    assert zero_limit.matched_offset == 2
    assert zero_limit.exploration_offset == 0


@pytest.mark.parametrize(
    ("matched_total", "exploration_total", "offset", "limit"),
    [(-1, 0, 0, 1), (0, -1, 0, 1), (0, 0, -1, 1), (0, 0, 0, -1)],
)
def test_recommendation_window_rejects_negative_values(
    matched_total: int,
    exploration_total: int,
    offset: int,
    limit: int,
) -> None:
    with pytest.raises(ValueError):
        recommendation_window(
            matched_total,
            exploration_total,
            offset=offset,
            limit=limit,
        )
