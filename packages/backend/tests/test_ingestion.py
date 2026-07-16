from dataclasses import replace
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit.connectors.types import ParsedOpening
from ejikfit.ingestion import ingest_opening
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    JobRevision,
    SourceStatus,
    SourceType,
)
from ejikfit.storage import MemorySnapshotStore


def test_ingestion_is_idempotent_and_versions_changes() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 3, tzinfo=timezone.utc)
    opening = ParsedOpening(
        external_id="1",
        url="https://example.com/o/1",
        title="Backend Engineer",
        status="open",
        description_html="<p>Python</p>",
        description_text="Python",
        employment_type="FULL_TIME",
        career_type="new_comer",
        career_min=None,
        career_max=None,
        location="서울",
        opens_at=None,
        closes_at=None,
    )

    with Session(engine) as session:
        company = Company(name="기업", slug="company")
        source = CareerSource(
            company=company,
            base_url="https://example.com",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        store = MemorySnapshotStore()

        first = ingest_opening(
            session,
            source,
            opening,
            "raw-v1",
            store,
            now,
        )
        same = ingest_opening(
            session,
            source,
            opening,
            "raw-v1",
            store,
            now,
        )
        changed = ingest_opening(
            session,
            source,
            replace(opening, title="Backend Engineer II"),
            "raw-v2",
            store,
            now,
        )

        assert first.created is True and first.revision_created is True
        assert same.created is False and same.revision_created is False
        assert changed.created is False and changed.revision_created is True
        assert len(session.scalars(select(JobRevision)).all()) == 2
        assert len(store.objects) == 2


def test_ingestion_reassigns_an_existing_url_to_its_scoped_source() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    opening = ParsedOpening(
        external_id="30005164",
        url="https://recruit.navercorp.com/rcrt/view.do?annoId=30005164",
        title="[SNOW] IT 보안 기술 담당",
        status="open",
        description_html="",
        description_text="Tech Security SNOW",
        employment_type="정규",
        career_type="experienced",
        career_min=None,
        career_max=None,
        location=None,
        opens_at=None,
        closes_at=None,
    )

    with Session(engine) as session:
        group_company = Company(name="네이버", slug="naver")
        group_source = CareerSource(
            company=group_company,
            base_url="https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
            source_type=SourceType.NAVER_JSON,
            status=SourceStatus.ALLOWED,
        )
        scoped_company = Company(name="SNOW", slug="snow")
        scoped_source = CareerSource(
            company=scoped_company,
            base_url=(
                "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko"
                "&sysCompanyCdArr=SN"
            ),
            source_type=SourceType.NAVER_JSON,
            status=SourceStatus.ALLOWED,
        )
        session.add_all([group_source, scoped_source])
        session.commit()
        store = MemorySnapshotStore()

        original = ingest_opening(
            session,
            group_source,
            opening,
            "group-feed",
            store,
            now,
        )
        reassigned = ingest_opening(
            session,
            scoped_source,
            opening,
            "scoped-feed",
            store,
            now,
        )

        postings = session.scalars(select(JobPosting)).all()
        assert reassigned.created is False
        assert reassigned.posting.id == original.posting.id
        assert reassigned.posting.company_id == scoped_company.id
        assert reassigned.posting.source_id == scoped_source.id
        assert len(postings) == 1
