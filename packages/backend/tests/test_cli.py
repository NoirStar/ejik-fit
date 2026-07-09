import json
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ejikfit import cli
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    PolicyStatus,
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


def test_preview_source_prints_json_report(monkeypatch, capsys) -> None:
    report = {
        "source_id": "source-1",
        "source_label": "현대자동차 / html_listing_detail",
        "source_type": "html_listing_detail",
        "discovered": 1,
        "sample_openings": [
            {
                "external_id": "backend-1",
                "title": "Backend Engineer",
                "url": "https://example.com/jobs/backend-1",
            }
        ],
        "error": None,
    }
    monkeypatch.setattr("ejikfit.crawler.preview_source_by_id", lambda source_id: report)

    assert cli.main(["preview-source", "00000000-0000-0000-0000-000000000001"]) == 0
    assert json.loads(capsys.readouterr().out) == report


def test_set_source_status_promotes_source_and_clears_stale_errors(
    monkeypatch,
    capsys,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    source_id = uuid.UUID("00000000-0000-0000-0000-000000000002")

    with Session(engine) as session:
        session.add(
            CareerSource(
                id=source_id,
                company=Company(name="현대자동차", slug="hyundai-motor"),
                base_url="https://talent.hyundai.com/eng/apply/applyList.hc",
                source_type=SourceType.HTML_LISTING_DETAIL,
                status=SourceStatus.NEEDS_CONNECTOR,
                policy_status=PolicyStatus.ALLOWED,
                last_error_code="unsupported_connector",
                last_error_reason="previous failure",
            )
        )
        session.commit()

    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(engine))

    assert cli.main(["set-source-status", str(source_id), "allowed"]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output == {
        "source_id": str(source_id),
        "source_label": "현대자동차 / html_listing_detail",
        "status": "allowed",
        "policy_status": "allowed",
        "last_error_code": None,
    }

    with Session(engine) as session:
        source = session.get(CareerSource, source_id)
        assert source is not None
        assert source.status == SourceStatus.ALLOWED
        assert source.policy_status == PolicyStatus.ALLOWED
        assert source.last_error_code is None
        assert source.last_error_reason is None


def test_set_source_status_accepts_policy_status_override(
    monkeypatch,
    capsys,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    source_id = uuid.UUID("00000000-0000-0000-0000-000000000003")

    with Session(engine) as session:
        session.add(
            CareerSource(
                id=source_id,
                company=Company(name="테스트 기업", slug="test-company"),
                base_url="https://example.com/careers",
                source_type=SourceType.JSON_LD,
                status=SourceStatus.ALLOWED,
                policy_status=PolicyStatus.ALLOWED,
            )
        )
        session.commit()

    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(engine))

    assert (
        cli.main(
            [
                "set-source-status",
                str(source_id),
                "blocked",
                "--policy-status",
                "blocked",
            ]
        )
        == 0
    )
    output = json.loads(capsys.readouterr().out)
    assert output["status"] == "blocked"
    assert output["policy_status"] == "blocked"

    with Session(engine) as session:
        source = session.get(CareerSource, source_id)
        assert source is not None
        assert source.status == SourceStatus.BLOCKED
        assert source.policy_status == PolicyStatus.BLOCKED
