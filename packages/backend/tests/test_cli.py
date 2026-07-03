import json
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ejikfit import cli
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    SourceStatus,
    SourceType,
)


def test_list_sources_prints_machine_readable_first_id(
    monkeypatch,
    capsys,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    source_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

    with Session(engine) as session:
        session.add(
            CareerSource(
                id=source_id,
                company=Company(name="테스트 기업", slug="test-company"),
                base_url="https://example.com/careers",
                source_type=SourceType.JSON_LD,
                status=SourceStatus.ALLOWED,
            )
        )
        session.commit()

    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(engine))

    assert cli.main(["list-sources", "--first-id"]) == 0
    assert capsys.readouterr().out.strip() == str(source_id)


def test_crawl_all_writes_github_summary_and_returns_partial_failure(
    monkeypatch,
    capsys,
    tmp_path,
) -> None:
    report = {
        "sources": 1,
        "discovered": 3,
        "ingested": 2,
        "failed": 1,
        "closed": 0,
        "results": [
            {
                "source_id": "source-1",
                "discovered": 3,
                "ingested": 2,
                "failed": 1,
                "closed": 0,
            }
        ],
    }
    summary_path = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary_path))
    monkeypatch.setattr("ejikfit.crawler.run_all_sources", lambda: report)

    assert cli.main(["crawl-all"]) == 1
    assert json.loads(capsys.readouterr().out) == report
    summary = summary_path.read_text()
    assert "원격 수집 결과" in summary
    assert "source-1" in summary
    assert "| 합계 | 3 | 2 | 1 | 0 |" in summary
