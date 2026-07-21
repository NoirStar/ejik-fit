import json

from ejikfit.connectors.atlassian import parse_atlassian_korea_technical_openings


def test_atlassian_parser_keeps_korean_technical_role_with_full_description() -> None:
    payload = [
        {
            "portalJobPost": {
                "id": 25402,
                "portalUrl": (
                    "https://careers-apac-atlassian.icims.com/jobs/25402/"
                    "senior-solutions-engineer---south-korea/job"
                ),
                "updatedDate": "2026-06-30 08:17 PM",
            },
            "id": 25402,
            "title": "Senior Solutions Engineer - South Korea",
            "locations": [
                "Seoul - South Korea - Korea, South",
                "Remote - Remote",
            ],
            "category": "Sales",
            "overview": "<p>Advise enterprise technical teams.</p>",
            "responsibilities": "<ul><li>Own the technical engagement.</li></ul>",
            "qualifications": "<ul><li>DevOps solution experience.</li></ul>",
            "applyUrl": (
                "https://careers-apac-atlassian.icims.com/jobs/25402/"
                "senior-solutions-engineer---south-korea/job?mode=apply"
            ),
        },
        {
            "id": 25555,
            "title": "Software Engineer",
            "locations": ["Sydney - Australia"],
            "overview": "<p>Build cloud software.</p>",
            "applyUrl": "https://careers-atlassian.icims.com/jobs/25555/job",
        },
        {
            "id": 25556,
            "title": "Account Executive - South Korea",
            "locations": ["Seoul - South Korea"],
            "overview": "<p>Enterprise sales.</p>",
            "applyUrl": "https://careers-atlassian.icims.com/jobs/25556/job",
        },
    ]

    openings = parse_atlassian_korea_technical_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://www.atlassian.com/endpoint/careers/listings",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "25402"
    assert opening.title == "Senior Solutions Engineer - South Korea"
    assert opening.location == (
        "Seoul - South Korea - Korea, South, Remote - Remote"
    )
    assert opening.url.endswith(
        "/senior-solutions-engineer---south-korea/job?mode=apply"
    )
    assert "Advise enterprise technical teams" in opening.description_text
    assert "Own the technical engagement" in opening.description_text
    assert "DevOps solution experience" in opening.description_text
    assert "<h2>Responsibilities</h2>" in opening.description_html


def test_atlassian_parser_accepts_a_valid_empty_root_array() -> None:
    assert parse_atlassian_korea_technical_openings(
        "[]",
        "https://www.atlassian.com/endpoint/careers/listings",
    ) == []


def test_atlassian_parser_rejects_non_array_payload() -> None:
    try:
        parse_atlassian_korea_technical_openings(
            '{"error":"maintenance"}',
            "https://www.atlassian.com/endpoint/careers/listings",
        )
    except ValueError as error:
        assert "array" in str(error)
    else:
        raise AssertionError("invalid Atlassian payload must be rejected")
