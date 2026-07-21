from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def test_production_crawler_is_remote_scheduled_and_serialized() -> None:
    workflow = (
        REPOSITORY_ROOT / ".github" / "workflows" / "crawl.yml"
    ).read_text()

    assert 'cron: "17 */6 * * *"' in workflow
    assert '"packages/backend/src/ejikfit/seed_data.py"' in workflow
    assert '"packages/backend/src/ejikfit/skill_catalog.py"' in workflow
    assert '"packages/backend/src/ejikfit/skill_extraction.py"' in workflow
    assert "workflow_dispatch:" in workflow
    assert "company_slug:" in workflow
    assert "IFS=',' read -r -a slugs" in workflow
    assert 'for slug in "${slugs[@]}"' in workflow
    assert 'ejikfit crawl-source --company-slug "$slug"' in workflow
    assert "cancel-in-progress: false" in workflow
    assert "timeout-minutes: 120" in workflow
    assert "ejikfit seed-sources" in workflow
    assert "ejikfit backfill-skills" in workflow
    assert "ejikfit crawl-all" in workflow
    assert "github.event_name == 'schedule'" in workflow
    assert "pip install './packages/backend'" in workflow
    assert "github.event_name == 'push'" in workflow
    assert "github.event_name != 'push'" in workflow
    assert "pip install './packages/backend[browser]'" in workflow
    assert "python -m playwright install --with-deps chromium" in workflow
    assert "Xvfb :99 -screen 0 1440x900x24" in workflow
    assert 'echo "DISPLAY=:99" >> "$GITHUB_ENV"' in workflow
    assert workflow.index("python -m playwright install --with-deps chromium") < (
        workflow.index("Xvfb :99 -screen 0 1440x900x24")
    )
    assert workflow.index("Xvfb :99 -screen 0 1440x900x24") < workflow.index(
        "ejikfit crawl-all"
    )
    assert "SEARCH_BACKEND: postgres" in workflow
    assert "POSTGRES_SEARCH_MODE: pgroonga" in workflow
    assert 'CRAWLER_MAX_WORKERS: "4"' in workflow
    assert "secrets.CRAWLER_DATABASE_URL" in workflow
