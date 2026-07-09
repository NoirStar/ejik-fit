import json

from ejikfit.connectors.successfactors import parse_successfactors_openings


def test_parse_successfactors_openings_maps_odata_results() -> None:
    payload = {
        "d": {
            "results": [
                {
                    "jobReqId": "SF-100",
                    "externalTitle": "Backend Engineer",
                    "jobDetailsUrl": "/career/job/SF-100",
                    "location": "Seoul",
                    "employmentType": "Regular",
                    "jobFunction": "Engineering",
                    "department": "Platform",
                    "jobDescription": "<p>Java and Spring services.</p>",
                    "postedDate": "/Date(1783555200000)/",
                    "status": "OPEN",
                },
                {
                    "jobReqId": "SF-closed",
                    "externalTitle": "Closed Engineer",
                    "jobDetailsUrl": "/career/job/SF-closed",
                    "status": "CLOSED",
                },
            ]
        }
    }

    openings = parse_successfactors_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://jobs.example.com/career",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "SF-100"
    assert opening.url == "https://jobs.example.com/career/job/SF-100"
    assert opening.title == "Backend Engineer"
    assert opening.status == "open"
    assert opening.employment_type == "Regular"
    assert opening.location == "Seoul"
    assert opening.description_text == "Engineering Platform Java and Spring services."
    assert opening.opens_at is not None


def test_parse_successfactors_openings_maps_results_list() -> None:
    payload = {
        "results": [
            {
                "jobId": 2200,
                "jobTitle": "Security Engineer",
                "externalApplyUrl": "https://jobs.example.com/job/2200",
                "city": "Pangyo",
                "country": "Korea",
                "jobType": "Full-time",
                "businessUnit": "Security",
                "description": "<p>Detection platform engineering.</p>",
                "lastModifiedDateTime": "2026-07-09T10:00:00+09:00",
            }
        ]
    }

    openings = parse_successfactors_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://jobs.example.com/career",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "2200"
    assert opening.url == "https://jobs.example.com/job/2200"
    assert opening.title == "Security Engineer"
    assert opening.employment_type == "Full-time"
    assert opening.location == "Pangyo, Korea"
    assert opening.description_text == "Security Detection platform engineering."
    assert opening.opens_at is not None
