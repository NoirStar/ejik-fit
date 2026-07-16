from datetime import datetime, timezone

from fastapi.testclient import TestClient

from ejikfit.api.app import create_app


class FakePostingReader:
    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.count_calls: list[dict] = []

    def list(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        category: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        self.calls.append(
            {
                "q": q,
                "company": company,
                "career_type": career_type,
                "category": category,
                "limit": limit,
                "offset": offset,
            }
        )
        return [
            {
                "id": "00000000-0000-0000-0000-000000000001",
                "title": "신입 백엔드 개발자",
                "company_name": "테스트 기업",
                "company_slug": "test-company",
                "career_type": "new_comer",
                "location": "서울",
                "opens_at": datetime(2026, 7, 1, tzinfo=timezone.utc),
                "closes_at": datetime(2026, 7, 31, tzinfo=timezone.utc),
                "required_skills": ["Python"],
                "preferred_skills": ["Docker"],
                "unspecified_skills": ["Linux"],
                "source_url": "https://example.com/o/1",
                "first_seen_at": datetime(
                    2026,
                    7,
                    2,
                    tzinfo=timezone.utc,
                ),
                "last_verified_at": datetime(
                    2026,
                    7,
                    3,
                    tzinfo=timezone.utc,
                ),
            }
        ]

    def count(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        category: str | None = None,
    ) -> int:
        self.count_calls.append(
            {
                "q": q,
                "company": company,
                "career_type": career_type,
                "category": category,
            }
        )
        return 321

    def get(self, posting_id: str) -> dict | None:
        if posting_id != "00000000-0000-0000-0000-000000000001":
            return None
        return {
            "id": posting_id,
            "title": "백엔드 개발자",
            "company_name": "테스트 기업",
            "company_slug": "test-company",
            "location": "서울",
            "source_url": "https://example.com/o/1",
            "last_verified_at": datetime(
                2026,
                7,
                3,
                tzinfo=timezone.utc,
            ),
            "description_html": "<p>Go 개발</p>",
            "description_text": "Go 개발",
            "skills": ["Go"],
            "skill_details": [
                {
                    "skill": "Go",
                    "category": "language",
                    "requirement_type": "required",
                    "evidence_text": "Go 개발",
                    "confidence": 0.95,
                    "match_reason": "strict_alias_with_context",
                }
            ],
        }


def test_list_postings_exposes_source_and_verification_time() -> None:
    reader = FakePostingReader()
    app = create_app(posting_reader=reader)
    response = TestClient(app).get(
        "/api/postings?career_type=new_comer&category=backend&offset=40"
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["company_slug"] == "test-company"
    assert item["source_url"] == "https://example.com/o/1"
    assert item["first_seen_at"] == "2026-07-02T00:00:00Z"
    assert item["last_verified_at"] == "2026-07-03T00:00:00Z"
    assert item["opens_at"] == "2026-07-01T00:00:00Z"
    assert item["closes_at"] == "2026-07-31T00:00:00Z"
    assert item["required_skills"] == ["Python"]
    assert item["preferred_skills"] == ["Docker"]
    assert item["unspecified_skills"] == ["Linux"]
    assert response.json()["total"] == 321
    assert reader.calls == [
        {
            "q": None,
            "company": None,
            "career_type": "new_comer",
            "category": "backend",
            "limit": 20,
            "offset": 40,
        }
    ]
    assert reader.count_calls == [
        {
            "q": None,
            "company": None,
            "career_type": "new_comer",
            "category": "backend",
        }
    ]


def test_posting_detail_keeps_names_and_adds_structured_evidence() -> None:
    app = create_app(posting_reader=FakePostingReader())
    response = TestClient(app).get(
        "/api/postings/00000000-0000-0000-0000-000000000001"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["company_slug"] == "test-company"
    assert body["skills"] == ["Go"]
    assert body["skill_details"] == [
        {
            "skill": "Go",
            "category": "language",
            "requirement_type": "required",
            "evidence_text": "Go 개발",
            "confidence": 0.95,
            "match_reason": "strict_alias_with_context",
        }
    ]
