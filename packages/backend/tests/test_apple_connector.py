import json

from ejikfit.connectors.apple import (
    parse_apple_detail_opening,
    parse_apple_listing_openings,
    parse_apple_search_page,
)


def _hydration_html(loader_data: dict[str, object]) -> str:
    payload = json.dumps({"loaderData": loader_data}, ensure_ascii=False)
    encoded_payload = json.dumps(payload, ensure_ascii=False)
    return (
        "<html><script>window.__staticRouterHydrationData = "
        f"JSON.parse({encoded_payload})</script></html>"
    )


def test_parse_apple_search_page_reads_total_and_results() -> None:
    rows = [
        {
            "id": "200670285-3631",
            "positionId": "200670285",
            "postingTitle": "Senior Data Engineer & Scientist — Apple Korea",
            "transformedPostingTitle": (
                "senior-data-engineer-scientist-apple-korea"
            ),
            "locations": [{"name": "Seoul", "countryName": "Korea"}],
            "team": {"teamCode": "SFTWR"},
        }
    ]

    parsed_rows, total = parse_apple_search_page(
        _hydration_html(
            {
                "search": {
                    "searchResults": rows,
                    "totalRecords": 21,
                }
            }
        )
    )

    assert total == 21
    assert parsed_rows == rows


def test_parse_apple_listing_openings_builds_official_detail_urls() -> None:
    payload = {
        "total": 1,
        "jobs": [
            {
                "id": "200670285-3631",
                "positionId": "200670285",
                "postingTitle": (
                    "Senior Data Engineer & Scientist — Apple Korea"
                ),
                "transformedPostingTitle": (
                    "senior-data-engineer-scientist-apple-korea"
                ),
                "jobSummary": "Build data systems with Python and SQL.",
                "postDateInGMT": "2026-06-29T08:30:49.915+00:00",
                "locations": [
                    {
                        "name": "Seoul",
                        "countryName": "Korea (Republic of)",
                    }
                ],
                "team": {"teamCode": "SFTWR"},
                "postExternal": True,
            }
        ],
    }

    openings = parse_apple_listing_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://jobs.apple.com/en-us/search?location=korea-republic-of-KOR",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "200670285-3631"
    assert opening.url == (
        "https://jobs.apple.com/en-us/details/200670285-3631/"
        "senior-data-engineer-scientist-apple-korea?team=SFTWR"
    )
    assert opening.location == "Seoul · Korea (Republic of)"
    assert opening.opens_at is not None


def test_parse_apple_detail_opening_maps_full_qualifications() -> None:
    detail_url = (
        "https://jobs.apple.com/en-us/details/200670285-3631/"
        "senior-data-engineer-scientist-apple-korea?team=SFTWR"
    )
    html = _hydration_html(
        {
            "jobDetails": {
                "jobsData": {
                    "jobNumber": "200670285-3631",
                    "postingTitle": (
                        "Senior Data Engineer & Scientist — Apple Korea"
                    ),
                    "jobSummary": "Build the data foundation for Apple Korea.",
                    "description": "Own the full data lifecycle.",
                    "responsibilities": "Build data pipelines\nRun experiments",
                    "minimumQualifications": (
                        "5+ years of relevant experience\n"
                        "Proficiency in Python and SQL"
                    ),
                    "preferredQualifications": (
                        "2+ years with Snowflake and machine learning"
                    ),
                    "teamNames": ["Software and Services"],
                    "selectedLocation": {
                        "name": "서울",
                        "countryName": "대한민국",
                    },
                    "employmentType": "Standard",
                    "postDateInGMT": "2026-06-29T08:30:49.915+00:00",
                }
            }
        }
    )

    opening = parse_apple_detail_opening(html, detail_url)

    assert opening.external_id == "200670285-3631"
    assert opening.title == "Senior Data Engineer & Scientist — Apple Korea"
    assert opening.employment_type == "정규직"
    assert opening.career_type == "경력"
    assert opening.career_min == 5
    assert opening.location == "서울 · 대한민국"
    assert "Python and SQL" in opening.description_text
    assert "Snowflake and machine learning" in opening.description_text
    assert "<h2>Minimum qualifications</h2>" in opening.description_html


def test_parse_apple_hydration_rejects_missing_payload() -> None:
    try:
        parse_apple_search_page("<html>No Apple data</html>")
    except ValueError as error:
        assert str(error) == "Apple page is missing hydration data"
    else:
        raise AssertionError("missing hydration data must fail closed")
