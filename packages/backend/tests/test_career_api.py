from datetime import datetime, timezone

from fastapi.testclient import TestClient

from ejikfit.api.app import create_app


class FakeCareerReader:
    def snapshot(self) -> list[dict]:
        now = datetime(2026, 7, 31, tzinfo=timezone.utc)
        return [
            {
                "id": "00000000-0000-0000-0000-000000000001",
                "title": "Backend Engineer",
                "company_name": "테스트 기업",
                "company_slug": "test-company",
                "career_type": "experienced",
                "employment_type": "FULL_TIME_WORKER",
                "career_min": 3,
                "career_max": 8,
                "location": "서울",
                "status": "open",
                "source_url": "https://example.com/backend",
                "first_seen_at": now,
                "last_verified_at": now,
                "opens_at": None,
                "closes_at": None,
                "required_skills": ["Java", "Spring Boot"],
                "preferred_skills": ["Docker"],
                "unspecified_skills": [],
                "description_excerpt": "결제 API와 백엔드 서비스를 개발합니다.",
            }
        ]


def test_career_analysis_contract_is_private_and_uses_full_profile() -> None:
    client = TestClient(create_app(career_analysis_reader=FakeCareerReader()))
    response = client.post(
        "/api/career/analyze",
        json={
            "profile": {
                "current_role": "백엔드 엔지니어",
                "experience_years": 5,
                "responsibilities": "결제 API 개발",
                "current_domain": "backend",
                "employment_types": ["full_time"],
            },
            "owned_skills": ["java", "Spring Boot"],
            "limit": 1,
            "offset": 0,
        },
    )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    body = response.json()
    assert body["version"] == "career-evidence-v3.0"
    assert body["recommendations"]["total"] == 1
    assert body["recommendations"]["items"][0]["posting"]["title"] == "Backend Engineer"
    assert body["directions"][0]["domain"] == "backend"
    assert body["connections"]["00000000-0000-0000-0000-000000000001"][
        "career_condition"
    ] == "continues"
