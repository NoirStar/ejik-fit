from pathlib import Path

from ejikfit.connectors.greeting import discover_openings, parse_opening


FIXTURES = Path(__file__).parents[3] / "tests" / "fixtures" / "greeting"


def test_discovers_greeting_opening_urls() -> None:
    html = (FIXTURES / "list.html").read_text()
    refs = discover_openings(
        html,
        "https://sample.career.greetinghr.com/ko",
    )

    assert [(ref.external_id, ref.url) for ref in refs] == [
        ("209187", "https://sample.career.greetinghr.com/ko/o/209187"),
        ("205581", "https://sample.career.greetinghr.com/ko/o/205581"),
    ]


def test_parses_greeting_opening_with_mixed_career() -> None:
    html = (FIXTURES / "opening.html").read_text()
    opening = parse_opening(
        html,
        "https://sample.career.greetinghr.com/ko/o/209187",
    )

    assert opening.external_id == "209187"
    assert opening.title == "Backend Engineer"
    assert opening.status == "open"
    assert opening.career_type == "mixed"
    assert opening.career_min == 1
    assert opening.career_max == 3
    assert opening.employment_type == "FULL_TIME_WORKER"
    assert opening.location == "서울특별시"
    assert "Python" in opening.description_text


def test_normalizes_greeting_newcomer_for_api_filter() -> None:
    html = (FIXTURES / "opening.html").read_text().replace(
        '"EXPERIENCED"',
        '"NEW_COMER"',
    )

    opening = parse_opening(
        html,
        "https://sample.career.greetinghr.com/ko/o/209187",
    )

    assert opening.career_type == "new_comer"
