from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
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
