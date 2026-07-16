import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from ejikfit.connectors.nexon import (
    NEXON_RECRUIT_URL,
    combine_nexon_pages,
    filter_nexon_payload,
    nexon_request_body,
    parse_nexon_openings,
    parse_nexon_page,
)


CORPORATIONS = [
    {"corpCode": "NX", "corpName": "넥슨코리아"},
    {"corpCode": "NO", "corpName": "네오플"},
]


def _job(
    job_id: int,
    *,
    corporation: str = "넥슨코리아",
    title: str = "[넥슨] 백엔드 엔지니어",
    career: str = "경력",
    employment: str = "정규직",
) -> dict[str, object]:
    return {
        "corpName": corporation,
        "logoImgUrl": "https://careers.nexon.com/files/logo/company-logo.png",
        "jobPostNo": job_id,
        "title": title,
        "contents": "<h2>주요 업무</h2><p>Python API를 개발합니다.</p>",
        "recruitType": {"code": "10", "description": "일반"},
        "startDate": "2026.07.16",
        "recruitEndDate": "2026-08-01T03:00:00.000Z",
        "endDate": "2026.08.01",
        "careerType": {"code": "20", "description": career},
        "employmentType": {"code": "10", "description": employment},
        "workingArea": "판교",
        "applicationType": {
            "code": "N",
            "description": "일반지원서",
            "poolType": False,
            "myResumeType": False,
            "normalType": True,
        },
        "dday": "D-16",
    }


def _payload(
    *,
    page: int,
    total: int,
    jobs: list[dict[str, object]],
    size: int = 2,
) -> dict[str, object]:
    return {
        "list": jobs,
        "pagination": {"page": page, "size": size, "total": total},
    }


def test_nexon_request_body_matches_the_public_careers_application() -> None:
    assert nexon_request_body(page=2) == {
        "corpCodes": [],
        "jobCategories": [],
        "careerTypes": [],
        "employmentTypes": [],
        "workingAreas": [],
        "query": None,
        "page": 2,
        "size": 15,
    }


def test_combine_nexon_pages_requires_a_complete_unique_listing() -> None:
    first = parse_nexon_page(
        _payload(page=1, total=3, jobs=[_job(100), _job(101)])
    )
    second = parse_nexon_page(
        _payload(
            page=2,
            total=3,
            jobs=[_job(102, corporation="네오플")],
        )
    )

    combined = combine_nexon_pages([first, second], CORPORATIONS)

    assert combined["pagination"] == {"page": 1, "size": 3, "total": 3}
    assert [row["jobPostNo"] for row in combined["list"]] == [100, 101, 102]
    assert combined["corporations"] == CORPORATIONS


@pytest.mark.parametrize(
    ("pages", "message"),
    [
        (
            [
                _payload(page=1, total=2, jobs=[_job(100)]),
                _payload(page=2, total=2, jobs=[_job(100)]),
            ],
            "duplicate",
        ),
        (
            [
                _payload(page=1, total=3, jobs=[_job(100)]),
                _payload(page=2, total=2, jobs=[_job(101)]),
            ],
            "total changed",
        ),
        (
            [_payload(page=1, total=2, jobs=[_job(100)])],
            "incomplete",
        ),
    ],
)
def test_combine_nexon_pages_rejects_unsafe_pagination(
    pages: list[dict[str, object]],
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        combine_nexon_pages(
            [parse_nexon_page(page) for page in pages],
            CORPORATIONS,
        )


def test_combine_nexon_pages_rejects_an_unregistered_job_corporation() -> None:
    page = parse_nexon_page(
        _payload(
            page=1,
            total=1,
            jobs=[_job(100, corporation="새로운 넥슨 계열사")],
        )
    )

    with pytest.raises(ValueError, match="unknown corporation"):
        combine_nexon_pages([page], CORPORATIONS)


def test_filter_nexon_payload_supports_a_known_company_with_no_current_jobs() -> None:
    combined = combine_nexon_pages(
        [parse_nexon_page(_payload(page=1, total=1, jobs=[_job(100)]))],
        CORPORATIONS,
    )

    filtered = json.loads(
        filter_nexon_payload(json.dumps(combined, ensure_ascii=False), "네오플")
    )

    assert filtered["list"] == []
    assert filtered["pagination"] == {"page": 1, "size": 0, "total": 0}

    with pytest.raises(ValueError, match="unknown corporation"):
        filter_nexon_payload(
            json.dumps(combined, ensure_ascii=False),
            "등록되지 않은 회사",
        )


def test_parse_nexon_openings_preserves_official_job_fields() -> None:
    job = _job(
        102,
        corporation="네오플",
        title="[던전앤파이터] AI 백엔드 엔지니어",
        career="경력무관",
        employment="계약직",
    )
    combined = combine_nexon_pages(
        [parse_nexon_page(_payload(page=1, total=1, jobs=[job]))],
        CORPORATIONS,
    )
    filtered = filter_nexon_payload(
        json.dumps(combined, ensure_ascii=False),
        "네오플",
    )

    openings = parse_nexon_openings(filtered, NEXON_RECRUIT_URL)

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "102"
    assert opening.url == "https://careers.nexon.com/recruit/102"
    assert opening.title == "[던전앤파이터] AI 백엔드 엔지니어"
    assert opening.description_html == job["contents"]
    assert opening.description_text == "## 주요 업무\nPython API를 개발합니다."
    assert opening.employment_type == "contract"
    assert opening.career_type == "mixed"
    assert opening.location == "판교"
    assert opening.opens_at == datetime(
        2026,
        7,
        16,
        tzinfo=ZoneInfo("Asia/Seoul"),
    )
    assert opening.closes_at == datetime(2026, 8, 1, 3, tzinfo=timezone.utc)


def test_parse_nexon_page_rejects_a_job_without_required_fields() -> None:
    job = _job(100)
    del job["title"]

    with pytest.raises(ValueError, match="title"):
        parse_nexon_page(_payload(page=1, total=1, jobs=[job]))
