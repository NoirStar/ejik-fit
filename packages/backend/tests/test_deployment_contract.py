import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def test_vercel_projects_target_seoul_and_keep_secrets_server_side() -> None:
    web = json.loads(
        (REPOSITORY_ROOT / "apps" / "web" / "vercel.json").read_text()
    )
    api = json.loads(
        (
            REPOSITORY_ROOT
            / "packages"
            / "backend"
            / "vercel.json"
        ).read_text()
    )

    assert web["regions"] == ["icn1"]
    assert api["regions"] == ["icn1"]
    assert api["framework"] == "fastapi"
    assert "NEXT_PUBLIC_DATABASE_URL" not in json.dumps(web)
