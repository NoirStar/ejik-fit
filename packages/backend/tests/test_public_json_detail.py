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


def test_dunamu_server_html_discovers_current_links_and_parses_detail() -> None:
    listing = """
    <html><body>
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {"pageProps": {"articles": {
            "content": [
              {
                "id": 1,
                "categoryKind": "NONE",
                "categoryDisplayName": "Notice",
                "title": "자주 하는 질문",
                "summary": ""
              },
              {
                "id": 2,
                "categoryKind": "LINK",
                "categoryDisplayName": "Engineering",
                "title": "Frontend Engineer",
                "summary": "https://careers.dunamu.com/detail/588"
              },
              {
                "id": 3,
                "categoryKind": "LINK",
                "categoryDisplayName": "Talent Pool",
                "title": "개발직군 인재풀",
                "summary": "https://careers.dunamu.com/careers/pool/detail/80"
              }
            ],
            "last": true,
            "totalElements": 3,
            "numberOfElements": 3
          }}}
        }
      </script>
    </body></html>
    """

    refs = discover_public_json_detail_refs(
        listing,
        "https://www.dunamu.com/careers/jobs",
        "dunamu_server_html_tech",
    )

    assert [ref.external_id for ref in refs] == ["588", "80"]
    assert refs[0].detail_url == "https://careers.dunamu.com/detail/588"
    assert refs[0].category == "Engineering"

    detail = """
    <html><body>
      <div class="detailView_title">Frontend Engineer</div>
      <div class="detailView_information">
        <h3>주요업무</h3><p>TypeScript와 React 기반 서비스 개발</p>
        <h3>자격요건</h3><p>5년 이상의 웹 서비스 개발 경력</p>
        <h3>우대사항</h3><p>AWS와 Kubernetes 경험</p>
        <h3>[채용정보]</h3>
        <ul><li>고용형태 : 정규직</li><li>채용유형 : 경력직</li>
        <li>근무지역 : 서울시 서초구 강남대로 369</li></ul>
      </div>
    </body></html>
    """
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "dunamu_server_html_tech",
    )

    assert opening.external_id == "588"
    assert opening.url == refs[0].public_url
    assert opening.title == "Frontend Engineer"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.location == "서울시 서초구 강남대로 369"
    assert "TypeScript와 React 기반 서비스 개발" in opening.description_text
