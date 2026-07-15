import json

from ejikfit.connectors.channel import parse_channel_openings
from ejikfit.skill_extraction import RequirementType, extract_skill_matches


def _next_data_html(jobs: list[dict[str, object]]) -> str:
    payload = {"props": {"pageProps": {"jobs": jobs}}}
    return (
        '<script id="__NEXT_DATA__" type="application/json">'
        f"{json.dumps(payload, ensure_ascii=False)}"
        "</script>"
    )


def test_channel_parser_maps_complete_job_content_and_requirement_sections() -> None:
    html = _next_data_html(
        [
            {
                "id": "devops-1",
                "text": "DevOps Engineer",
                "categories": {
                    "commitment": "주니어/시니어/정규직",
                    "department": "Korea(HQ)",
                    "location": "Gangnam District, Seoul",
                    "team": "Engineering",
                },
                "createdAt": 1_752_819_767_459,
                "description": "<div>신뢰할 수 있는 플랫폼을 운영합니다.</div>",
                "lists": [
                    {
                        "text": "어떤 경력과 역량이 필요한가요?",
                        "content": "<li>Kubernetes 운영 경험</li>",
                    },
                    {
                        "text": "이런 점이 있으면 더 좋아요",
                        "content": "<li>Terraform 활용 경험</li>",
                    },
                ],
            }
        ]
    )

    openings = parse_channel_openings(html, "https://channel.io/kr/careers")

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "devops-1"
    assert opening.url == "https://channel.io/kr/careers/devops-1"
    assert opening.title == "DevOps Engineer"
    assert opening.employment_type == "정규직"
    assert opening.career_type == "mixed"
    assert opening.location == "Gangnam District, Seoul"
    assert opening.opens_at is not None

    matches = {
        match.skill: match.requirement_type
        for match in extract_skill_matches(
            title=opening.title,
            description_html=opening.description_html,
            description_text=opening.description_text,
        )
    }
    assert matches["Kubernetes"] == RequirementType.REQUIRED
    assert matches["Terraform"] == RequirementType.PREFERRED


def test_channel_parser_rejects_incomplete_job_records() -> None:
    html = _next_data_html([{"id": "missing-title"}])

    try:
        parse_channel_openings(html, "https://channel.io/kr/careers")
    except ValueError as error:
        assert "missing a title" in str(error)
    else:
        raise AssertionError("Malformed Channel jobs must fail closed")
