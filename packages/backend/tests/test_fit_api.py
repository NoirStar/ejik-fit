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


class RecordingFitAnalysisReader(FakeFitAnalysisReader):
    def __init__(self) -> None:
        self.owned_skills: list[str] = []

    def analyze(
        self,
        owned_skills: list[str],
        career_type: str | None = None,
        domains: list[str] | None = None,
    ) -> dict:
        self.owned_skills = owned_skills
        return super().analyze(owned_skills, career_type, domains)


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


def test_fit_endpoint_canonicalizes_explicit_skill_names() -> None:
    reader = RecordingFitAnalysisReader()
    app = create_app(fit_analysis_reader=reader)

    response = TestClient(app).post(
        "/api/fit/analyze",
        json={"owned_skills": [" python ", "PYTHON", "K8S", "Custom Tool"]},
    )

    assert response.status_code == 200
    assert reader.owned_skills == ["Python", "Kubernetes", "Custom Tool"]
