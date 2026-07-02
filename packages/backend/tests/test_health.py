from fastapi.testclient import TestClient

from ejikfit.api.app import create_app


def test_health_returns_service_identity() -> None:
    response = TestClient(create_app()).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ejik-fit-api"}
