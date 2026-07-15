import json

from ejikfit.connectors.lever_greenhouse import parse_lever_greenhouse_openings


def test_parse_lever_greenhouse_openings_maps_lever_postings() -> None:
    payload = [
        {
            "id": "lever-100",
            "text": "Backend Infrastructure Engineer",
            "hostedUrl": "https://jobs.lever.co/acme/lever-100",
            "applyUrl": "https://jobs.lever.co/acme/lever-100/apply",
            "categories": {
                "team": "Engineering",
                "department": "Platform",
                "location": "Seoul",
                "commitment": "Full-time",
            },
            "createdAt": 1783555200000,
            "descriptionPlain": "Build internal platforms.",
            "additionalPlain": "Python Kubernetes",
            "lists": [
                {
                    "text": "Requirements",
                    "content": "<p>Distributed systems experience</p>",
                }
            ],
        },
        {
            "id": "lever-hidden",
            "text": "Hidden Engineer",
            "hostedUrl": "https://jobs.lever.co/acme/hidden",
            "state": "closed",
        },
    ]

    openings = parse_lever_greenhouse_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://jobs.lever.co/acme",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "lever-100"
    assert opening.url == "https://jobs.lever.co/acme/lever-100"
    assert opening.title == "Backend Infrastructure Engineer"
    assert opening.status == "open"
    assert opening.employment_type == "Full-time"
    assert opening.location == "Seoul"
    assert opening.description_text == (
        "Engineering Platform Build internal platforms. Python Kubernetes "
        "Requirements Distributed systems experience"
    )
    assert opening.opens_at is not None


def test_parse_lever_greenhouse_openings_maps_greenhouse_jobs() -> None:
    payload = {
        "jobs": [
            {
                "id": 2200,
                "title": "Machine Learning Engineer",
                "absolute_url": "https://boards.greenhouse.io/acme/jobs/2200",
                "location": {"name": "Seoul, Korea"},
                "departments": [{"name": "AI"}],
                "offices": [{"name": "Seoul"}],
                "metadata": [
                    {"name": "Employment Type", "value": "Full-time"},
                    {"name": "Tech Stack", "value": "Python"},
                ],
                "content": "<p>Build model serving systems.</p>",
                "updated_at": "2026-07-09T10:00:00+09:00",
            },
            {
                "id": 2300,
                "title": "Inactive Engineer",
                "absolute_url": "https://boards.greenhouse.io/acme/jobs/2300",
                "active": False,
            },
        ]
    }

    openings = parse_lever_greenhouse_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://boards.greenhouse.io/acme",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "2200"
    assert opening.url == "https://boards.greenhouse.io/acme/jobs/2200"
    assert opening.title == "Machine Learning Engineer"
    assert opening.status == "open"
    assert opening.employment_type == "Full-time"
    assert opening.location == "Seoul, Korea"
    assert opening.description_text == "AI Seoul Tech Stack Python Build model serving systems."
    assert opening.opens_at is not None


def test_parse_lever_greenhouse_openings_maps_ashby_jobs() -> None:
    payload = {
        "apiVersion": "1",
        "jobs": [
            {
                "id": "042715bb-0674-4e2a-9155-19c54835fe18",
                "title": "Senior Infrastructure Engineer",
                "department": "Tech",
                "team": "Engineering",
                "location": "Seoul, South Korea",
                "employmentType": "FullTime",
                "isListed": True,
                "isRemote": False,
                "workplaceType": "Hybrid",
                "publishedAt": "2026-04-06T06:58:45.512+00:00",
                "jobUrl": (
                    "https://jobs.ashbyhq.com/twelve-labs/"
                    "042715bb-0674-4e2a-9155-19c54835fe18"
                ),
                "descriptionHtml": (
                    "<h2>Role</h2><p>Build Kubernetes infrastructure.</p>"
                ),
                "descriptionPlain": "Role\nBuild Kubernetes infrastructure.",
            },
            {
                "id": "152715bb-0674-4e2a-9155-19c54835fe19",
                "title": "Hidden Backend Engineer",
                "location": "Seoul, South Korea",
                "isListed": False,
                "jobUrl": (
                    "https://jobs.ashbyhq.com/twelve-labs/"
                    "152715bb-0674-4e2a-9155-19c54835fe19"
                ),
                "descriptionHtml": "<p>Hidden role</p>",
            },
        ],
    }

    openings = parse_lever_greenhouse_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://api.ashbyhq.com/posting-api/job-board/twelve-labs",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "042715bb-0674-4e2a-9155-19c54835fe18"
    assert opening.url == (
        "https://jobs.ashbyhq.com/twelve-labs/"
        "042715bb-0674-4e2a-9155-19c54835fe18"
    )
    assert opening.title == "Senior Infrastructure Engineer"
    assert opening.status == "open"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.location == "Seoul, South Korea"
    assert "Kubernetes infrastructure" in opening.description_text
    assert "<h2>Role</h2>" in opening.description_html
    assert opening.opens_at is not None
