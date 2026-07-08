from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit.models import Base, CareerSource, Company
from ejikfit.seed_data import INITIAL_GREETING_SOURCES, seed_sources


def test_initial_sources_include_high_recognition_official_greeting_pages() -> None:
    expected_slugs = {
        "kakaopay",
        "kakaomobility",
        "hyundai-autoever",
        "nextsecurities",
        "s2w",
    }
    actual_slugs = {item.slug for item in INITIAL_GREETING_SOURCES}

    assert expected_slugs <= actual_slugs
    assert len(INITIAL_GREETING_SOURCES) == 15
    assert len(actual_slugs) == len(INITIAL_GREETING_SOURCES)
    assert len({item.base_url for item in INITIAL_GREETING_SOURCES}) == len(
        INITIAL_GREETING_SOURCES
    )
    assert all(item.base_url.startswith("https://") for item in INITIAL_GREETING_SOURCES)
    assert all(
        "career.greetinghr.com" in item.base_url
        for item in INITIAL_GREETING_SOURCES
    )


def test_seeding_sources_is_idempotent() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        assert seed_sources(session) == len(INITIAL_GREETING_SOURCES)
        assert seed_sources(session) == 0
        assert len(session.scalars(select(Company)).all()) == len(
            INITIAL_GREETING_SOURCES
        )
        assert len(session.scalars(select(CareerSource)).all()) == len(
            INITIAL_GREETING_SOURCES
        )
