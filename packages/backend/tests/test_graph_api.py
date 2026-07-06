from fastapi.testclient import TestClient

from ejikfit.api.app import create_app


class FakeSkillGraphReader:
    def graph(
        self,
        seed: str | None = None,
        owned_skills: list[str] | None = None,
        career_type: str | None = None,
        limit: int = 30,
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
