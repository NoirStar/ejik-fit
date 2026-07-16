import json


def test_parse_naver_openings_maps_public_job_list_json() -> None:
    from ejikfit.connectors.naver import parse_naver_openings

    payload = {
        "result": True,
        "list": [
            {
                "annoId": 1001,
                "annoSubject": "Backend Engineer - Search Platform",
                "jobDetailLink": (
                    "https://recruit.navercorp.com/rcrt/view.do?annoId=1001"
                ),
                "entTypeCdNm": "경력",
                "empTypeCdNm": "정규",
                "classCdNm": "Tech",
                "subJobCdNm": "Backend",
                "annoKeyword": "Java, Spring, Kubernetes",
                "sysCompanyCdNm": "NAVER",
                "staYmdTime": "2026.07.01 10:00:00",
                "endYmdTime": "2026.07.31 18:00:00",
            },
            {
                "annoId": 1002,
                "annoSubject": "",
            },
        ],
    }

    openings = parse_naver_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "1001"
    assert opening.title == "Backend Engineer - Search Platform"
    assert opening.url == "https://recruit.navercorp.com/rcrt/view.do?annoId=1001"
    assert opening.status == "open"
    assert opening.employment_type == "정규"
    assert opening.career_type == "experienced"
    assert opening.description_text == "Tech Backend Java, Spring, Kubernetes NAVER"
    assert opening.opens_at is not None
    assert opening.closes_at is not None
