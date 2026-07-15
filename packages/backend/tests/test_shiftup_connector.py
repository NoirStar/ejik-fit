import json

import pytest

from ejikfit.connectors.shiftup import parse_shiftup_openings


def test_parse_shiftup_openings_keeps_open_programmer_and_qa_roles() -> None:
    payload = json.dumps(
        {
            "result": "000",
            "list": [
                {
                    "idx": "466",
                    "subject": "Technical Artist (TA)",
                    "content": (
                        "<h3>자격 요건</h3>"
                        "<p>Unreal Engine 5와 Python 자동화 경험</p>"
                    ),
                    "addinfo4": "3년 이상",
                    "addinfo5": "정규직",
                    "addinfo6": (
                        "https://career.shiftup.co.kr/ko/o/227131/apply"
                    ),
                    "addinfo7": "Programmer",
                    "status": "1",
                    "wdate": "1783088702",
                },
                {
                    "idx": "454",
                    "subject": "전투 QA",
                    "content": "<p>게임 기능 및 회귀 테스트</p>",
                    "addinfo4": "2년 이하",
                    "addinfo5": "계약직",
                    "addinfo6": "https://career.shiftup.co.kr/o/224782/apply",
                    "addinfo7": "QA",
                    "status": 1,
                    "wdate": None,
                },
                {
                    "idx": "455",
                    "subject": "마케팅 매니저",
                    "content": "<p>글로벌 마케팅</p>",
                    "addinfo4": "5년 이상",
                    "addinfo5": "정규직",
                    "addinfo6": "https://career.shiftup.co.kr/o/226149/apply",
                    "addinfo7": "사업",
                    "status": "1",
                },
                {
                    "idx": "999",
                    "subject": "마감된 서버 프로그래머",
                    "content": "<p>서버 개발</p>",
                    "addinfo4": "5~10년",
                    "addinfo5": "정규직",
                    "addinfo6": "https://career.shiftup.co.kr/o/999/apply",
                    "addinfo7": "Programmer",
                    "status": "0",
                },
            ],
        },
        ensure_ascii=False,
    )

    openings = parse_shiftup_openings(payload)

    assert [opening.external_id for opening in openings] == ["227131", "224782"]
    assert [opening.title for opening in openings] == [
        "Technical Artist (TA)",
        "전투 QA",
    ]

    technical_artist = openings[0]
    assert technical_artist.url == "https://career.shiftup.co.kr/ko/o/227131"
    assert technical_artist.status == "open"
    assert technical_artist.employment_type == "regular"
    assert technical_artist.career_type == "experienced"
    assert technical_artist.career_min == 3
    assert technical_artist.career_max is None
    assert "Unreal Engine 5와 Python" in technical_artist.description_text
    assert technical_artist.opens_at is not None

    qa = openings[1]
    assert qa.url == "https://career.shiftup.co.kr/o/224782"
    assert qa.employment_type == "contract"
    assert qa.career_type == "experienced"
    assert qa.career_min is None
    assert qa.career_max == 2


def test_parse_shiftup_openings_rejects_non_official_detail_urls() -> None:
    payload = json.dumps(
        {
            "result": "000",
            "list": [
                {
                    "subject": "서버 프로그래머",
                    "content": "<p>서버 개발</p>",
                    "addinfo6": "https://example.com/o/123/apply",
                    "addinfo7": "Programmer",
                    "status": "1",
                }
            ],
        },
        ensure_ascii=False,
    )

    with pytest.raises(ValueError, match="official Shift Up detail"):
        parse_shiftup_openings(payload)
