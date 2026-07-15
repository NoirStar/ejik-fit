import json

from ejikfit.connectors.public_json_detail import (
    discover_public_json_detail_refs,
    parse_public_json_detail,
)


def test_woowahan_public_api_discovers_and_parses_a_full_detail() -> None:
    listing = json.dumps(
        {
            "code": "2000",
            "data": {
                "pageSize": 100,
                "pageNumber": 1,
                "totalPageNumber": 1,
                "totalSize": 2,
                "list": [
                    {
                        "recruitNumber": "R2606023",
                        "recruitName": "Server(배차시스템)",
                        "recruitDeleteYn": False,
                        "isHidden": False,
                        "isAfterOrEqualOpenDay": True,
                    },
                    {
                        "recruitNumber": "R2607004",
                        "recruitName": "운영지원(B마트 상품전략)",
                        "recruitDeleteYn": False,
                        "isHidden": False,
                        "isAfterOrEqualOpenDay": True,
                    },
                ],
            },
        },
        ensure_ascii=False,
    )

    refs = discover_public_json_detail_refs(
        listing,
        "https://career.woowahan.com/w1/recruits?page=0&size=100",
        "woowahan_public_api_tech",
    )

    assert [ref.external_id for ref in refs] == ["R2606023", "R2607004"]
    assert refs[0].detail_url == (
        "https://career.woowahan.com/w1/recruits/R2606023"
    )
    assert refs[0].public_url == (
        "https://career.woowahan.com/recruitment/R2606023/detail"
    )

    opening = parse_public_json_detail(
        json.dumps(
            {
                "code": "2000",
                "data": {
                    "recruitNumber": "R2606023",
                    "recruitName": "Server(배차시스템)",
                    "recruitContents": (
                        "<h3>지원자격</h3><p>Java와 Spring 경험</p>"
                        "<h3>우대사항</h3><p>AWS 경험</p>"
                    ),
                    "recruitOpenDate": "2026-06-15 16:54:40",
                    "recruitEndDate": "9999-12-31 00:00:00",
                    "careerRestrictionMinYears": 5,
                    "careerRestrictionMaxYears": 15,
                    "careerType": {"recruitItemCode": "BA003002"},
                    "employmentType": {"recruitItemCode": "BA002001"},
                    "recruitDeleteYn": False,
                    "isAfterOrEqualEndDay": False,
                },
            },
            ensure_ascii=False,
        ),
        refs[0],
        "woowahan_public_api_tech",
    )

    assert opening.external_id == "R2606023"
    assert opening.url == refs[0].public_url
    assert opening.title == "Server(배차시스템)"
    assert opening.career_type == "experienced"
    assert opening.career_min == 5
    assert opening.career_max == 15
    assert opening.employment_type == "regular"
    assert opening.closes_at is None
    assert "Java와 Spring 경험" in opening.description_text
    assert "우대사항" in opening.description_text


def test_kakaobank_public_api_discovers_and_parses_a_full_detail() -> None:
    listing = json.dumps(
        {
            "paging": {
                "pageNumber": 1,
                "pageSize": 100,
                "totalPages": 1,
                "totalElements": 2,
                "receiptFilterType": "ONGOING",
            },
            "list": [
                {
                    "recruitNoticeSn": 257846,
                    "recruitNoticeName": "재무리스크 시스템 개발자",
                    "recruitClassName": "Core Banking",
                },
                {
                    "recruitNoticeSn": 258064,
                    "recruitNoticeName": "서비스 기획자 - 투자서비스",
                    "recruitClassName": "Service & Biz",
                },
            ],
        },
        ensure_ascii=False,
    )

    refs = discover_public_json_detail_refs(
        listing,
        "https://recruit.kakaobank.com/api/recruits",
        "kakaobank_public_api_tech",
    )

    assert refs[0].detail_url == (
        "https://recruit.kakaobank.com/api/recruits/257846"
    )
    assert refs[0].public_url == (
        "https://recruit.kakaobank.com/jobs/257846"
    )
    assert refs[0].category == "Core Banking"

    opening = parse_public_json_detail(
        json.dumps(
            {
                "recruitNoticeSn": 257846,
                "recruitNoticeName": "재무리스크 시스템 개발자",
                "recruitClassName": "Core Banking",
                "recruitTypeName": "일반채용",
                "receiveStartDatetime": "2026-06-23 00:00:00",
                "receiveEndDatetime": "2026-07-15 23:59:59",
                "contents": (
                    "<h3>필수 경험</h3><p>Java 서버 개발 경험</p>"
                    "<h3>우대사항</h3><p>Kafka 운영 경험</p>"
                ),
            },
            ensure_ascii=False,
        ),
        refs[0],
        "kakaobank_public_api_tech",
    )

    assert opening.external_id == "257846"
    assert opening.url == refs[0].public_url
    assert opening.title == "재무리스크 시스템 개발자"
    assert opening.employment_type == "regular"
    assert opening.closes_at is not None
    assert "Java 서버 개발 경험" in opening.description_text
    assert "Kafka 운영 경험" in opening.description_text
