from datetime import datetime, timezone

from ejikfit.career_analysis import analyze_career


NOW = datetime(2026, 7, 31, tzinfo=timezone.utc)


def posting(
    identifier: str,
    title: str,
    description: str,
    *,
    career_min: int | None = None,
    employment_type: str = "FULL_TIME_WORKER",
    required: list[str] | None = None,
    preferred: list[str] | None = None,
) -> dict:
    return {
        "id": identifier,
        "title": title,
        "company_name": f"기업 {identifier}",
        "company_slug": f"company-{identifier}",
        "career_type": "experienced" if career_min else "mixed",
        "employment_type": employment_type,
        "career_min": career_min,
        "career_max": None,
        "location": "서울",
        "status": "open",
        "source_url": f"https://example.com/{identifier}",
        "first_seen_at": NOW,
        "last_verified_at": NOW,
        "opens_at": None,
        "closes_at": None,
        "required_skills": required or [],
        "preferred_skills": preferred or [],
        "unspecified_skills": [],
        "description_excerpt": description,
    }


def backend_profile(**overrides) -> dict:
    profile = {
        "current_role": "백엔드 엔지니어",
        "past_roles": ["서버 개발자"],
        "experience_years": 5,
        "responsibilities": "결제 API 개발과 Java Spring 서비스 운영",
        "experience_highlights": [],
        "work_types": ["development", "operations"],
        "industry_experience": ["핀테크", "결제"],
        "current_domain": "backend",
        "interest_domains": ["devops"],
        "excluded_domains": ["ai"],
        "preferred_locations": ["seoul"],
        "employment_types": ["full_time"],
        "career_level": "mid",
        "skill_usage": {
            "Java": {"years": 5, "last_used": "current"},
            "Spring Boot": {"years": 4, "last_used": "current"},
        },
    }
    profile.update(overrides)
    return profile


def test_analysis_filters_and_ranks_before_pagination() -> None:
    postings = [
        posting(
            f"backend-{index}",
            "Backend Engineer",
            "결제 API와 백엔드 서비스를 개발합니다.",
            career_min=3,
            required=["Java", "Spring Boot"],
        )
        for index in range(4)
    ] + [
        posting(
            "frontend",
            "FDE팀 Frontend Engineer",
            "서비스 운영과 장애 대응 경험을 우대합니다.",
            career_min=3,
            required=["React"],
        )
    ]

    result = analyze_career(
        profile=backend_profile(),
        owned_skills=["Java", "Spring Boot"],
        postings=postings,
        limit=2,
        offset=2,
    )

    assert result["recommendations"]["total"] == 4
    assert [item["posting"]["id"] for item in result["recommendations"]["items"]] == [
        "backend-2",
        "backend-3",
    ]
    assert "frontend" not in {
        item["posting"]["id"] for item in result["recommendations"]["items"]
    }


def test_analysis_rejects_hard_career_and_employment_mismatches() -> None:
    postings = [
        posting(
            "too-senior",
            "Backend Engineer",
            "Java API 개발",
            career_min=10,
            required=["Java"],
        ),
        posting(
            "contract",
            "Backend Engineer",
            "Java API 개발",
            employment_type="CONTRACT_WORKER",
            required=["Java"],
        ),
    ]

    result = analyze_career(
        profile=backend_profile(),
        owned_skills=["Java"],
        postings=postings,
        limit=20,
        offset=0,
    )

    assert result["recommendations"]["total"] == 0
    assert result["connections"]["too-senior"]["career_condition"] == "changes"
    assert result["connections"]["contract"]["employment_condition"] == "changes"


def test_analysis_uses_one_domain_for_representative_jobs_and_respects_exclusions() -> None:
    postings = [
        posting(
            "backend",
            "Backend Engineer",
            "결제 API와 Spring 서비스를 개발합니다.",
            required=["Java", "Spring Boot"],
        ),
        posting(
            "ai",
            "AI Inference Software Engineer",
            "Python 모델 추론과 서비스 운영",
            required=["Python", "CUDA"],
        ),
    ]

    result = analyze_career(
        profile=backend_profile(),
        owned_skills=["Java", "Spring Boot"],
        postings=postings,
        limit=20,
        offset=0,
    )

    directions = {item["domain"]: item for item in result["directions"]}
    assert "ai" not in directions
    assert directions["backend"]["representative_job"]["id"] == "backend"
    assert result["connections"]["ai"]["recommendation_eligible"] is False


def test_analysis_is_deterministic_for_the_same_profile_and_snapshot() -> None:
    postings = [
        posting(
            "backend",
            "Backend Engineer",
            "Java API 개발",
            required=["Java"],
        )
    ]
    first = analyze_career(
        profile=backend_profile(),
        owned_skills=["Java"],
        postings=postings,
        limit=20,
        offset=0,
    )
    second = analyze_career(
        profile=backend_profile(),
        owned_skills=["Java"],
        postings=postings,
        limit=20,
        offset=0,
    )

    assert first["snapshot_id"] == second["snapshot_id"]
    assert first["directions"] == second["directions"]
    assert first["recommendations"] == second["recommendations"]
