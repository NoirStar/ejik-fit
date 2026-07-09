from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit import seed_data
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    PolicyStatus,
    SourceStatus,
    SourceType,
)


def test_initial_sources_include_existing_greeting_pages_and_official_json_sources() -> None:
    greeting_slugs = {item.slug for item in seed_data.INITIAL_GREETING_SOURCES}
    catalog_by_slug = {item.slug: item for item in seed_data.INITIAL_SOURCE_CATALOG}

    assert {
        "kakaopay",
        "kakaomobility",
        "hyundai-autoever",
        "nextsecurities",
        "s2w",
    } <= greeting_slugs
    assert len(seed_data.INITIAL_GREETING_SOURCES) == 15
    assert all(
        item.source_type == SourceType.GREETING
        for item in seed_data.INITIAL_GREETING_SOURCES
    )

    assert catalog_by_slug["naver"].source_type == SourceType.NAVER_JSON
    assert catalog_by_slug["kakao"].source_type == SourceType.KAKAO_JSON
    assert catalog_by_slug["line-plus"].source_type == SourceType.LINE_GATSBY
    assert len({item.slug for item in seed_data.INITIAL_SOURCE_CATALOG}) == len(
        seed_data.INITIAL_SOURCE_CATALOG
    )
    assert len({item.base_url for item in seed_data.INITIAL_SOURCE_CATALOG}) == len(
        seed_data.INITIAL_SOURCE_CATALOG
    )
    assert all(
        item.base_url.startswith("https://")
        for item in seed_data.INITIAL_SOURCE_CATALOG
    )


def test_initial_sources_include_phase_two_enterprise_sources_with_lg_api_enabled() -> None:
    enterprise_slugs = {
        "samsung-electronics",
        "samsung-sds",
        "hyundai-motor",
        "kia",
        "lg-electronics",
        "lg-cns",
        "sk-hynix",
        "sk-telecom",
        "kt",
        "posco-dx",
        "cj-olivenetworks",
        "hanwha-systems",
    }
    catalog_by_slug = {item.slug: item for item in seed_data.INITIAL_SOURCE_CATALOG}

    assert enterprise_slugs <= set(catalog_by_slug)
    assert len(seed_data.INITIAL_SOURCE_CATALOG) == 30
    non_runnable_enterprise_slugs = enterprise_slugs - {
        "lg-cns",
        "lg-electronics",
    }
    assert all(
        catalog_by_slug[slug].status
        in {SourceStatus.NEEDS_CONNECTOR, SourceStatus.NEEDS_BROWSER}
        for slug in non_runnable_enterprise_slugs
    )
    assert all(
        catalog_by_slug[slug].policy_status == PolicyStatus.ALLOWED
        for slug in enterprise_slugs
    )
    assert catalog_by_slug["lg-electronics"].source_type == (
        SourceType.ENTERPRISE_JSON
    )
    assert catalog_by_slug["lg-electronics"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["lg-cns"].source_type == SourceType.ENTERPRISE_JSON
    assert catalog_by_slug["lg-cns"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["samsung-electronics"].source_type == (
        SourceType.BROWSER_PUBLIC_RENDER
    )
    assert catalog_by_slug["hyundai-motor"].source_type == (
        SourceType.HTML_LISTING_DETAIL
    )
    assert catalog_by_slug["lg-cns"].connector_family == "enterprise_json"


def test_seeding_sources_is_idempotent_and_persists_catalog_source_types() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        assert seed_data.seed_sources(session) == len(seed_data.INITIAL_SOURCE_CATALOG)
        assert seed_data.seed_sources(session) == 0
        assert len(session.scalars(select(Company)).all()) == len(
            seed_data.INITIAL_SOURCE_CATALOG
        )

        sources = session.scalars(select(CareerSource)).all()
        assert len(sources) == len(seed_data.INITIAL_SOURCE_CATALOG)
        actual_types = {source.company.slug: source.source_type for source in sources}
        assert actual_types["naver"] == SourceType.NAVER_JSON
        assert actual_types["kakao"] == SourceType.KAKAO_JSON
        assert actual_types["line-plus"] == SourceType.LINE_GATSBY

        sources_by_slug = {source.company.slug: source for source in sources}
        naver = sources_by_slug["naver"]
        assert naver.connector_family == "naver_json"
        assert naver.policy_status == PolicyStatus.ALLOWED
        assert naver.sector == "platform"
        assert naver.brand_tier_weight == 6
        assert naver.tech_job_priority == 5
        assert naver.expected_job_volume == 5
        assert naver.priority_score > sources_by_slug["deepauto-ai"].priority_score

        samsung = sources_by_slug["samsung-electronics"]
        assert samsung.status == SourceStatus.NEEDS_BROWSER
        assert samsung.policy_status == PolicyStatus.ALLOWED
        assert samsung.connector_family == "browser_public_render"
        assert samsung.sector == "enterprise_it"

        lg_electronics = sources_by_slug["lg-electronics"]
        assert lg_electronics.status == SourceStatus.ALLOWED
        assert lg_electronics.connector_family == "enterprise_json"
        assert lg_electronics.base_url == (
            "https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=20"
        )

        lg_cns = sources_by_slug["lg-cns"]
        assert lg_cns.status == SourceStatus.ALLOWED
        assert lg_cns.connector_family == "enterprise_json"
        assert lg_cns.base_url == (
            "https://api.careers.lg.com/rmk/job/retrieveJobNoticesList"
        )
        assert lg_cns.request_method == "POST"
        assert lg_cns.request_body == {
            "lnbSearch": "",
            "hashTagText": "",
            "recDate": "CREATION_DATE",
            "order": "DESC",
            "careerList": [],
            "companyCodeList": ["CNS"],
            "desireLocList": [],
            "jobGroupList": [],
        }

        hyundai = sources_by_slug["hyundai-motor"]
        assert hyundai.status == SourceStatus.NEEDS_CONNECTOR
        assert hyundai.connector_family == "html_listing_detail"


def test_seeding_sources_does_not_clear_blocked_policy_state() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        seed_data.seed_sources(session)
        source = session.scalar(
            select(CareerSource).join(Company).where(Company.slug == "naver")
        )
        assert source is not None
        source.status = SourceStatus.BLOCKED
        source.policy_status = PolicyStatus.BLOCKED
        source.last_error_code = "blocked"
        session.commit()

        assert seed_data.seed_sources(session) == 0

        assert source.status == SourceStatus.BLOCKED
        assert source.policy_status == PolicyStatus.BLOCKED
        assert source.last_error_code == "blocked"


def test_seeding_sources_does_not_clear_stopped_source_status() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        seed_data.seed_sources(session)
        source = session.scalar(
            select(CareerSource).join(Company).where(Company.slug == "hyundai-motor")
        )
        assert source is not None
        source.status = SourceStatus.STOPPED
        source.policy_status = PolicyStatus.STOPPED
        session.commit()

        assert seed_data.seed_sources(session) == 0

        assert source.status == SourceStatus.STOPPED
        assert source.policy_status == PolicyStatus.STOPPED
