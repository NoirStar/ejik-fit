import json

from ejikfit.connectors.lablup import (
    parse_lablup_detail_opening,
    parse_lablup_listing_openings,
)


def _next_html(page_props: dict[str, object]) -> str:
    payload = json.dumps(
        {"props": {"pageProps": page_props}},
        ensure_ascii=False,
    )
    return (
        '<script id="__NEXT_DATA__" type="application/json">'
        f"{payload}</script>"
    )


def test_lablup_listing_maps_complete_official_positions() -> None:
    html = _next_html(
        {
            "locale": "ko",
            "positions": {
                "meta": {"total": 3, "sliceNumber": 20},
                "contents": [
                    {
                        "id": 173,
                        "title": "백엔드 소프트웨어 엔지니어 (시니어)",
                        "positionId": "senior-CORE-software-engineer",
                        "experienced": {"id": "경력", "name": "경력"},
                        "category": {
                            "id": 24,
                            "name": "코어 & 백엔드 엔지니어",
                            "categoryId": "CORE",
                        },
                    },
                    {
                        "id": 115,
                        "title": "솔루션 엔지니어",
                        "positionId": "junior-SOLUTION-solution-engineer",
                        "experienced": {"id": "신입", "name": "신입"},
                        "category": {
                            "id": 32,
                            "name": "솔루션 (플랫폼 & 컨설턴트)",
                            "categoryId": "SOLUTION",
                        },
                    },
                    {
                        "id": 999,
                        "title": "프로덕트 매니저",
                        "positionId": "senior-PRODUCT-product-manager",
                        "experienced": {"id": "경력", "name": "경력"},
                        "category": {
                            "id": 27,
                            "name": "프로덕트 매니저",
                            "categoryId": "PRODUCT",
                        },
                    },
                ],
            },
        }
    )

    openings = parse_lablup_listing_openings(
        html,
        "https://www.lablup.com/ko/careers",
    )

    assert [opening.external_id for opening in openings] == [
        "senior-CORE-software-engineer",
        "junior-SOLUTION-solution-engineer",
    ]
    assert openings[0].url == (
        "https://www.lablup.com/ko/careers/"
        "senior-CORE-software-engineer"
    )
    assert openings[0].career_type == "experienced"
    assert openings[1].career_type == "new_comer"


def test_lablup_detail_keeps_full_skill_evidence() -> None:
    listing = parse_lablup_listing_openings(
        _next_html(
            {
                "locale": "ko",
                "positions": {
                    "meta": {"total": 1, "sliceNumber": 20},
                    "contents": [
                        {
                            "id": 173,
                            "title": "백엔드 소프트웨어 엔지니어 (시니어)",
                            "positionId": "senior-CORE-software-engineer",
                            "experienced": {"id": "경력", "name": "경력"},
                            "category": {
                                "id": 24,
                                "name": "코어 & 백엔드 엔지니어",
                                "categoryId": "CORE",
                            },
                        }
                    ],
                },
            }
        ),
        "https://www.lablup.com/ko/careers",
    )[0]
    detail_html = _next_html(
        {
            "locale": "ko",
            "positionDetail": {
                "id": 173,
                "positionId": "senior-CORE-software-engineer",
                "title": "백엔드 소프트웨어 엔지니어 (시니어)",
                "experienced": {"id": "senior", "name": "경력"},
                "category": {
                    "id": 24,
                    "categoryId": "CORE",
                    "name": "코어 & 백엔드 엔지니어",
                },
                "jobDescriptions": [
                    {
                        "id": 1,
                        "title": "주요 업무",
                        "body": "Python 기반 분산 스케줄러와 모델 서빙 프록시를 개발합니다.",
                    },
                    {
                        "id": 2,
                        "title": "자격 요건",
                        "body": "백엔드 개발 경력 3년 이상, Linux 시스템 프로그래밍 경험",
                    },
                    {
                        "id": 3,
                        "title": "우대 사항",
                        "body": "Kubernetes 생태계 개발 경험",
                    },
                ],
                "formUrl": "https://tally.so/r/example",
                "datePosted": "2026-06-05T04:54:50.627Z",
            },
        }
    )

    opening = parse_lablup_detail_opening(
        detail_html,
        listing.url,
        listing,
    )

    assert opening.external_id == listing.external_id
    assert opening.status == "open"
    assert opening.career_type == "experienced"
    assert opening.career_min == 3
    assert opening.opens_at is not None
    assert "Python 기반 분산 스케줄러" in opening.description_text
    assert "Kubernetes 생태계" in opening.description_text
