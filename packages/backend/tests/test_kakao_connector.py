import json


def test_parse_kakao_openings_maps_public_job_list_json() -> None:
    from ejikfit.connectors.kakao import parse_kakao_openings

    payload = {
        "jobList": [
            {
                "realId": "P-14476",
                "jobOfferTitle": "Backend Engineer (Spring)",
                "introduction": "<p>카카오 플랫폼 서버 개발</p>",
                "workContentDesc": "<p>Java와 Spring 기반 API 개발</p>",
                "qualification": "<p>Kubernetes 운영 경험</p>",
                "companyName": "KAKAO",
                "locationName": "경기 성남",
                "employeeTypeName": "정규직",
                "skillSetList": ["Java", "Spring", "Kubernetes"],
                "closeFlag": False,
                "statusCode": "PROGRESS",
                "regDate": "2026-07-01 09:00:00",
                "endDate": "2026-07-31 23:59:00",
            },
            {
                "realId": "P-closed",
                "jobOfferTitle": "Closed",
                "closeFlag": True,
                "statusCode": "END",
            },
        ],
    }

    openings = parse_kakao_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://careers.kakao.com/public/api/job-list?lang=ko",
    )

    assert len(openings) == 2
    opening = openings[0]
    assert opening.external_id == "P-14476"
    assert opening.url == "https://careers.kakao.com/jobs/P-14476"
    assert opening.title == "Backend Engineer (Spring)"
    assert opening.status == "open"
    assert opening.location == "경기 성남"
    assert opening.employment_type == "정규직"
    assert opening.career_type is None
    assert opening.description_text == (
        "카카오 플랫폼 서버 개발\n"
        "Java와 Spring 기반 API 개발\n"
        "Kubernetes 운영 경험\n"
        "Java Spring Kubernetes"
    )
    assert openings[1].status == "closed"
