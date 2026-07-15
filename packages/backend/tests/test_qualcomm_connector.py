import json

from ejikfit.connectors.microsoft import (
    is_qualcomm_technical_role,
    parse_pcsx_detail_opening,
    parse_pcsx_listing_openings,
    pcsx_detail_api_url,
)


LISTING_URL = (
    "https://careers.qualcomm.com/api/pcsx/search?"
    "domain=qualcomm.com&query=&location=Korea%2C%20Republic%20of&start=0"
)


def test_qualcomm_technical_role_uses_official_job_family() -> None:
    assert is_qualcomm_technical_role(
        "Camera SW Engineer, up to Senior",
        "Software Engineering",
    )
    assert is_qualcomm_technical_role(
        "Intern - Generative AI model personalization",
        "Interim Engineering Intern - SW",
    )
    assert not is_qualcomm_technical_role(
        "Senior Manager, AI Solutions Business Development",
        "Business Development",
    )


def test_qualcomm_listing_and_detail_url_preserve_official_scope() -> None:
    payload = {
        "total": 1,
        "jobs": [
            {
                "id": 446719415948,
                "displayJobId": "3093300",
                "name": "Audio ML Systems Engineer",
                "locations": ["Suwon, Gyeonggi-do, Korea, Republic of"],
                "postedTs": 1783036800,
                "department": "Systems Engineering",
                "positionUrl": "/careers/job/446719415948",
            }
        ],
    }

    opening = parse_pcsx_listing_openings(
        json.dumps(payload),
        LISTING_URL,
    )[0]

    assert opening.external_id == "3093300"
    assert opening.description_text == "Systems Engineering"
    assert opening.url == (
        "https://careers.qualcomm.com/careers/job/446719415948"
    )
    assert pcsx_detail_api_url(LISTING_URL, opening.url) == (
        "https://careers.qualcomm.com/api/pcsx/position_details?"
        "position_id=446719415948&domain=qualcomm.com&hl=en&"
        "queried_location=Korea%2C+Republic+of"
    )


def test_qualcomm_detail_maps_full_requirements_and_career_minimum() -> None:
    public_url = "https://careers.qualcomm.com/careers/job/446719415948"
    payload = {
        "status": 200,
        "error": {"message": "", "body": ""},
        "data": {
            "id": 446719415948,
            "displayJobId": "3093300",
            "name": "Audio ML Systems Engineer",
            "publicUrl": public_url,
            "jobDescription": (
                "<p>Build and deploy audio ML systems with Python.</p>"
                "<h2>Minimum Qualifications</h2>"
                "<ul><li>3+ years of audio ML experience.</li></ul>"
                "<h2>Preferred Qualifications</h2>"
                "<p>Embedded NPU experience.</p>"
            ),
            "location": "Suwon, Gyeonggi-do, Korea, Republic of",
            "postedTs": 1783036800,
            "department": "Systems Engineering",
        },
    }

    opening = parse_pcsx_detail_opening(
        json.dumps(payload),
        (
            "https://careers.qualcomm.com/api/pcsx/position_details?"
            "position_id=446719415948&domain=qualcomm.com&hl=en"
        ),
    )

    assert opening.external_id == "3093300"
    assert opening.url == public_url
    assert opening.career_type == "경력"
    assert opening.career_min == 3
    assert "Python" in opening.description_text
    assert opening.location == "Suwon, Gyeonggi-do, Korea, Republic of"
