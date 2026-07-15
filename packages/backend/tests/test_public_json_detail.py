import json

from ejikfit.connectors.public_json_detail import (
    discover_public_json_detail_refs,
    filter_public_detail_refs,
    ncsoft_session_headers,
    parse_public_json_detail,
)


def _next_data_html(page_props: dict[str, object]) -> str:
    payload = json.dumps({"props": {"pageProps": page_props}}, ensure_ascii=False)
    return (
        '<html><body><script id="__NEXT_DATA__" type="application/json">'
        f"{payload}</script></body></html>"
    )


def test_ably_official_page_discovers_and_parses_open_ninehire_tech_jobs() -> None:
    listing = _next_data_html(
        {
            "recruits": [
                {
                    "id": "f49e48c0-56fe-11ee-be94-6d60768bf508",
                    "title": "백엔드 엔지니어 (시니어)",
                    "status": "in_progress",
                    "applyUrl": (
                        "https://tydtr0dj.ninehire.site/job_posting/1Ni2VkMj"
                    ),
                    "jobGroup": "Engineering",
                    "isPrivate": False,
                },
                {
                    "id": "closed-marketing",
                    "title": "마케팅 매니저",
                    "status": "closed",
                    "applyUrl": (
                        "https://tydtr0dj.ninehire.site/job_posting/closed"
                    ),
                    "jobGroup": "Business",
                    "isPrivate": False,
                },
                {
                    "id": "military-service-index",
                    "title": "[산업기능요원] 엔지니어 채용",
                    "status": "in_progress",
                    "applyUrl": (
                        "https://tydtr0dj.ninehire.site/job_posting/0Eu5yjmY"
                    ),
                    "jobGroup": "Engineering",
                    "isPrivate": False,
                },
            ]
        }
    )

    refs = discover_public_json_detail_refs(
        listing,
        "https://ably.team/recruit",
        "ably_next_ninehire_tech",
    )

    assert len(refs) == 1
    assert refs[0].external_id == "f49e48c0-56fe-11ee-be94-6d60768bf508"
    assert refs[0].category == "Engineering"
    assert refs[0].detail_url == (
        "https://tydtr0dj.ninehire.site/job_posting/1Ni2VkMj"
    )

    detail = _next_data_html(
        {
            "recruitment": {
                "recruitmentId": "f49e48c0-56fe-11ee-be94-6d60768bf508",
                "externalTitle": "백엔드 엔지니어 (시니어)",
                "status": "in_progress",
                "career": {"type": "experienced", "range": {"over": 7, "below": 0}},
                "employmentType": ["full_time"],
                "createdAt": "2026-04-24T06:29:01.000Z",
                "deadlineValue": None,
                "jobLocations": [
                    {
                        "placeName": "신논현",
                        "addressName": "서울특별시 서초구 강남대로 465",
                    }
                ],
            },
            "jobPosting": {
                "isActive": True,
                "content": (
                    "<h3>이런 분과 함께 하고 싶어요</h3>"
                    "<p>Django와 Spring 개발 경험</p>"
                    "<h3>이런 기술을 활용해요</h3><p>Python, Kafka, Redis</p>"
                ),
            },
        }
    )
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "ably_next_ninehire_tech",
    )

    assert opening.title == "백엔드 엔지니어 (시니어)"
    assert opening.status == "open"
    assert opening.career_type == "experienced"
    assert opening.career_min == 7
    assert opening.career_max is None
    assert opening.employment_type == "regular"
    assert opening.location == "서울특별시 서초구 강남대로 465"
    assert "Python, Kafka, Redis" in opening.description_text


def test_netmarble_public_api_discovers_and_parses_technical_jobs() -> None:
    listing = json.dumps(
        {
            "content": [
                {
                    "carAnnoId": 1830,
                    "annoSubject": "AI 엔지니어(VLM /음성 에이전트) 모집",
                    "carJobGroupCd": "05",
                    "carJobGroupNm": "기술/AI",
                    "carWorkGroupNm": "AI & Analytics",
                    "isApply": True,
                },
                {
                    "carAnnoId": 1825,
                    "annoSubject": "프로젝트 캐릭터 원화 담당 모집",
                    "carJobGroupCd": "03",
                    "carJobGroupNm": "아트",
                    "carWorkGroupNm": "캐릭터 원화",
                    "isApply": True,
                },
                {
                    "carAnnoId": 1811,
                    "annoSubject": "클라이언트 프로그래머 모집",
                    "carJobGroupCd": "01",
                    "carJobGroupNm": "게임프로그래밍",
                    "carWorkGroupNm": "클라이언트",
                    "isApply": True,
                },
            ],
            "page": {
                "totalDataCnt": 3,
                "totalPages": 1,
                "requestPage": 1,
                "requestSize": 1000,
                "isLastPage": True,
            },
        },
        ensure_ascii=False,
    )

    all_refs = discover_public_json_detail_refs(
        listing,
        "https://career.netmarble.com/announce",
        "netmarble_public_api_tech",
    )
    refs = filter_public_detail_refs(
        all_refs,
        "netmarble_public_api_tech",
    )

    assert [ref.external_id for ref in refs] == ["1830", "1811"]
    assert refs[0].detail_url == (
        "https://career.netmarble.com/api/v1/apply/announces/1830/view"
    )
    assert refs[0].public_url == (
        "https://career.netmarble.com/announce/view?anno_id=1830"
    )

    detail = json.dumps(
        {
            "carAnnoId": 1830,
            "annoSubject": "AI 엔지니어(VLM /음성 에이전트) 모집",
            "annoContents": (
                "<h3>지원자격</h3><p>Python, PyTorch, LLM 개발 경험</p>"
                "<h3>근무장소</h3><p>- 서울시 구로구 디지털로 26길 38</p>"
            ),
            "staDate": "2026-05-30 00:00:00",
            "endDate": "2026-12-31 23:59:59",
            "entTypeCd": "01",
            "reqTypeCd": "90006",
            "isApply": True,
            "isOpen": True,
            "isEnd": False,
            "isSecrete": False,
        },
        ensure_ascii=False,
    )
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "netmarble_public_api_tech",
    )

    assert opening.status == "open"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.location == "서울시 구로구 디지털로 26길 38"
    assert opening.opens_at is not None
    assert opening.closes_at is not None
    assert "Python, PyTorch, LLM" in opening.description_text


def test_ncsoft_session_api_discovers_and_parses_technical_jobs() -> None:
    session_headers = ncsoft_session_headers(
        '<meta name="_csrf" content="csrf-token-123">',
        {"set-cookie": "nextrct-web-session=session.worker1; Path=/; HttpOnly"},
        "https://careers.ncsoft.com/apply/list",
    )
    assert session_headers["X-CSRF-TOKEN"] == "csrf-token-123"
    assert session_headers["Cookie"] == "nextrct-web-session=session.worker1"

    listing = json.dumps(
        {
            "result": {
                "State": "0",
                "data": {
                    "record_count": 3,
                    "record": [
                        {
                            "jopenId": 101003,
                            "regOpId": "NCH",
                            "jopenNm": "[정보보안] 게임보안 개발자 모집",
                            "jobTypeName": "General Programming",
                            "jobName": "Security Engine Programming",
                        },
                        {
                            "jopenId": 101036,
                            "regOpId": "NCH",
                            "jopenNm": "신규 FPS FX 아티스트 모집",
                            "jobTypeName": "Art",
                            "jobName": "VFX",
                        },
                        {
                            "jopenId": 101032,
                            "regOpId": "NCAI",
                            "jopenNm": "AI 데이터 구축 어시스턴트 모집",
                            "jobTypeName": "AI R&D",
                            "jobName": "Language AI Research",
                        },
                    ],
                    "page": "1",
                    "pagesize": "200",
                },
            }
        },
        ensure_ascii=False,
    )

    all_refs = discover_public_json_detail_refs(
        listing,
        "https://careers.ncsoft.com/apply/list",
        "ncsoft_session_html_tech",
    )
    refs = filter_public_detail_refs(all_refs, "ncsoft_session_html_tech")

    assert [ref.external_id for ref in refs] == ["101003"]
    assert refs[0].detail_url == (
        "https://careers.ncsoft.com/template/html//apply/view"
        "?companyId=NCH&jopenId=101003"
    )
    assert refs[0].public_url == (
        "https://careers.ncsoft.com/apply/view/101003?companyId=NCH"
    )

    detail = """
    <section id="container">
      <header class="apply-detail-header-wrap">
        <span class="career-tit">경력</span>
        <h2 class="subject">[정보보안] 게임보안 개발자 모집</h2>
        <span class="term">2026.07.08 ~ 2026.08.07</span>
      </header>
      <section class="apply-detail-content">
        <article class="contents">
          <h3>[ 업무내용 ]</h3><p>C++ 보안 엔진을 개발합니다.</p>
          <h3>[ 지원자격 ]</h3><p>경력 : 3년 ~ 10년</p>
          <h3>이런 역량을 갖추신 분을 찾고 있습니다(필수)</h3>
          <p>C++, Windows 시스템 프로그래밍 경험</p>
        </article>
      </section>
      <a class="btn-apply">지원하기</a>
    </section>
    """
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "ncsoft_session_html_tech",
    )

    assert opening.status == "open"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.career_min == 3
    assert opening.career_max == 10
    assert opening.opens_at is not None
    assert opening.closes_at is not None
    assert "C++, Windows" in opening.description_text


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
