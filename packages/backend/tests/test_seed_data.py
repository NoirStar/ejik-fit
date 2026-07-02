from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit.models import Base, CareerSource, Company
from ejikfit.seed_data import INITIAL_GREETING_SOURCES, seed_sources


def test_initial_sources_are_ten_unique_official_greeting_pages() -> None:
    assert len(INITIAL_GREETING_SOURCES) == 10
    assert len({item.slug for item in INITIAL_GREETING_SOURCES}) == 10
    assert len({item.base_url for item in INITIAL_GREETING_SOURCES}) == 10
    assert all(item.base_url.startswith("https://") for item in INITIAL_GREETING_SOURCES)
    assert all(
        "career.greetinghr.com" in item.base_url
        for item in INITIAL_GREETING_SOURCES
    )


def test_seeding_sources_is_idempotent() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        assert seed_sources(session) == 10
        assert seed_sources(session) == 0
        assert len(session.scalars(select(Company)).all()) == 10
        assert len(session.scalars(select(CareerSource)).all()) == 10
