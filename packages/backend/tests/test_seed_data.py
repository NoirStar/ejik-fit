from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit import seed_data
from ejikfit.models import Base, CareerSource, Company, SourceType


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
