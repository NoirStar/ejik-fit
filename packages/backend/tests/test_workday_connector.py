import json

from ejikfit.connectors.workday import parse_workday_openings


def test_parse_workday_openings_maps_job_postings_feed() -> None:
    payload = {
        "jobPostings": [
            {
                "title": "Cloud Platform Engineer",
                "externalPath": "/en-US/acme/job/Seoul/Cloud-Platform-Engineer_JR-100",
                "locationsText": "Seoul, Korea",
                "timeType": "Full time",
                "jobFamilyGroup": "Technology",
                "jobFamily": "Cloud Platform",
                "workerSubType": "Regular",
                "startDate": "2026-07-09",
                "jobReqId": "JR-100",
            },
            {
                "title": "Inactive Engineer",
                "externalPath": "/en-US/acme/job/inactive",
                "jobReqId": "JR-closed",
                "inactive": True,
            },
        ]
    }

    openings = parse_workday_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://acme.wd1.myworkdayjobs.com/en-US/acme",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "JR-100"
    assert opening.url == (
        "https://acme.wd1.myworkdayjobs.com/en-US/acme/job/Seoul/"
        "Cloud-Platform-Engineer_JR-100"
    )
    assert opening.title == "Cloud Platform Engineer"
    assert opening.status == "open"
    assert opening.employment_type == "Full time"
    assert opening.location == "Seoul, Korea"
    assert opening.description_text == "Technology Cloud Platform Regular"
    assert opening.opens_at is not None


def test_parse_workday_openings_maps_job_posting_info_payload() -> None:
    payload = {
        "jobPostingInfo": {
            "jobReqId": "JR-200",
            "title": "Data Engineer",
            "externalUrl": "https://acme.wd1.myworkdayjobs.com/acme/job/JR-200",
            "location": "Pangyo",
            "timeType": "Full time",
            "jobDescription": "<p>Build data pipelines with Python.</p>",
            "startDate": "2026-07-10T09:00:00+09:00",
        }
    }

    openings = parse_workday_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://acme.wd1.myworkdayjobs.com/acme",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "JR-200"
    assert opening.url == "https://acme.wd1.myworkdayjobs.com/acme/job/JR-200"
    assert opening.title == "Data Engineer"
    assert opening.description_text == "Build data pipelines with Python."
    assert opening.opens_at is not None
