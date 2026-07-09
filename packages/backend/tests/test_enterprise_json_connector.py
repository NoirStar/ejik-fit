import json

from ejikfit.connectors.enterprise_json import parse_enterprise_json_openings


def test_parse_enterprise_json_openings_maps_public_job_objects() -> None:
    payload = {
        "data": {
            "recruitments": [
                {
                    "postingId": "ENT-100",
                    "postingTitle": "AI Platform Engineer",
                    "jobDetailUrl": "/jobs/ENT-100",
                    "workLocations": ["서울", "판교"],
                    "employmentType": "정규직",
                    "requiredExperience": "신입/경력",
                    "department": "AI Platform",
                    "skills": [{"name": "Python"}, {"name": "Kubernetes"}],
                    "datePosted": "2026-07-09T09:00:00+09:00",
                    "validThrough": "2026-08-09",
                    "public": True,
                },
                {
                    "postingId": "ENT-private",
                    "postingTitle": "Private Engineer",
                    "jobDetailUrl": "/jobs/ENT-private",
                    "public": False,
                },
                {
                    "postingId": "ENT-closed",
                    "postingTitle": "Closed Engineer",
                    "jobDetailUrl": "/jobs/ENT-closed",
                    "status": "closed",
                },
            ]
        }
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://careers.example.com/api/jobs",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "ENT-100"
    assert opening.url == "https://careers.example.com/jobs/ENT-100"
    assert opening.title == "AI Platform Engineer"
    assert opening.status == "open"
    assert opening.employment_type == "정규직"
    assert opening.career_type == "mixed"
    assert opening.location == "서울, 판교"
    assert opening.description_text == "AI Platform Python Kubernetes"
    assert opening.opens_at is not None
    assert opening.closes_at is not None
