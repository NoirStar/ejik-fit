import json

from ejikfit.connectors.next_data import parse_static_next_data_openings
from ejikfit.posting_content import has_substantive_posting_content


def test_parse_static_next_data_openings_maps_next_data_script() -> None:
    payload = {
        "props": {
            "pageProps": {
                "jobs": [
                    {
                        "id": "LG-1001",
                        "title": "Backend Platform Engineer",
                        "detailUrl": "/apply/jobs/LG-1001",
                        "location": "서울",
                        "employmentType": "정규직",
                        "careerType": "경력",
                        "jobCategory": "Cloud Platform",
                        "skillTags": ["Python", "Kubernetes"],
                        "startDate": "2026-07-01",
                        "endDate": "2026-07-31",
                        "isPublic": True,
                    },
                    {
                        "id": "LG-hidden",
                        "title": "Hidden Engineer",
                        "detailUrl": "/apply/jobs/LG-hidden",
                        "isPublic": False,
                    },
                ]
            }
        }
    }
    html = (
        '<html><head><script id="__NEXT_DATA__" type="application/json">'
        f"{json.dumps(payload, ensure_ascii=False)}"
        "</script></head></html>"
    )

    openings = parse_static_next_data_openings(
        html,
        "https://careers.lg.com/apply",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "LG-1001"
    assert opening.url == "https://careers.lg.com/apply/jobs/LG-1001"
    assert opening.title == "Backend Platform Engineer"
    assert opening.status == "open"
    assert opening.employment_type == "정규직"
    assert opening.career_type == "experienced"
    assert opening.location == "서울"
    assert opening.description_text == "Cloud Platform Python Kubernetes"
    assert opening.opens_at is not None
    assert opening.closes_at is not None


def test_parse_static_next_data_openings_maps_raw_json_payload() -> None:
    payload = {
        "pageProps": {
            "announcements": [
                {
                    "jobId": 3100,
                    "jobTitle": "Data Platform Engineer",
                    "href": "/careers/jobs/3100",
                    "workLocations": ["판교", "서울"],
                    "jobType": "계약직",
                    "experience": "신입/경력",
                    "departmentName": "Data Platform",
                    "techStacks": [{"name": "Spark"}, {"title": "Python"}],
                    "openingDate": "2026.07.10",
                    "deadline": "2026.08.10",
                }
            ]
        }
    }

    openings = parse_static_next_data_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://example.com/careers",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "3100"
    assert opening.url == "https://example.com/careers/jobs/3100"
    assert opening.title == "Data Platform Engineer"
    assert opening.employment_type == "계약직"
    assert opening.career_type == "mixed"
    assert opening.location == "판교, 서울"
    assert opening.description_text == "Data Platform Spark Python"
    assert opening.opens_at is not None
    assert opening.closes_at is not None


def test_parse_static_next_data_openings_filters_non_public_and_navigation_objects() -> None:
    payload = {
        "menus": [
            {"id": "career", "title": "Careers", "href": "/careers"},
            {"id": "about", "title": "About Us", "href": "/about"},
        ],
        "jobs": [
            {
                "id": "public-1",
                "title": "Frontend Engineer",
                "href": "/jobs/public-1",
                "publish": True,
            },
            {
                "id": "private-1",
                "title": "Private Engineer",
                "href": "/jobs/private-1",
                "publish": False,
            },
            {
                "id": "closed-1",
                "title": "Closed Engineer",
                "href": "/jobs/closed-1",
                "status": "CLOSED",
            },
            {
                "id": "no-url-1",
                "title": "Missing Detail URL",
            },
        ],
    }

    openings = parse_static_next_data_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://example.com/careers",
    )

    assert [opening.external_id for opening in openings] == ["public-1"]
    assert openings[0].url == "https://example.com/jobs/public-1"


def test_explicit_description_html_is_preserved_without_filter_metadata() -> None:
    description_html = (
        "<h2>주요 업무</h2>"
        "<p>Python과 FastAPI 기반 AI 서비스 API를 설계하고 대규모 요청을 "
        "안정적으로 처리하도록 성능을 개선합니다.</p>"
        "<h2>필수 역량</h2>"
        "<p>Kubernetes 환경의 배포와 관측 가능성을 운영하고 장애 원인을 "
        "분석하며 자동화된 테스트와 데이터 품질 검증 체계를 구축한 경험이 "
        "필요합니다.</p>"
    )
    payload = {
        "jobs": [
            {
                "id": "kt-ai-1",
                "title": "[KT] AI Platform Engineer",
                "url": "https://kt.recruiter.co.kr/career/jobs/kt-ai-1",
                "descriptionHtml": description_html,
                "companyName": "KT",
                "jobGroup": "AI Foundation Data Governance",
                "active": True,
            }
        ]
    }

    opening = parse_static_next_data_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://recruit.kt.com/api/recruit?isContainsContents=1",
    )[0]

    assert opening.description_html == description_html
    assert opening.description_text.startswith("## 주요 업무")
    assert "Python과 FastAPI" in opening.description_text
    assert "Kubernetes 환경" in opening.description_text
    assert "AI Foundation Data Governance" not in opening.description_text
    assert has_substantive_posting_content(
        opening.description_html,
        opening.description_text,
        opening.url,
    )


def test_same_host_image_description_satisfies_content_contract() -> None:
    payload = {
        "jobs": [
            {
                "id": "kt-cloud-image",
                "title": "[kt cloud] 데이터센터 기술 공고",
                "url": (
                    "https://kt.recruiter.co.kr/career/jobs/"
                    "kt-cloud-image"
                ),
                "descriptionHtml": (
                    '<p><img src="https://kt.recruiter.co.kr/upload/'
                    'postings/kt-cloud-image.png" alt="채용 공고 상세"></p>'
                ),
                "active": True,
            }
        ]
    }

    opening = parse_static_next_data_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://recruit.kt.com/api/recruit?isContainsContents=1",
    )[0]

    assert opening.description_text == ""
    assert has_substantive_posting_content(
        opening.description_html,
        opening.description_text,
        opening.url,
    )
