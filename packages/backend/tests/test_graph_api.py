from fastapi.testclient import TestClient

from ejikfit.api.app import create_app


class FakeSkillGraphReader:
    def graph(
        self,
        seed: str | None = None,
        owned_skills: list[str] | None = None,
        career_type: str | None = None,
        limit: int = 30,
        include_evidence: bool = False,
    ) -> dict:
        return {
            "seed": seed,
            "nodes": [
                {
                    "id": "C++",
                    "label": "C++",
                    "category": "language",
                    "kind": "language",
                    "domains": ["robotics", "embedded"],
                    "demand_count": 6,
                    "required_count": 6,
                    "preferred_count": 0,
                    "unspecified_count": 0,
                    "owned": True,
                    "seed": True,
                }
            ],
            "edges": [],
            "evidence": [],
            "meta": {
                "limit": limit,
                "min_confidence": 0.8,
            },
        }

    def evidence(
        self,
        skill: str,
        career_type: str | None = None,
        limit: int = 6,
    ) -> dict:
        return {
            "items": [
                {
                    "posting_id": "job-1",
                    "title": "Python Backend Engineer",
                    "company_name": "검증 기업",
                    "skills": ["Python"],
                    "required": ["Python"],
                    "preferred": [],
                    "unspecified": [],
                }
            ],
            "total": 1,
        }


class RecordingSkillGraphReader(FakeSkillGraphReader):
    def __init__(self) -> None:
        self.seed: str | None = None
        self.owned_skills: list[str] = []
        self.include_evidence: bool | None = None
        self.evidence_call: tuple[str, str | None, int] | None = None

    def graph(
        self,
        seed: str | None = None,
        owned_skills: list[str] | None = None,
        career_type: str | None = None,
        limit: int = 30,
        include_evidence: bool = False,
    ) -> dict:
        self.seed = seed
        self.owned_skills = owned_skills or []
        self.include_evidence = include_evidence
        return super().graph(
            seed,
            owned_skills,
            career_type,
            limit,
            include_evidence,
        )

    def evidence(
        self,
        skill: str,
        career_type: str | None = None,
        limit: int = 6,
    ) -> dict:
        self.evidence_call = (skill, career_type, limit)
        return super().evidence(skill, career_type, limit)


def test_skill_graph_endpoint_returns_graph_contract() -> None:
    app = create_app(skill_graph_reader=FakeSkillGraphReader())
    response = TestClient(app).get(
        "/api/graph/skills?seed=C%2B%2B&owned_skills=C%2B%2B&limit=10"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["seed"] == "C++"
    assert body["nodes"][0]["owned"] is True
    assert body["nodes"][0]["domains"] == ["robotics", "embedded"]
    assert body["meta"] == {"limit": 10, "min_confidence": 0.8}


def test_skill_graph_endpoint_validates_limit_bounds() -> None:
    app = create_app(skill_graph_reader=FakeSkillGraphReader())
    response = TestClient(app).get("/api/graph/skills?limit=1000")

    assert response.status_code == 422


def test_skill_graph_endpoint_canonicalizes_explicit_skill_inputs() -> None:
    reader = RecordingSkillGraphReader()
    app = create_app(skill_graph_reader=reader)

    response = TestClient(app).get(
        "/api/graph/skills?seed=python&owned_skills=PYTHON&owned_skills=k8s"
    )

    assert response.status_code == 200
    assert reader.seed == "Python"
    assert reader.owned_skills == ["Python", "Kubernetes"]


def test_skill_graph_endpoint_omits_evidence_by_default_and_sets_public_cache() -> None:
    reader = RecordingSkillGraphReader()
    app = create_app(skill_graph_reader=reader)

    response = TestClient(app).get("/api/graph/skills?limit=10")

    assert response.status_code == 200
    assert response.json()["evidence"] == []
    assert reader.include_evidence is False
    assert response.headers["cache-control"] == (
        "public, s-maxage=300, stale-while-revalidate=900"
    )


def test_skill_graph_endpoint_disables_shared_cache_for_owned_skills() -> None:
    app = create_app(skill_graph_reader=FakeSkillGraphReader())

    response = TestClient(app).get("/api/graph/skills?owned_skills=Python")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"


def test_skill_graph_evidence_endpoint_canonicalizes_and_bounds_selection() -> None:
    reader = RecordingSkillGraphReader()
    app = create_app(skill_graph_reader=reader)

    response = TestClient(app).get(
        "/api/graph/skills/evidence?skill=python&career_type=experienced&limit=6"
    )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "posting_id": "job-1",
                "title": "Python Backend Engineer",
                "company_name": "검증 기업",
                "skills": ["Python"],
                "required": ["Python"],
                "preferred": [],
                "unspecified": [],
            }
        ],
        "total": 1,
    }
    assert reader.evidence_call == ("Python", "experienced", 6)
    assert response.headers["cache-control"] == (
        "public, s-maxage=300, stale-while-revalidate=900"
    )
