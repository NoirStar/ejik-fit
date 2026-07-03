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
