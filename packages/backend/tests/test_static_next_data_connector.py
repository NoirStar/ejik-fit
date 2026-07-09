import json

from ejikfit.connectors.next_data import parse_static_next_data_openings


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
