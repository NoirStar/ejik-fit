import json

import pytest

from ejikfit.connectors.jibe import parse_jibe_korea_technical_openings


LISTING_URL = (
    "https://careers.amd.com/api/jobs?"
    "location=Korea%2C%20South&limit=100"
)


def test_jibe_parser_keeps_only_open_korea_engineering_jobs() -> None:
    payload = {
        "totalCount": 3,
        "jobs": [
            {
                "data": {
                    "slug": "87669",
                    "req_id": "87669",
                    "title": "Software Development Technology Engineer - Games",
                    "description": "Optimize games using C++, Vulkan, and GPU tooling.",
                    "full_location": "Seoul, Korea, South",
                    "country_code": "KR",
                    "categories": [{"name": "Engineering"}],
                    "employment_type": "FULL_TIME",
                    "posted_date": "2026-07-08T03:34:00+0000",
                    "posting_expiry_date": "2026-08-31T16:00:00+0000",
                    "searchable": True,
                    "applyable": True,
                    "meta_data": {
                        "canonical_url": (
                            "https://careers.amd.com/jobs/87669?lang=en-us"
                        )
                    },
                }
            },
            {
                "data": {
                    "req_id": "79860",
                    "title": "Senior Manager, AI Solutions Business Development",
                    "description": "Lead commercial partnerships.",
                    "full_location": "Seoul, Korea, South",
                    "country_code": "KR",
                    "categories": [{"name": "Sales / Marketing"}],
                    "searchable": True,
                    "applyable": True,
                }
            },
            {
                "data": {
                    "req_id": "closed-1",
                    "title": "Systems Engineer",
                    "country_code": "KR",
                    "categories": [{"name": "Engineering"}],
                    "searchable": False,
                    "applyable": False,
                }
            },
        ],
    }

    openings = parse_jibe_korea_technical_openings(
        json.dumps(payload),
        LISTING_URL,
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "87669"
    assert opening.url == "https://careers.amd.com/jobs/87669?lang=en-us"
    assert opening.employment_type == "정규직"
    assert opening.location == "Seoul, Korea, South"
    assert "C++" in opening.description_text
    assert opening.opens_at is not None
    assert opening.closes_at is not None


def test_jibe_parser_rejects_invalid_listing_envelope() -> None:
    with pytest.raises(ValueError, match="Jibe jobs response is invalid"):
        parse_jibe_korea_technical_openings(
            json.dumps({"totalCount": 0, "jobs": [{"data": {}}]}),
            LISTING_URL,
        )
