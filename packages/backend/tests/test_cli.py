import json
import uuid

import pytest
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


def _insert_source(
    engine,
    *,
    source_id: uuid.UUID,
    company_name: str = "LG CNS",
    company_slug: str = "lg-cns",
    source_type: SourceType = SourceType.STATIC_NEXT_DATA,
    status: SourceStatus = SourceStatus.NEEDS_CONNECTOR,
) -> None:
    with Session(engine) as session:
        session.add(
            CareerSource(
                id=source_id,
                company=Company(name=company_name, slug=company_slug),
                base_url=f"https://example.com/{company_slug}/{source_type.value}",
                source_type=source_type,
                status=status,
                policy_status=PolicyStatus.ALLOWED,
                last_error_code="unsupported_connector",
                last_error_reason="previous failure",
            )
        )
        session.commit()


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
    monkeypatch.setattr(
        "ejikfit.source_report.build_source_report",
        lambda session: {
            "totals": {
                "sources": 1,
                "open_postings": 2,
                "allowed_sources": 1,
                "blocked_sources": 0,
            },
            "status_counts": {"allowed": 1},
            "policy_status_counts": {"allowed": 1},
            "connector_family_counts": {"naver_json": 1},
            "error_counts": {},
            "top_priority_sources": [
                {
                    "company_name": "네이버",
                    "source_type": "naver_json",
                    "status": "allowed",
                    "priority_score": 18,
                    "open_postings": 2,
                }
            ],
            "top_error_sources": [],
            "sources": [],
        },
    )

    assert cli.main(["crawl-all"]) == 1
    assert json.loads(capsys.readouterr().out) == report
    summary = summary_path.read_text()
    assert "원격 수집 결과" in summary
    assert "source-1" in summary
    assert "| 합계 | 3 | 2 | 1 | 0 |" in summary
    assert "공식 출처 운영 리포트" in summary
    assert "| 네이버 | naver_json | allowed | 18 | 2 |" in summary


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


def test_preview_source_accepts_company_slug_selector(monkeypatch, capsys) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    source_id = uuid.UUID("00000000-0000-0000-0000-000000000010")
    _insert_source(engine, source_id=source_id)
    report = {
        "source_id": str(source_id),
        "source_label": "LG CNS / static_next_data",
        "source_type": "static_next_data",
        "discovered": 0,
        "sample_openings": [],
        "error": None,
    }
    called_with: list[str] = []

    def fake_preview(selected_source_id: str) -> dict:
        called_with.append(selected_source_id)
        return report

    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(engine))
    monkeypatch.setattr("ejikfit.crawler.preview_source_by_id", fake_preview)

    assert (
        cli.main(
            [
                "preview-source",
                "--company-slug",
                "lg-cns",
                "--source-type",
                "static_next_data",
            ]
        )
        == 0
    )
    assert called_with == [str(source_id)]
    assert json.loads(capsys.readouterr().out) == report


def test_crawl_source_accepts_company_slug_selector(monkeypatch, capsys) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    source_id = uuid.UUID("00000000-0000-0000-0000-000000000011")
    _insert_source(engine, source_id=source_id)
    report = {"discovered": 1, "ingested": 1, "failed": 0, "closed": 0}
    called_with: list[str] = []

    def fake_run(selected_source_id: str) -> dict:
        called_with.append(selected_source_id)
        return report

    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(engine))
    monkeypatch.setattr("ejikfit.crawler.run_source_by_id", fake_run)

    assert (
        cli.main(
            [
                "crawl-source",
                "--company-slug",
                "lg-cns",
                "--source-type",
                "static_next_data",
            ]
        )
        == 0
    )
    assert called_with == [str(source_id)]
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


def test_set_source_status_accepts_company_slug_selector(
    monkeypatch,
    capsys,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    source_id = uuid.UUID("00000000-0000-0000-0000-000000000012")
    _insert_source(engine, source_id=source_id)

    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(engine))

    assert (
        cli.main(
            [
                "set-source-status",
                "--company-slug",
                "lg-cns",
                "--source-type",
                "static_next_data",
                "--status",
                "allowed",
            ]
        )
        == 0
    )
    output = json.loads(capsys.readouterr().out)
    assert output == {
        "source_id": str(source_id),
        "source_label": "LG CNS / static_next_data",
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


def test_company_slug_selector_requires_source_type_for_multiple_sources(
    monkeypatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    source_id = uuid.UUID("00000000-0000-0000-0000-000000000013")
    _insert_source(engine, source_id=source_id)
    with Session(engine) as session:
        company = session.query(Company).filter_by(slug="lg-cns").one()
        session.add(
            CareerSource(
                id=uuid.UUID("00000000-0000-0000-0000-000000000014"),
                company=company,
                base_url="https://example.com/lg-cns/html",
                source_type=SourceType.HTML_LISTING_DETAIL,
                status=SourceStatus.NEEDS_CONNECTOR,
                policy_status=PolicyStatus.ALLOWED,
            )
        )
        session.commit()

    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(engine))

    with pytest.raises(ValueError, match="multiple career sources"):
        cli.main(["preview-source", "--company-slug", "lg-cns"])


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


def test_source_report_prints_json(monkeypatch, capsys) -> None:
    report = {
        "totals": {
            "sources": 1,
            "open_postings": 2,
            "allowed_sources": 1,
            "blocked_sources": 0,
        },
        "status_counts": {"allowed": 1},
        "policy_status_counts": {"allowed": 1},
        "connector_family_counts": {"naver_json": 1},
        "error_counts": {},
        "top_priority_sources": [],
        "top_error_sources": [],
        "sources": [],
    }
    monkeypatch.setattr("ejikfit.source_report.build_source_report", lambda session: report)
    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(create_engine("sqlite+pysqlite:///:memory:")))

    assert cli.main(["source-report"]) == 0
    assert json.loads(capsys.readouterr().out) == report


def test_source_report_prints_markdown(monkeypatch, capsys) -> None:
    report = {
        "totals": {
            "sources": 1,
            "open_postings": 2,
            "allowed_sources": 1,
            "blocked_sources": 0,
        },
        "status_counts": {"allowed": 1},
        "policy_status_counts": {"allowed": 1},
        "connector_family_counts": {"naver_json": 1},
        "error_counts": {},
        "top_priority_sources": [
            {
                "company_name": "네이버",
                "source_type": "naver_json",
                "status": "allowed",
                "priority_score": 18,
                "open_postings": 2,
            }
        ],
        "top_error_sources": [],
        "sources": [],
    }
    monkeypatch.setattr("ejikfit.source_report.build_source_report", lambda session: report)
    monkeypatch.setattr(cli, "SessionLocal", lambda: Session(create_engine("sqlite+pysqlite:///:memory:")))

    assert cli.main(["source-report", "--format", "markdown"]) == 0
    output = capsys.readouterr().out
    assert "공식 출처 운영 리포트" in output
    assert "| 네이버 | naver_json | allowed | 18 | 2 |" in output


def test_discover_sitemap_prints_json_candidates(monkeypatch, capsys) -> None:
    report = {
        "url": "https://example.com/sitemap.xml",
        "discovered": 2,
        "candidates": [
            {
                "url": "https://example.com/careers",
                "source": "sitemap",
                "reason": "career_url",
            },
            {
                "url": "https://example.com/jobs/backend",
                "source": "sitemap",
                "reason": "job_url",
            },
        ],
    }
    monkeypatch.setattr(cli, "_discover_sitemap", lambda url, sample_limit: report)

    assert cli.main(["discover-sitemap", "https://example.com/sitemap.xml"]) == 0
    assert json.loads(capsys.readouterr().out) == report
