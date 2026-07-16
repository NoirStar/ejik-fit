from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def test_production_crawler_is_remote_scheduled_and_serialized() -> None:
    workflow = (
        REPOSITORY_ROOT / ".github" / "workflows" / "crawl.yml"
    ).read_text()

    assert 'cron: "17 */6 * * *"' in workflow
    assert "workflow_dispatch:" in workflow
    assert "company_slug:" in workflow
    assert "IFS=',' read -r -a slugs" in workflow
    assert 'for slug in "${slugs[@]}"' in workflow
    assert 'ejikfit crawl-source --company-slug "$slug"' in workflow
    assert "cancel-in-progress: false" in workflow
    assert "timeout-minutes: 120" in workflow
    assert "ejikfit crawl-all" in workflow
    assert "pip install './packages/backend[browser]'" in workflow
    assert "python -m playwright install --with-deps chromium" in workflow
    assert "SEARCH_BACKEND: postgres" in workflow
    assert "POSTGRES_SEARCH_MODE: pgroonga" in workflow
    assert "secrets.CRAWLER_DATABASE_URL" in workflow
