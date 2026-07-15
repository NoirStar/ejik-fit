from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PolicyStatus,
    PostingStatus,
    SourceStatus,
    SourceType,
)
from ejikfit.source_report import build_source_report, render_source_report_markdown


def test_build_source_report_summarizes_status_policy_errors_and_open_counts() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)

    with Session(engine) as session:
        naver = Company(name="네이버", slug="naver")
        hyundai = Company(name="현대자동차", slug="hyundai-motor")
        lg = Company(name="LG CNS", slug="lg-cns")
        naver_source = CareerSource(
            company=naver,
            base_url="https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
            source_type=SourceType.NAVER_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
            connector_family="naver_json",
            sector="platform",
            brand_tier_weight=6,
            tech_job_priority=5,
            expected_job_volume=5,
            connector_reuse_score=2,
            last_success_at=now,
        )
        hyundai_source = CareerSource(
            company=hyundai,
            base_url="https://talent.hyundai.com/eng/apply/applyList.hc",
            source_type=SourceType.HTML_LISTING_DETAIL,
            status=SourceStatus.NEEDS_CONNECTOR,
            policy_status=PolicyStatus.ALLOWED,
            connector_family="html_listing_detail",
            sector="enterprise_it",
            brand_tier_weight=6,
            tech_job_priority=4,
            expected_job_volume=4,
            connector_reuse_score=2,
            non_tech_noise=3,
            last_error_code="unsupported_connector",
            last_error_reason="connector is not implemented",
        )
        lg_source = CareerSource(
            company=lg,
            base_url="https://careers.lg.com/apply?c=CNS",
            source_type=SourceType.STATIC_NEXT_DATA,
            status=SourceStatus.BLOCKED,
            policy_status=PolicyStatus.BLOCKED,
            connector_family="static_next_data",
            sector="enterprise_it",
            brand_tier_weight=5,
            tech_job_priority=5,
            expected_job_volume=3,
            connector_reuse_score=2,
            last_error_code="blocked",
        )
        session.add_all([naver_source, hyundai_source, lg_source])
        session.flush()
        session.add_all(
            [
                JobPosting(
                    company=naver,
                    source=naver_source,
                    external_id="naver-1",
                    url="https://recruit.navercorp.com/rcrt/view.do?annoId=1",
                    title="Backend Engineer",
                    status=PostingStatus.OPEN,
                ),
                JobPosting(
                    company=naver,
                    source=naver_source,
                    external_id="naver-closed",
                    url="https://recruit.navercorp.com/rcrt/view.do?annoId=2",
                    title="Closed Role",
                    status=PostingStatus.CLOSED,
                ),
                JobPosting(
                    company=lg,
                    source=lg_source,
                    external_id="lg-1",
                    url="https://careers.lg.com/jobs/1",
                    title="Data Engineer",
                    status=PostingStatus.OPEN,
                ),
            ]
        )
        session.commit()

        report = build_source_report(session)

    assert report["totals"] == {
        "sources": 3,
        "open_postings": 2,
        "allowed_sources": 1,
        "runnable_sources": 1,
        "blocked_sources": 1,
    }
    assert report["status_counts"] == {
        "allowed": 1,
        "blocked": 1,
        "needs_connector": 1,
    }
    assert report["policy_status_counts"] == {"allowed": 2, "blocked": 1}
    assert report["connector_family_counts"] == {
        "html_listing_detail": 1,
        "naver_json": 1,
        "static_next_data": 1,
    }
    assert report["error_counts"] == {"blocked": 1, "unsupported_connector": 1}

    by_slug = {source["company_slug"]: source for source in report["sources"]}
    assert by_slug["naver"]["open_postings"] == 1
    assert by_slug["lg-cns"]["open_postings"] == 1
    assert by_slug["hyundai-motor"]["open_postings"] == 0
    assert report["top_priority_sources"][0]["company_slug"] == "naver"
    assert report["top_error_sources"][0]["last_error_code"] in {
        "blocked",
        "unsupported_connector",
    }


def test_render_source_report_markdown_includes_distribution_and_top_sources() -> None:
    report = {
        "totals": {
            "sources": 2,
            "open_postings": 3,
            "allowed_sources": 1,
            "runnable_sources": 1,
            "blocked_sources": 1,
        },
        "status_counts": {"allowed": 1, "blocked": 1},
        "policy_status_counts": {"allowed": 1, "blocked": 1},
        "connector_family_counts": {"naver_json": 1, "static_next_data": 1},
        "error_counts": {"blocked": 1},
        "top_priority_sources": [
            {
                "company_name": "네이버",
                "source_type": "naver_json",
                "status": "allowed",
                "priority_score": 18,
                "open_postings": 3,
            }
        ],
        "top_error_sources": [
            {
                "company_name": "LG CNS",
                "source_type": "static_next_data",
                "status": "blocked",
                "last_error_code": "blocked",
                "last_error_reason": "source denied access with 403",
            }
        ],
        "sources": [],
    }

    markdown = render_source_report_markdown(report)

    assert "## 공식 출처 운영 리포트" in markdown
    assert "| 전체 출처 | 2 |" in markdown
    assert "| allowed | 1 |" in markdown
    assert "| naver_json | 1 |" in markdown
    assert "| 네이버 | naver_json | allowed | 18 | 3 |" in markdown
    assert "| LG CNS | static_next_data | blocked | blocked | source denied access with 403 |" in markdown
