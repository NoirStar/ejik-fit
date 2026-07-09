from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PolicyStatus,
    SourceStatus,
    SourceType,
)


def test_source_and_external_id_identify_one_posting() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="테스트 기업", slug="test-company")
        source = CareerSource(
            company=company,
            base_url="https://example.com/careers",
            source_type=SourceType.GREETING,
            status=SourceStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=source,
            external_id="123",
            url="https://example.com/o/123",
            title="Backend Engineer",
        )
        session.add(posting)
        session.commit()

        assert posting.company.slug == "test-company"
        assert posting.source.external_id_namespace == "greeting"


def test_official_json_source_namespaces_are_stable() -> None:
    assert SourceType.NAVER_JSON.value == "naver_json"
    assert SourceType.KAKAO_JSON.value == "kakao_json"
    assert SourceType.LINE_GATSBY.value == "line_gatsby"


def test_future_enterprise_source_namespaces_are_stable() -> None:
    assert SourceType.HTML_LISTING_DETAIL.value == "html_listing_detail"
    assert SourceType.STATIC_NEXT_DATA.value == "static_next_data"
    assert SourceType.ENTERPRISE_JSON.value == "enterprise_json"
    assert SourceType.LEVER_GREENHOUSE.value == "lever_greenhouse"
    assert SourceType.WORKDAY.value == "workday"
    assert SourceType.SAP_SUCCESSFACTORS.value == "sap_successfactors"
    assert SourceType.BROWSER_PUBLIC_RENDER.value == "browser_public_render"


def test_source_registry_status_namespaces_are_stable() -> None:
    assert SourceStatus.NEEDS_CONNECTOR.value == "needs_connector"
    assert SourceStatus.NEEDS_BROWSER.value == "needs_browser"
    assert SourceStatus.BLOCKED.value == "blocked"
    assert PolicyStatus.ALLOWED.value == "allowed"
    assert PolicyStatus.REVIEW.value == "review"
    assert PolicyStatus.BLOCKED.value == "blocked"
    assert PolicyStatus.STOPPED.value == "stopped"


def test_career_source_registry_defaults_and_priority_score() -> None:
    source = CareerSource(
        company=Company(name="테스트 기업", slug="test-company"),
        base_url="https://example.com/careers",
        source_type=SourceType.JSON_LD,
        status=SourceStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=4,
        expected_job_volume=3,
        connector_reuse_score=2,
        policy_risk=1,
        non_tech_noise=2,
    )

    assert source.policy_status == PolicyStatus.REVIEW
    assert source.connector_family == "json_ld"
    assert source.priority_score == 12
