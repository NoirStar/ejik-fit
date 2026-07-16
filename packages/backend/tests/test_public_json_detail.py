import json

from ejikfit.connectors.public_json_detail import (
    discover_public_json_detail_refs,
    filter_public_detail_refs,
    ncsoft_session_headers,
    ninehire_listing_config,
    parse_public_json_detail,
    parse_ninehire_listing_page,
    roundhr_site_code,
    workable_account_slug,
)


def _next_data_html(page_props: dict[str, object]) -> str:
    payload = json.dumps({"props": {"pageProps": page_props}}, ensure_ascii=False)
    return (
        '<html><body><script id="__NEXT_DATA__" type="application/json">'
        f"{payload}</script></body></html>"
    )


def test_roundhr_public_site_discovers_and_parses_only_open_technical_jobs() -> None:
    bootstrap = _next_data_html(
        {
            "site_config": {
                "organization": {
                    "code": "TAERFmj4QT",
                    "name": "리디(RIDI)",
                }
            }
        }
    )
    assert roundhr_site_code(bootstrap) == "TAERFmj4QT"

    def job(
        job_id: int,
        title: str,
        code: str,
        group: str,
        position: str,
        *,
        status: str = "in_progress",
        deleted: bool = False,
    ) -> dict[str, object]:
        return {
            "id": job_id,
            "title": title,
            "site_title": None,
            "deleted": deleted,
            "position_group": {"title": group},
            "position": {"title": position},
            "application_form": {
                "job_id": job_id,
                "code": code,
                "status": status,
                # RoundHR's list response currently returns false here even
                # while the matching public detail is open. It is not a
                # reliable listing-status field.
                "open_status": False,
                "expired": False,
            },
        }

    listing = json.dumps(
        {
            "page": {"total": 4, "pages": 1, "current": 1},
            "results": [
                job(
                    5169,
                    "Frontend Engineer",
                    "PeiuJj2agt",
                    "제품/개발",
                    "프론트엔드 엔지니어",
                ),
                job(
                    5170,
                    "Product Manager",
                    "Aei2Jj2agx",
                    "제품/개발",
                    "프로덕트 매니저",
                ),
                job(
                    5171,
                    "재무 담당자",
                    "Bei2Jj2agy",
                    "경영지원",
                    "회계/재무",
                ),
                job(
                    5172,
                    "Backend Engineer",
                    "Cei2Jj2agz",
                    "제품/개발",
                    "백엔드 엔지니어",
                    status="closed",
                ),
            ],
        },
        ensure_ascii=False,
    )
    refs = discover_public_json_detail_refs(
        listing,
        "https://ridi.recruit.roundhr.com/",
        "roundhr_public_api_tech",
    )
    refs = filter_public_detail_refs(refs, "roundhr_public_api_tech")

    assert [ref.external_id for ref in refs] == ["5169"]
    assert refs[0].detail_url == (
        "https://ridi.recruit.roundhr.com/c/PeiuJj2agt"
    )
    assert refs[0].category == "제품/개발 | 프론트엔드 엔지니어"

    detail = _next_data_html(
        {
            "site_config": {
                "organization": {
                    "address": "서울시 강남구 테헤란로 325",
                    "address_detail": "어반벤치빌딩",
                }
            },
            "_dehydratedState": {
                "queries": [
                    {
                        "queryKey": [
                            "SiteApplicationForm",
                            "show",
                            "PeiuJj2agt",
                        ],
                        "state": {
                            "data": {
                                "id": 5152,
                                "job_id": 5169,
                                "code": "PeiuJj2agt",
                                "status": "in_progress",
                                "career_kind": "experienced",
                                "career_start": 5,
                                "career_end": None,
                                "employment_type": "full_time",
                                "enable_remote": False,
                                "intro_content": (
                                    "<h3>직무 설명</h3>"
                                    "<p>React 기반 웹 서비스를 "
                                    "개발합니다.</p>"
                                ),
                                "requirement_content": (
                                    "<p>TypeScript 개발 경험</p>"
                                ),
                                "preferred_point_content": None,
                                "main_task_content": None,
                                "benefit_content": None,
                                "hire_round_content": None,
                                # This tenant-specific field can be false on
                                # a currently public, applicable detail.
                                "open_status": False,
                                "expired": False,
                                "created_at": "2026-03-21T21:44:14+09:00",
                                "end_at": None,
                                "job": {
                                    "id": 5169,
                                    "title": "Frontend Engineer",
                                    "site_title": None,
                                    "deleted": False,
                                },
                                "locations": [],
                            }
                        },
                    }
                ]
            },
        }
    )
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "roundhr_public_api_tech",
    )

    assert opening.external_id == "5169"
    assert opening.status == "open"
    assert opening.career_type == "experienced"
    assert opening.career_min == 5
    assert opening.career_max is None
    assert opening.employment_type == "FULL_TIME"
    assert opening.location == (
        "서울시 강남구 테헤란로 325 어반벤치빌딩"
    )
    assert opening.opens_at is not None
    assert "React 기반 웹 서비스" in opening.description_text
    assert "TypeScript 개발 경험" in opening.description_text


def test_banksalad_public_api_discovers_and_parses_technical_greeting_jobs() -> None:
    listing = json.dumps(
        {
            "jobs": [
                {
                    "department": "테크",
                    "data": [
                        {
                            "id": 160517,
                            "title": "DevOps Engineer (데브옵스 엔지니어)",
                            "job": "테크",
                            "url": (
                                "https://banksalad.career.greetinghr.com/"
                                "o/160517"
                            ),
                        }
                    ],
                },
                {
                    "department": "경영관리",
                    "data": [
                        {
                            "id": 160233,
                            "title": "Recruiter (리크루터)",
                            "job": "경영관리",
                            "url": (
                                "https://banksalad.career.greetinghr.com/"
                                "o/160233"
                            ),
                        }
                    ],
                },
            ]
        },
        ensure_ascii=False,
    )

    refs = discover_public_json_detail_refs(
        listing,
        "https://www.banksalad.com/proxy/api/greeting/openings",
        "banksalad_greeting_api_tech",
    )
    refs = filter_public_detail_refs(refs, "banksalad_greeting_api_tech")

    assert [ref.external_id for ref in refs] == ["160517"]
    assert refs[0].category == "테크"
    assert refs[0].public_url == (
        "https://banksalad.career.greetinghr.com/ko/o/160517"
    )

    detail = _next_data_html(
        {
            "dehydratedState": {
                "queries": [
                    {
                        "queryKey": ["opening", "getOpeningById"],
                        "state": {
                            "data": {
                                "data": {
                                    "openingsInfo": {
                                        "openingId": 160517,
                                        "title": (
                                            "DevOps Engineer "
                                            "(데브옵스 엔지니어)"
                                        ),
                                        "status": "OPEN",
                                        "detail": (
                                            "<h3>주요 업무</h3>"
                                            "<p>AWS와 Kubernetes 플랫폼 운영</p>"
                                        ),
                                        "openDate": "2026-06-01T00:00:00Z",
                                        "dueDate": None,
                                    },
                                    "jobPositionSetting": {
                                        "jobPositions": [
                                            {
                                                "jobPositionCareer": {
                                                    "careerType": "EXPERIENCED",
                                                    "careerFrom": 5,
                                                },
                                                "jobPositionEmployment": {
                                                    "employmentType": (
                                                        "FULL_TIME_WORKER"
                                                    )
                                                },
                                            }
                                        ]
                                    },
                                }
                            }
                        },
                    }
                ]
            }
        }
    )
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "banksalad_greeting_api_tech",
    )

    assert opening.status == "open"
    assert opening.career_type == "experienced"
    assert opening.career_min == 5
    assert opening.employment_type == "FULL_TIME_WORKER"
    assert "AWS와 Kubernetes" in opening.description_text


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


def test_ninehire_public_api_discovers_and_parses_only_open_technical_jobs() -> None:
    listing_url = "https://recruit.teamblind.com/recruit"
    company_id = "06de3c70-c17b-11ee-a4e8-19ace188b0c8"
    bootstrap = _next_data_html(
        {
            "homepageProps": {
                "domain": {"hostname": "recruit.teamblind.com"},
                "info": {"companyId": company_id, "status": "published"},
            }
        }
    )
    assert ninehire_listing_config(bootstrap, listing_url) == (
        company_id,
        "https://recruit.teamblind.com",
    )
    listing = json.dumps(
        {
            "count": 3,
            "results": [
                {
                    "companyId": company_id,
                    "recruitmentId": "776471f0-1d1b-11f1-821d-1fa51bdaccc6",
                    "addressKey": "QmXf5Tqm",
                    "externalTitle": (
                        "[팀블라인드 한국 지사] AI Technical Lead "
                        "(AI 테크 리드)"
                    ),
                    "status": "in_progress",
                    "isPrivate": False,
                    "jobGroup": {"title": "Engineering"},
                    "jobTask": {"title": "AI Engineering"},
                },
                {
                    "companyId": company_id,
                    "recruitmentId": "sales-role",
                    "addressKey": "RYpAZRvg",
                    "externalTitle": "SMB 광고사업 파트장 (대행사 세일즈)",
                    "status": "in_progress",
                    "isPrivate": False,
                    "jobGroup": {"title": "Sales"},
                    "jobTask": None,
                },
                {
                    "companyId": company_id,
                    "recruitmentId": "talent-pool",
                    "addressKey": "MVPoqxC0",
                    "externalTitle": "나에게 맞는 오픈 포지션이 없다면? 인재풀 등록",
                    "status": "in_progress",
                    "isPrivate": False,
                    "jobGroup": {"title": "General"},
                    "jobTask": None,
                },
            ],
        },
        ensure_ascii=False,
    )
    assert parse_ninehire_listing_page(listing, company_id)[1] == 3

    refs = discover_public_json_detail_refs(
        listing,
        listing_url,
        "ninehire_public_api_tech",
    )
    filtered = filter_public_detail_refs(refs, "ninehire_public_api_tech")

    assert len(refs) == 3
    assert len(filtered) == 1
    assert filtered[0].category == "Engineering · AI Engineering"
    assert filtered[0].detail_url == (
        "https://recruit.teamblind.com/job_posting/QmXf5Tqm"
    )

    detail = _next_data_html(
        {
            "recruitment": {
                "recruitmentId": "776471f0-1d1b-11f1-821d-1fa51bdaccc6",
                "externalTitle": (
                    "[팀블라인드 한국 지사] AI Technical Lead "
                    "(AI 테크 리드)"
                ),
                "status": "in_progress",
                "career": None,
                "employmentType": ["full_time"],
                "createdAt": "2026-03-11T07:53:30.000Z",
                "deadlineValue": None,
                "jobLocations": [],
            },
            "jobPosting": {
                "isActive": True,
                "content": "<h3>담당 업무</h3><p>AI 제품과 플랫폼을 개발합니다.</p>",
            },
        }
    )
    opening = parse_public_json_detail(
        detail,
        filtered[0],
        "ninehire_public_api_tech",
    )

    assert opening.status == "open"
    assert opening.employment_type == "regular"
    assert "AI 제품과 플랫폼" in opening.description_text


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


def test_nhn_public_api_keeps_only_korea_technical_jobs_and_parses_detail() -> None:
    def job(
        job_id: str,
        corporation: str,
        title: str,
        job_group: str,
        *,
        region: str = "KR",
    ) -> dict[str, object]:
        return {
            "id": job_id,
            "corporation": {
                "name": corporation,
                "regionCd": region,
            },
            "name": title,
            "finishYn": "N",
            "postingYn": "Y",
            "postingStaDatetime": "2026-07-01T09:00:00",
            "postingEndDatetime": "2999-12-31T00:00:00",
            "careerType": {"name": "경력"},
            "employeeType": {"name": "정규"},
            "jobSeries": [
                {
                    "name": "AI/ML",
                    "jobGroup": {"name": job_group},
                }
            ],
        }

    listing = json.dumps(
        {
            "header": {"resultCode": 0, "isSuccessful": True},
            "totalCount": 4,
            "result": [
                job("4370711607830110861", "NHN", "LLM 기술 개발", "Tech"),
                job("4370711607830110862", "NHN", "서비스 기획", "Business"),
                job(
                    "4370711607830110863",
                    "NHN JAPAN",
                    "AI 추진 담당",
                    "Tech",
                ),
                job(
                    "4370711607830110864",
                    "NHN Enterprise",
                    "IDC 운영자(인재풀)",
                    "Tech",
                ),
            ],
        },
        ensure_ascii=False,
    )

    all_refs = discover_public_json_detail_refs(
        listing,
        "https://careers.nhn.com/v1/job-postings"
        "?intensive-recruiting=&page=0&size=100",
        "nhn_public_api_tech",
    )
    refs = filter_public_detail_refs(all_refs, "nhn_public_api_tech")

    assert [ref.external_id for ref in refs] == ["4370711607830110861"]
    assert refs[0].title == "[NHN] LLM 기술 개발"
    assert refs[0].category == "Tech · AI/ML"
    assert refs[0].detail_url == (
        "https://careers.nhn.com/v1/job-postings/4370711607830110861"
    )
    assert refs[0].public_url == (
        "https://careers.nhn.com/recruits/4370711607830110861"
    )

    detail = json.dumps(
        {
            "header": {"resultCode": 0, "isSuccessful": True},
            "result": {
                **job(
                    "4370711607830110861",
                    "NHN",
                    "LLM 기술 개발",
                    "Tech",
                ),
                "jobPostingContentsItems": [
                    {
                        "title": "이런 분들을 찾고 있어요 (자격요건)",
                        "contents": ["Python과 RAG 개발 경험이 있으신 분"],
                        "footer": "",
                        "orderNo": 1,
                    },
                    {
                        "title": "이런 분이면 더 좋아요 (우대사항)",
                        "contents": ["LLM Agent 개발 경험이 있으신 분"],
                        "footer": (
                            "<p>근무지는 경기도 성남시 분당구입니다.</p>"
                        ),
                        "orderNo": 2,
                    },
                ],
            },
        },
        ensure_ascii=False,
    )
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "nhn_public_api_tech",
    )

    assert opening.status == "open"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.opens_at is not None
    assert opening.closes_at is None
    assert opening.location == "경기도 성남시 분당구"
    assert "자격요건" in opening.description_text
    assert "Python과 RAG" in opening.description_text
    assert "우대사항" in opening.description_text


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


def test_com2us_jobflex_api_parses_verified_technical_jobs() -> None:
    listing = json.dumps(
        {
            "pagination": {
                "page": 1,
                "size": 100,
                "totalCount": 3,
                "totalPages": 1,
            },
            "list": [
                {
                    "positionSn": 108380,
                    "title": "서머너즈워 차기 RPG 서버 프로그래머 (3년 이상)",
                    "submissionStatus": "IN_SUBMISSION",
                    "openStatus": "OPEN",
                    "classificationCode": "게임프로그래밍",
                },
                {
                    "positionSn": 121183,
                    "title": "웹 디자이너 (계약직/2년 이상)",
                    "submissionStatus": "IN_SUBMISSION",
                    "openStatus": "OPEN",
                    "classificationCode": "웹개발·디자인",
                },
                {
                    "positionSn": 87549,
                    "title": "[생성형 AI 아티스트] 게임 아트 R&D",
                    "submissionStatus": "IN_SUBMISSION",
                    "openStatus": "OPEN",
                    "classificationCode": "AI",
                },
            ],
        },
        ensure_ascii=False,
    )
    all_refs = discover_public_json_detail_refs(
        listing,
        "https://com2us.recruiter.co.kr/career/career",
        "com2us_jobflex_tech",
    )
    refs = filter_public_detail_refs(all_refs, "com2us_jobflex_tech")

    assert [ref.external_id for ref in refs] == ["108380"]
    assert refs[0].detail_url == (
        "https://api-recruiter.recruiter.co.kr/position/v2/jobflex/108380"
    )
    assert refs[0].public_url == (
        "https://com2us.recruiter.co.kr/career/jobs/108380"
    )

    detail = json.dumps(
        {
            "title": "서머너즈워 차기 RPG 서버 프로그래머 (3년 이상)",
            "jobDescription": (
                '<img src="https://com2us.recruiter.co.kr/upload/job.png">'
            ),
            "careerType": "CAREER",
            "progressStatus": "IN_PROGRESS",
            "startDateTime": "2026-07-01T00:00:00",
            "endDateTime": None,
            "classificationCode": "게임프로그래밍",
            "submissionStatus": "IN_SUBMISSION",
            "writeButtonStatus": "OPEN",
            "tagList": [
                {"tagSn": 6514, "tagName": "게임프로그래밍"},
                {"tagSn": 4522, "tagName": "IT 서비스"},
            ],
        },
        ensure_ascii=False,
    )
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "com2us_jobflex_tech",
    )

    assert opening.status == "open"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.career_min == 3
    assert opening.career_max is None
    assert opening.opens_at is not None
    assert "직무 분류: 게임프로그래밍" in opening.description_text
    assert "공식 태그: 게임프로그래밍, IT 서비스" in opening.description_text
    assert "<img" in opening.description_html


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


def test_dunamu_careers_html_discovers_server_rendered_job_cards() -> None:
    listing = """
    <html><body>
      <div class="main_list">
        <div class="main_list_item">
          <a class="main_list_link" href="/detail/588">
            <div class="main_list_title">Engineering</div>
            <div class="main_list_name">
              Frontend Engineer_데이터 프로덕트 서비스 개발
            </div>
          </a>
        </div>
        <div class="main_list_item">
          <a class="main_list_link" href="/detail/586">
            <div class="main_list_title">Security</div>
            <div class="main_list_name">정보보호 AX 운영 담당자</div>
          </a>
        </div>
        <div class="main_list_item">
          <a class="main_list_link" href="/detail/80">
            <div class="main_list_title">Talent Pool</div>
            <div class="main_list_name">개발직군 인재풀</div>
          </a>
        </div>
      </div>
    </body></html>
    """

    refs = discover_public_json_detail_refs(
        listing,
        "https://careers.dunamu.com/",
        "dunamu_server_html_tech",
    )

    assert [ref.external_id for ref in refs] == ["588", "586", "80"]
    assert refs[0].detail_url == "https://careers.dunamu.com/detail/588"
    assert refs[0].public_url == refs[0].detail_url
    assert refs[0].title == (
        "Frontend Engineer_데이터 프로덕트 서비스 개발"
    )
    assert refs[0].category == "Engineering"


def test_dunamu_public_api_discovers_and_parses_current_job_rows() -> None:
    listing = json.dumps(
        {
            "content": {
                "jobBoardName": "Dunamu",
                "jobNoticeResponses": [
                    {
                        "id": 599,
                        "name": "PR 담당자",
                        "jobGroupCode": "T_COMMUNICATION",
                        "experienceLevel": "EXPERIENCED",
                        "employmentType": "CONTRACT",
                    },
                    {
                        "id": 588,
                        "name": "Frontend Engineer_데이터 프로덕트 서비스 개발",
                        "jobGroupCode": "T_ENGINEERING",
                        "experienceLevel": "EXPERIENCED",
                        "employmentType": "FULL_TIME",
                    },
                    {
                        "id": 586,
                        "name": "정보보호 AX 운영 담당자",
                        "jobGroupCode": "T_SECURITY",
                        "experienceLevel": "EXPERIENCED",
                        "employmentType": "FULL_TIME",
                    },
                    {
                        "id": 80,
                        "name": "개발직군 인재풀",
                        "jobGroupCode": "T_TALENT_POOL",
                        "experienceLevel": "NONE",
                        "employmentType": "NONE",
                    },
                ],
            },
            "statusCode": 200,
            "message": "요청을 처리하였습니다.",
        },
        ensure_ascii=False,
    )
    listing_url = (
        "https://careers.dunamu.com/api/job-boards/"
        "jd0wjv/job-notices"
    )

    refs = discover_public_json_detail_refs(
        listing,
        listing_url,
        "dunamu_server_html_tech",
    )
    technical_refs = filter_public_detail_refs(
        refs,
        "dunamu_server_html_tech",
    )
    opening = parse_public_json_detail(
        listing,
        technical_refs[0],
        "dunamu_server_html_tech",
    )

    assert [ref.external_id for ref in technical_refs] == ["588", "586"]
    assert technical_refs[0].detail_url == listing_url
    assert technical_refs[0].public_url == (
        "https://careers.dunamu.com/detail/588"
    )
    assert technical_refs[0].category == "Engineering"
    assert opening.title == "Frontend Engineer_데이터 프로덕트 서비스 개발"
    assert opening.url == "https://careers.dunamu.com/detail/588"
    assert opening.career_type == "experienced"
    assert opening.employment_type == "regular"
    assert "Engineering" in opening.description_text


def test_workable_public_api_discovers_domestic_technical_jobs_and_parses_detail() -> None:
    bootstrap = """
    <html><head>
      <meta name="subdomain" content="lunit">
    </head></html>
    """
    assert workable_account_slug(
        bootstrap,
        "https://apply.workable.com/lunit/",
    ) == "lunit"

    def job(
        job_id: int,
        shortcode: str,
        title: str,
        department: str,
        country_code: str,
        *,
        internal: bool = False,
    ) -> dict[str, object]:
        return {
            "id": job_id,
            "shortcode": shortcode,
            "title": title,
            "state": "published",
            "isInternal": internal,
            "approvalStatus": "approved",
            "department": [department],
            "location": {
                "country": "South Korea" if country_code == "KR" else "Japan",
                "countryCode": country_code,
                "city": "Seoul" if country_code == "KR" else "Tokyo",
                "region": "Seoul" if country_code == "KR" else "Tokyo",
            },
        }

    listing = json.dumps(
        {
            "total": 4,
            "nextPage": None,
            "results": [
                job(
                    5913639,
                    "50EAF11E27",
                    "(Seoul) Senior Data Platform Engineer",
                    "Engineering",
                    "KR",
                ),
                job(
                    5913640,
                    "50EAF11E28",
                    "(Seoul) People Operations Manager",
                    "People",
                    "KR",
                ),
                job(
                    5913641,
                    "50EAF11E29",
                    "(Global) Backend Engineer",
                    "Engineering",
                    "JP",
                ),
                job(
                    5913642,
                    "50EAF11E30",
                    "(Seoul) Internal Platform Engineer",
                    "Engineering",
                    "KR",
                    internal=True,
                ),
            ],
        },
        ensure_ascii=False,
    )

    all_refs = discover_public_json_detail_refs(
        listing,
        "https://apply.workable.com/lunit/",
        "workable_public_api_tech",
    )
    refs = filter_public_detail_refs(all_refs, "workable_public_api_tech")

    assert [ref.external_id for ref in all_refs] == [
        "5913639",
        "5913640",
        "5913641",
    ]
    assert [ref.external_id for ref in refs] == ["5913639"]
    assert refs[0].detail_url == (
        "https://apply.workable.com/api/v2/accounts/lunit/jobs/50EAF11E27"
    )
    assert refs[0].public_url == (
        "https://apply.workable.com/lunit/j/50EAF11E27/"
    )
    assert refs[0].category == "Engineering"
    assert refs[0].location == "Seoul, South Korea"

    detail = json.dumps(
        {
            "id": 5913639,
            "shortcode": "50EAF11E27",
            "title": "(Seoul) Senior Data Platform Engineer",
            "state": "published",
            "isInternal": False,
            "approvalStatus": "approved",
            "published": "2026-06-26T00:00:00.000Z",
            "type": "full",
            "workplace": "on_site",
            "department": ["Engineering"],
            "location": {
                "country": "South Korea",
                "countryCode": "KR",
                "city": "Seoul",
                "region": "Seoul",
            },
            "description": "<p>Python과 Kubernetes 기반 플랫폼을 개발합니다.</p>",
            "requirements": "<p>데이터 플랫폼 개발 5년 이상의 실무 경험</p>",
            "benefits": "<p>교육비와 컨퍼런스 참가비를 지원합니다.</p>",
        },
        ensure_ascii=False,
    )
    opening = parse_public_json_detail(
        detail,
        refs[0],
        "workable_public_api_tech",
    )

    assert opening.status == "open"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.career_min == 5
    assert opening.location == "Seoul, South Korea"
    assert opening.opens_at is not None
    assert "자격 요건" in opening.description_text
    assert "Kubernetes 기반 플랫폼" in opening.description_text
    assert "컨퍼런스 참가비" in opening.description_text
