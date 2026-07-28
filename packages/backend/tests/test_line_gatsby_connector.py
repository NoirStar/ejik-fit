import json

import pytest

from ejikfit.connectors.types import ParsedOpening


def test_parse_line_gatsby_openings_maps_public_page_data() -> None:
    from ejikfit.connectors.line_gatsby import parse_line_gatsby_openings

    payload = {
        "result": {
            "data": {
                "allStrapiJobs": {
                    "edges": [
                        {
                            "node": {
                                "strapiId": 2100,
                                "title": "Server Engineer, Messaging Platform",
                                "publish": True,
                                "is_public": True,
                                "is_filters_public": True,
                                "employment_type": [{"name": "Full-time"}],
                                "job_unit": [{"name": "Engineering"}],
                                "job_fields": [{"name": "Backend"}],
                                "companies": [{"name": "LINE Plus"}],
                                "cities": [{"name": "Seoul"}],
                                "regions": [{"name": "Korea"}],
                                "start_date": "2026-07-01",
                                "end_date": "2026-08-01",
                                "until_filled": False,
                            }
                        },
                        {
                            "node": {
                                "strapiId": 2200,
                                "title": "Private",
                                "publish": False,
                                "is_public": False,
                                "is_filters_public": False,
                            }
                        },
                    ]
                }
            }
        }
    }

    openings = parse_line_gatsby_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://careers.linecorp.com/page-data/jobs/page-data.json",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "2100"
    assert opening.url == "https://careers.linecorp.com/ko/jobs/2100"
    assert opening.title == "Server Engineer, Messaging Platform"
    assert opening.status == "open"
    assert opening.employment_type == "Full-time"
    assert opening.location == "Seoul, Korea"
    assert opening.description_text == "Engineering Backend LINE Plus Seoul Korea"
    assert opening.opens_at is not None
    assert opening.closes_at is not None


def _line_listing_opening() -> ParsedOpening:
    return ParsedOpening(
        external_id="2100",
        url="https://careers.linecorp.com/ko/jobs/2100",
        title="Server Engineer, Messaging Platform",
        status="open",
        description_html="",
        description_text="Engineering Backend LINE Plus Seoul Korea",
        employment_type="Full-time",
        career_type=None,
        career_min=None,
        career_max=None,
        location="Seoul, Korea",
        opens_at=None,
        closes_at=None,
    )


def _line_detail_payload(
    *,
    external_id: int = 2100,
    title: str = "Server Engineer, Messaging Platform",
    sparse: bool = False,
) -> str:
    content = "<p>Python</p>" if sparse else (
        "<h2>Team and Position</h2>"
        "<p>LINE 메시징 플랫폼의 대규모 트래픽을 처리하는 서버를 "
        "설계하고 안정적으로 운영하는 팀입니다.</p>"
        "<h2>Responsibilities</h2>"
        "<p>Java와 Kotlin 기반 분산 시스템을 개발하고 Kafka와 "
        "Kubernetes 환경의 성능과 신뢰성을 지속적으로 개선합니다.</p>"
        "<h2>Qualifications</h2>"
        "<p>서비스 장애를 분석하고 관측 가능성과 자동화된 테스트를 "
        "통해 운영 품질을 높인 경험이 필요합니다.</p>"
    )
    return json.dumps(
        {
            "result": {
                "data": {
                    "strapiJobs": {
                        "strapiId": external_id,
                        "title": title,
                        "content": content,
                    }
                }
            }
        },
        ensure_ascii=False,
    )


def test_parse_line_gatsby_detail_preserves_official_content() -> None:
    from ejikfit.connectors.line_gatsby import (
        parse_line_gatsby_detail_opening,
    )

    listing = _line_listing_opening()
    opening = parse_line_gatsby_detail_opening(
        _line_detail_payload(),
        (
            "https://careers.linecorp.com/page-data/ko/jobs/2100/"
            "page-data.json"
        ),
        listing,
    )

    assert opening.external_id == listing.external_id
    assert opening.url == listing.url
    assert "## Team and Position" in opening.description_text
    assert "## Responsibilities" in opening.description_text
    assert "Java와 Kotlin" in opening.description_text
    assert "Kafka와 Kubernetes" in opening.description_text
    assert "## Qualifications" in opening.description_text
    assert opening.employment_type == listing.employment_type
    assert opening.location == listing.location


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        (_line_detail_payload(external_id=9999), "identity"),
        (_line_detail_payload(title="Different job"), "title"),
        (_line_detail_payload(sparse=True), "sparse"),
    ],
)
def test_parse_line_gatsby_detail_rejects_untrusted_content(
    raw: str,
    message: str,
) -> None:
    from ejikfit.connectors.line_gatsby import (
        parse_line_gatsby_detail_opening,
    )

    listing = _line_listing_opening()
    with pytest.raises(ValueError, match=message):
        parse_line_gatsby_detail_opening(
            raw,
            (
                "https://careers.linecorp.com/page-data/ko/jobs/2100/"
                "page-data.json"
            ),
            listing,
        )
