import json

from ejikfit.connectors.liner import (
    parse_liner_detail_opening,
    parse_liner_listing_openings,
)


def _next_html(query_key: list[str], data: object) -> str:
    payload = json.dumps(
        {
            "props": {
                "pageProps": {
                    "dehydratedState": {
                        "queries": [
                            {
                                "queryKey": query_key,
                                "state": {"data": data},
                            }
                        ]
                    }
                }
            }
        },
        ensure_ascii=False,
    )
    return (
        '<script id="__NEXT_DATA__" type="application/json">'
        f"{payload}</script>"
    )


def _position(
    *,
    field: str = "Engineering",
    career_type: str = "EXPERIENCED",
    career_from: int | None = 3,
    career_to: int | None = None,
) -> dict[str, object]:
    return {
        "jobPositionField": {"field": field},
        "jobPositionOccupation": {"occupation": field},
        "jobPositionPlace": {
            "location": "Seoul",
            "place": "서울특별시 마포구 양화로",
            "detailPlace": "140, 8층",
        },
        "jobPositionEmployment": {"employment": "FULL_TIME_WORKER"},
        "jobPositionCareer": {
            "careerFrom": career_from,
            "careerTo": career_to,
            "careerType": career_type,
        },
    }


def test_liner_listing_keeps_only_active_technical_openings() -> None:
    html = _next_html(
        ["careers", "getOpenings"],
        [
            {
                "id": 187408,
                "title": "Data Engineer",
                "dueDate": None,
                "activatedAtCareerPage": True,
                "openingJobPositionInfo": {
                    "openingJobPositions": [
                        _position(field="Data", career_from=5)
                    ]
                },
            },
            {
                "id": 116653,
                "title": "AI Product Manager",
                "dueDate": None,
                "activatedAtCareerPage": True,
                "openingJobPositionInfo": {
                    "openingJobPositions": [_position(field="Product")]
                },
            },
            {
                "id": 228090,
                "title": "Security Engineer",
                "dueDate": "2026-08-31T14:59:59Z",
                "activatedAtCareerPage": False,
                "openingJobPositionInfo": {
                    "openingJobPositions": [_position()]
                },
            },
        ],
    )

    openings = parse_liner_listing_openings(
        html,
        "https://liner.com/careers/jobs",
    )

    assert [opening.external_id for opening in openings] == ["187408"]
    assert openings[0].url == "https://liner.com/careers/jobs/187408"
    assert openings[0].description_text == "Data"
    assert openings[0].career_type == "experienced"
    assert openings[0].career_min == 5
    assert openings[0].employment_type == "FULL_TIME_WORKER"
    assert openings[0].location == "서울특별시 마포구 양화로 140, 8층"


def test_liner_detail_keeps_official_url_and_full_skill_evidence() -> None:
    listing = parse_liner_listing_openings(
        _next_html(
            ["careers", "getOpenings"],
            [
                {
                    "id": 187408,
                    "title": "Data Engineer",
                    "dueDate": None,
                    "activatedAtCareerPage": True,
                    "openingJobPositionInfo": {
                        "openingJobPositions": [
                            _position(field="Data", career_from=5)
                        ]
                    },
                }
            ],
        ),
        "https://liner.com/careers/jobs",
    )[0]
    detail_html = _next_html(
        ["careers", "getOpeningDetail", "187408"],
        {
            "openingInfo": {
                "openingId": 187408,
                "title": "Data Engineer",
                "detail": (
                    "<h3>이런 분을 찾고 있어요</h3>"
                    "<ul><li>Airflow와 Spark 기반 데이터 파이프라인 "
                    "경험</li>"
                    "<li>Python과 SQL 활용 경험</li></ul>"
                ),
                "openDate": "2025-11-11T02:36:34Z",
                "dueDate": None,
                "deploy": True,
            },
            "openingJobPositionInfo": {
                "openingJobPositions": [
                    _position(field="Data", career_from=5)
                ]
            },
        },
    )

    opening = parse_liner_detail_opening(
        detail_html,
        listing.url,
        listing,
    )

    assert opening.external_id == listing.external_id
    assert opening.url == "https://liner.com/careers/jobs/187408"
    assert opening.title == listing.title
    assert opening.status == "open"
    assert opening.career_type == "experienced"
    assert opening.career_min == 5
    assert opening.opens_at is not None
    assert "Airflow와 Spark" in opening.description_text
    assert "Python과 SQL" in opening.description_text
