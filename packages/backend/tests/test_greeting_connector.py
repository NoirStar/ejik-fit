import json
from pathlib import Path

from ejikfit.connectors.greeting import (
    discover_corporate_greeting_openings,
    discover_openings,
    parse_opening,
)


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


def test_discovers_only_technical_roles_when_source_requests_it() -> None:
    html = (FIXTURES / "list.html").read_text().replace(
        '{"openingId": 205581, "title": "Security Engineer"}',
        (
            '{"openingId": 205581, "title": "Security Engineer"},'
            '{"openingId": 205582, "title": "Brand Marketing Manager"},'
            '{"openingId": 205583, "title": '
            '"Program Manager (Commerce Platform)"}'
        ),
    )

    refs = discover_openings(
        html,
        "https://sample.career.greetinghr.com/ko",
        technical_only=True,
    )

    assert [ref.external_id for ref in refs] == ["209187", "205581"]


def test_discovers_complete_technical_greeting_links_from_corporate_next_data() -> None:
    next_data = {
        "props": {
            "pageProps": {
                "codeList": {
                    "jobGroup": {
                        "jsonResult": {
                            "data": [
                                {"code": "JG01", "code_name": "개발/데이터"},
                                {"code": "JG06", "code_name": "홍보/마케팅"},
                            ]
                        }
                    }
                },
                "jobList": {
                    "statusCode": 200,
                    "jsonResult": {
                        "metaData": {"totalCount": "3"},
                        "data": [
                            {
                                "title": "Platform Engineer (DBA)",
                                "job_group_code": "JG01",
                                "notice_url": (
                                    "https://socar.career.greetinghr.com/ko/o/225577"
                                ),
                            },
                            {
                                "title": "Applied Research Scientist",
                                "job_group_code": "JG01",
                                "notice_url": (
                                    "https://socar.career.greetinghr.com/ko/o/225579"
                                ),
                            },
                            {
                                "title": "브랜드 커뮤니케이션 매니저",
                                "job_group_code": "JG06",
                                "notice_url": (
                                    "https://socar.career.greetinghr.com/ko/o/227529"
                                ),
                            },
                        ],
                    },
                },
            }
        }
    }
    html = (
        '<script id="__NEXT_DATA__" type="application/json">'
        f"{json.dumps(next_data, ensure_ascii=False)}"
        "</script>"
    )

    refs = discover_corporate_greeting_openings(
        html,
        "https://www.socarcorp.kr/careers/jobs",
        technical_only=True,
    )

    assert [(ref.external_id, ref.title) for ref in refs] == [
        ("225577", "Platform Engineer (DBA)"),
        ("225579", "Applied Research Scientist"),
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
    assert opening.description_text == "## 자격 요건\nPython과 API 개발 경험"


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
