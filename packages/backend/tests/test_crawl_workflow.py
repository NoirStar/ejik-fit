from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def test_production_crawler_is_remote_scheduled_and_serialized() -> None:
    workflow = (
        REPOSITORY_ROOT / ".github" / "workflows" / "crawl.yml"
    ).read_text()

    assert 'cron: "17 */6 * * *"' in workflow
    assert "workflow_dispatch:" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "ejikfit crawl-all" in workflow
    assert "SEARCH_BACKEND: postgres" in workflow
    assert "POSTGRES_SEARCH_MODE: pgroonga" in workflow
    assert "secrets.CRAWLER_DATABASE_URL" in workflow
