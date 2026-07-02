from ejikfit.crawler import next_missing_state
from ejikfit.models import PostingStatus


def test_failed_listing_never_advances_missing_counter() -> None:
    assert next_missing_state(
        2,
        successful_listing=False,
        seen=False,
    ) == (2, PostingStatus.OPEN)


def test_three_successful_absences_close_posting() -> None:
    assert next_missing_state(
        0,
        successful_listing=True,
        seen=False,
    ) == (1, PostingStatus.OPEN)
    assert next_missing_state(
        1,
        successful_listing=True,
        seen=False,
    ) == (2, PostingStatus.OPEN)
    assert next_missing_state(
        2,
        successful_listing=True,
        seen=False,
    ) == (3, PostingStatus.CLOSED)


def test_seen_posting_resets_counter() -> None:
    assert next_missing_state(
        2,
        successful_listing=True,
        seen=True,
    ) == (0, PostingStatus.OPEN)
