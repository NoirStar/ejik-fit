from datetime import datetime, timezone

from fastapi.testclient import TestClient

from ejikfit.api.app import create_app


class FakePostingReader:
    def list(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        return [
            {
                "id": "00000000-0000-0000-0000-000000000001",
                "title": "신입 백엔드 개발자",
                "company_name": "테스트 기업",
                "career_type": "new_comer",
                "location": "서울",
                "source_url": "https://example.com/o/1",
                "last_verified_at": datetime(
                    2026,
                    7,
                    3,
                    tzinfo=timezone.utc,
                ),
            }
        ]


def test_list_postings_exposes_source_and_verification_time() -> None:
    app = create_app(posting_reader=FakePostingReader())
    response = TestClient(app).get(
        "/api/postings?career_type=new_comer"
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["source_url"] == "https://example.com/o/1"
    assert item["last_verified_at"] == "2026-07-03T00:00:00Z"
