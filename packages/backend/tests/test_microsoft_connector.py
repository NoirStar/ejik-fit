import json

from ejikfit.connectors.microsoft import (
    is_microsoft_technical_role,
    microsoft_detail_api_url,
    parse_microsoft_detail_opening,
    parse_microsoft_listing_openings,
    parse_microsoft_search_page,
)


def test_microsoft_technical_role_uses_official_discipline_not_ai_buzzwords() -> None:
    assert is_microsoft_technical_role(
        "Software Solution Engineer",
        "Solution Engineering",
    )
    assert is_microsoft_technical_role(
        "Data Center Technician",
        "Data Center Technicians",
    )
    assert not is_microsoft_technical_role(
        "Data & AI Go-to-Market Manager",
        "Field Product Marketing",
    )
    assert not is_microsoft_technical_role(
        "AI Business Solution Specialist Manager",
        "Solution Area Specialists",
    )


def test_parse_microsoft_search_page_reads_complete_envelope() -> None:
    payload = {
        "status": 200,
        "error": {"message": "", "body": ""},
        "data": {
            "count": 24,
            "positions": [
                {
                    "id": 1970393556871047,
                    "displayJobId": "200038995",
                    "name": "Senior Software Solution Engineer",
                    "positionUrl": "/careers/job/1970393556871047",
                }
            ],
        },
    }

    positions, total = parse_microsoft_search_page(json.dumps(payload))

    assert total == 24
    assert positions == payload["data"]["positions"]


def test_parse_microsoft_listing_openings_maps_search_rows() -> None:
    listing_url = (
        "https://apply.careers.microsoft.com/api/pcsx/search?"
        "domain=microsoft.com&query=&location=South%20Korea&start=0"
    )
    payload = {
        "total": 1,
        "jobs": [
            {
                "id": 1970393556871047,
                "displayJobId": "200038995",
                "name": "Senior Software Solution Engineer",
                "locations": ["Korea, Seoul, Seoul"],
                "postedTs": 1780560731,
                "department": "Solution Engineering",
                "positionUrl": "/careers/job/1970393556871047",
            }
        ],
    }

    openings = parse_microsoft_listing_openings(
        json.dumps(payload),
        listing_url,
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "200038995"
    assert opening.url == (
        "https://apply.careers.microsoft.com/careers/job/1970393556871047"
    )
    assert opening.location == "Korea, Seoul, Seoul"
    assert opening.description_text == "Solution Engineering"
    assert opening.opens_at is not None


def test_microsoft_detail_api_url_keeps_official_host_and_location() -> None:
    assert microsoft_detail_api_url(
        (
            "https://apply.careers.microsoft.com/api/pcsx/search?"
            "domain=microsoft.com&query=&location=South%20Korea&start=0"
        ),
        "https://apply.careers.microsoft.com/careers/job/1970393556871047",
    ) == (
        "https://apply.careers.microsoft.com/api/pcsx/position_details?"
        "position_id=1970393556871047&domain=microsoft.com&hl=en&"
        "queried_location=South+Korea"
    )


def test_parse_microsoft_detail_opening_maps_technical_qualifications() -> None:
    detail_url = (
        "https://apply.careers.microsoft.com/api/pcsx/position_details?"
        "position_id=1970393556871047&domain=microsoft.com&hl=en"
    )
    public_url = (
        "https://apply.careers.microsoft.com/careers/job/1970393556871047"
    )
    payload = {
        "status": 200,
        "error": {"message": "", "body": ""},
        "data": {
            "id": 1970393556871047,
            "displayJobId": "200038995",
            "name": "Senior Software Solution Engineer",
            "publicUrl": public_url,
            "jobDescription": (
                "<b>Overview</b><div>Build cloud and AI solutions.</div>"
                "<b>Qualifications</b><div>Required Qualifications</div>"
                "<ul><li>5+ years of technical consulting experience</li>"
                "<li>Proficiency in Python, C#, and Azure.</li></ul>"
                "<div>Preferred Qualifications</div>"
                "<ul><li>8+ years of related experience</li></ul>"
            ),
            "location": "Korea, Seoul, Seoul",
            "postedTs": 1780560731,
            "department": "Solution Engineering",
            "efcustomTextEmploymentType": ["Full-Time"],
        },
    }

    opening = parse_microsoft_detail_opening(
        json.dumps(payload),
        detail_url,
    )

    assert opening.external_id == "200038995"
    assert opening.url == public_url
    assert opening.employment_type == "정규직"
    assert opening.career_type == "경력"
    assert opening.career_min == 5
    assert opening.location == "Korea, Seoul, Seoul"
    assert "Python, C#, and Azure" in opening.description_text
    assert "<b>Overview</b>" in opening.description_html


def test_microsoft_detail_does_not_infer_exact_years_from_equivalent_track() -> None:
    payload = {
        "status": 200,
        "error": {"message": "", "body": ""},
        "data": {
            "id": 1,
            "displayJobId": "200000001",
            "name": "Cloud Solution Architect",
            "publicUrl": "https://apply.careers.microsoft.com/careers/job/1",
            "jobDescription": (
                "<div>Required Qualifications</div>"
                "<ul><li>3+ years of cloud experience</li>"
                "<li>OR equivalent experience</li></ul>"
            ),
        },
    }

    opening = parse_microsoft_detail_opening(
        json.dumps(payload),
        "https://apply.careers.microsoft.com/api/pcsx/position_details?id=1",
    )

    assert opening.career_type == "경력"
    assert opening.career_min is None
