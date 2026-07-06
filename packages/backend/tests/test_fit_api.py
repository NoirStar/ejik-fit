from fastapi.testclient import TestClient

from ejikfit.api.app import create_app


class FakeFitAnalysisReader:
    def analyze(
        self,
        owned_skills: list[str],
        career_type: str | None = None,
        domains: list[str] | None = None,
    ) -> dict:
        return {
            "coverage": {
                "matching_posting_count": 2,
                "strong_fit_posting_count": 1,
            },
            "domain_branches": [
                {
                    "domain": "robotics",
                    "covered_skills": ["C++"],
                    "missing_required_skills": ["ROS", "Linux"],
                    "missing_preferred_skills": ["SLAM"],
                    "supporting_posting_count": 2,
                }
            ],
            "recommended_next_skills": [
                {
                    "skill": "ROS",
                    "reason": "보유 스킬과 함께 등장한 공고에서 2회 부족 요구사항으로 확인됨",
                    "required_count": 1,
                    "preferred_count": 1,
                    "supporting_posting_count": 2,
                }
            ],
        }


def test_fit_endpoint_returns_requirement_coverage() -> None:
    app = create_app(fit_analysis_reader=FakeFitAnalysisReader())
    response = TestClient(app).post(
        "/api/fit/analyze",
        json={"owned_skills": ["C++"], "domains": ["robotics"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["coverage"]["matching_posting_count"] == 2
    assert body["domain_branches"][0]["missing_required_skills"] == ["ROS", "Linux"]
    assert body["recommended_next_skills"][0]["skill"] == "ROS"


def test_fit_endpoint_requires_owned_skills() -> None:
    app = create_app(fit_analysis_reader=FakeFitAnalysisReader())
    response = TestClient(app).post("/api/fit/analyze", json={"owned_skills": []})

    assert response.status_code == 422
