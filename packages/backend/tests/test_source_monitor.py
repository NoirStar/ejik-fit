from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    JobRevision,
    PostingSkill,
    PostingStatus,
    RawSnapshot,
    SourceStatus,
    SourceType,
)
from ejikfit.source_monitor import (
    build_source_monitor_report,
    render_source_monitor_markdown,
)


def test_build_source_monitor_report_summarizes_recent_activity_and_health() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, 12, tzinfo=timezone.utc)
    recent = now - timedelta(hours=2)
    old = now - timedelta(days=3)

    with Session(engine) as session:
        healthy_company = Company(name="네이버", slug="naver")
        stale_company = Company(name="현대자동차", slug="hyundai")
        failing_company = Company(name="LG CNS", slug="lg-cns")
        blocked_company = Company(name="차단 기업", slug="blocked")
        pending_company = Company(name="검토 기업", slug="pending")

        healthy_source = CareerSource(
            company=healthy_company,
            base_url="https://recruit.navercorp.com/jobs",
            source_type=SourceType.NAVER_JSON,
            status=SourceStatus.ALLOWED,
            connector_family="naver_json",
            last_success_at=recent,
        )
        stale_source = CareerSource(
            company=stale_company,
            base_url="https://hyundai.example/jobs",
            source_type=SourceType.HTML_LISTING_DETAIL,
            status=SourceStatus.ALLOWED,
            connector_family="html_listing_detail",
            last_success_at=old,
        )
        failing_source = CareerSource(
            company=failing_company,
            base_url="https://lg.example/jobs",
            source_type=SourceType.STATIC_NEXT_DATA,
            status=SourceStatus.ALLOWED,
            connector_family="static_next_data",
            last_success_at=old,
            last_error_code="temporary_fetch_error",
            last_error_reason="temporary upstream status 503",
        )
        blocked_source = CareerSource(
            company=blocked_company,
            base_url="https://blocked.example/jobs",
            source_type=SourceType.HTML_LISTING_DETAIL,
            status=SourceStatus.BLOCKED,
            connector_family="html_listing_detail",
            last_error_code="blocked",
        )
        pending_source = CareerSource(
            company=pending_company,
            base_url="https://pending.example/jobs",
            source_type=SourceType.SITEMAP_DISCOVERY,
            status=SourceStatus.NEEDS_CONNECTOR,
            connector_family="sitemap_discovery",
        )
        session.add_all(
            [
                healthy_source,
                stale_source,
                failing_source,
                blocked_source,
                pending_source,
            ]
        )
        session.flush()

        healthy_posting = JobPosting(
            company=healthy_company,
            source=healthy_source,
            external_id="naver-1",
            url="https://recruit.navercorp.com/jobs/1",
            title="Backend Engineer",
            status=PostingStatus.OPEN,
            first_seen_at=recent,
            last_seen_at=recent,
            last_verified_at=recent,
        )
        stale_posting = JobPosting(
            company=stale_company,
            source=stale_source,
            external_id="hyundai-1",
            url="https://hyundai.example/jobs/1",
            title="Platform Engineer",
            status=PostingStatus.OPEN,
            first_seen_at=old,
            last_seen_at=old,
            last_verified_at=old,
        )
        closed_posting = JobPosting(
            company=failing_company,
            source=failing_source,
            external_id="lg-closed",
            url="https://lg.example/jobs/closed",
            title="Closed Engineer",
            status=PostingStatus.CLOSED,
            first_seen_at=old,
            last_seen_at=old,
            last_verified_at=recent,
        )
        session.add_all([healthy_posting, stale_posting, closed_posting])
        session.flush()
        session.add(
            PostingSkill(
                posting_id=healthy_posting.id,
                skill="Python",
                category="language",
            )
        )
        snapshot = RawSnapshot(
            source_id=healthy_source.id,
            url=healthy_posting.url,
            content_hash="hash",
            storage_key="memory://hash",
            fetched_at=recent,
            http_status=200,
        )
        session.add(snapshot)
        session.flush()
        session.add(
            JobRevision(
                posting_id=healthy_posting.id,
                snapshot_id=snapshot.id,
                content_hash="revision-hash",
                payload={"title": "Backend Engineer"},
                created_at=recent,
            )
        )
        session.commit()

        report = build_source_monitor_report(
            session,
            now=now,
            window_hours=24,
        )

    assert report["window_hours"] == 24
    assert report["totals"] == {
        "sources": 5,
        "allowed_sources": 3,
        "healthy_sources": 1,
        "stale_allowed_sources": 1,
        "failing_sources": 2,
        "blocked_sources": 1,
        "open_postings": 2,
        "new_postings": 1,
        "seen_postings": 1,
        "changed_postings": 1,
        "closed_postings": 1,
        "tech_job_ratio": 0.5,
    }

    by_slug = {source["company_slug"]: source for source in report["sources"]}
    assert by_slug["naver"]["health_status"] == "healthy"
    assert by_slug["hyundai"]["health_status"] == "stale"
    assert by_slug["lg-cns"]["health_status"] == "failing"
    assert by_slug["blocked"]["health_status"] == "blocked"
    assert by_slug["pending"]["health_status"] == "pending"
    assert by_slug["naver"]["new_postings"] == 1
    assert by_slug["naver"]["changed_postings"] == 1
    assert by_slug["lg-cns"]["closed_postings"] == 1
    assert report["connector_family_health"]["naver_json"]["tech_job_ratio"] == 1.0
    assert report["connector_family_health"]["html_listing_detail"]["sources"] == 2
    assert report["top_stale_sources"][0]["company_slug"] == "hyundai"
    assert report["top_failing_sources"][0]["company_slug"] in {"blocked", "lg-cns"}


def test_render_source_monitor_markdown_includes_health_tables() -> None:
    report = {
        "window_hours": 24,
        "generated_at": "2026-07-09T12:00:00+00:00",
        "since": "2026-07-08T12:00:00+00:00",
        "totals": {
            "sources": 2,
            "allowed_sources": 1,
            "healthy_sources": 1,
            "stale_allowed_sources": 0,
            "failing_sources": 1,
            "blocked_sources": 1,
            "open_postings": 3,
            "new_postings": 2,
            "seen_postings": 2,
            "changed_postings": 1,
            "closed_postings": 1,
            "tech_job_ratio": 0.67,
        },
        "connector_family_health": {
            "naver_json": {
                "sources": 1,
                "allowed_sources": 1,
                "healthy_sources": 1,
                "failing_sources": 0,
                "stale_allowed_sources": 0,
                "open_postings": 3,
                "new_postings": 2,
                "changed_postings": 1,
                "tech_job_ratio": 0.67,
            }
        },
        "top_stale_sources": [],
        "top_failing_sources": [
            {
                "company_name": "LG CNS",
                "source_type": "static_next_data",
                "health_status": "failing",
                "last_error_code": "temporary_fetch_error",
            }
        ],
        "sources": [],
    }

    markdown = render_source_monitor_markdown(report)

    assert "## 공식 출처 모니터" in markdown
    assert "| 신규 공고 | 2 |" in markdown
    assert "| naver_json | 1 | 0 | 0 | 3 | 2 | 1 | 0.67 |" in markdown
    assert "| LG CNS | static_next_data | failing | temporary_fetch_error |" in markdown
