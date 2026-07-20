import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PostingSkill,
    PostingStatus,
    PolicyStatus,
    SourceStatus,
    SourceType,
    UserCareerState,
    UserNotification,
    UserSavedJobSearch,
)
from ejikfit.notifications import evaluate_job_notifications


def _as_utc(value: datetime) -> datetime:
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


def test_job_notifications_are_aggregated_private_and_idempotent() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 20, 15, tzinfo=timezone.utc)
    user_id = uuid.uuid4()
    search_id = uuid.uuid4()

    with Session(engine) as session:
        company = Company(name="테스트랩", slug="test-lab")
        source = CareerSource(
            company=company,
            base_url="https://example.com/jobs",
            source_type=SourceType.KAKAO_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        matching = JobPosting(
            company=company,
            source=source,
            external_id="matching",
            url="https://example.com/jobs/matching",
            title="Python 백엔드 엔지니어",
            description_text="데이터 API를 개발합니다.",
            career_type="experienced",
            first_seen_at=now - timedelta(minutes=30),
            last_seen_at=now,
            last_verified_at=now,
            status=PostingStatus.OPEN,
            skills=[
                PostingSkill(
                    skill="Python",
                    category="language",
                    requirement_type="required",
                    confidence=0.98,
                )
            ],
        )
        delayed = JobPosting(
            company=company,
            source=source,
            external_id="delayed",
            url="https://example.com/jobs/delayed",
            title="Python 플랫폼 엔지니어",
            description_text="검증이 지연된 공고",
            career_type="experienced",
            first_seen_at=now - timedelta(minutes=20),
            last_seen_at=now,
            last_verified_at=now,
            status=PostingStatus.DELAYED,
        )
        saved_search = UserSavedJobSearch(
            id=search_id,
            user_id=user_id,
            name="Python 경력",
            query_text="Python",
            query_key="python",
            category="",
            career_type="experienced",
            is_enabled=True,
            last_checked_at=now - timedelta(hours=1),
        )
        career_state = UserCareerState(
            user_id=user_id,
            followed_company_slugs=["test-lab"],
            company_notifications_checked_at=now - timedelta(hours=1),
        )
        session.add_all([matching, delayed, saved_search, career_state])
        session.commit()

        report = evaluate_job_notifications(session, now)

        notifications = session.scalars(select(UserNotification)).all()
        assert report.saved_searches_checked == 1
        assert report.followed_accounts_checked == 1
        assert report.notifications_created == 1
        assert len(notifications) == 1
        notification = notifications[0]
        assert notification.user_id == user_id
        assert notification.href == f"/jobs/{matching.id}"
        assert notification.title == "테스트랩 새 공고"
        assert notification.body == "Python 백엔드 엔지니어"
        assert notification.metadata_json == {
            "company_slug": "test-lab",
            "followed_company": True,
            "saved_search_ids": [str(search_id)],
            "saved_search_names": ["Python 경력"],
        }
        assert _as_utc(saved_search.last_checked_at) == now
        assert _as_utc(career_state.company_notifications_checked_at) == now

        repeated = evaluate_job_notifications(
            session,
            now + timedelta(minutes=10),
        )

        assert repeated.notifications_created == 0
        assert len(session.scalars(select(UserNotification)).all()) == 1


def test_disabled_account_notifications_skip_delivery_and_advance_checkpoints() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 20, 15, tzinfo=timezone.utc)
    user_id = uuid.uuid4()

    with Session(engine) as session:
        company = Company(name="테스트랩", slug="test-lab")
        source = CareerSource(
            company=company,
            base_url="https://example.com/jobs",
            source_type=SourceType.KAKAO_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=source,
            external_id="new-job",
            url="https://example.com/jobs/new-job",
            title="Python 엔지니어",
            description_text="Python API를 개발합니다.",
            first_seen_at=now - timedelta(minutes=30),
            last_seen_at=now,
            last_verified_at=now,
            status=PostingStatus.OPEN,
        )
        saved_search = UserSavedJobSearch(
            id=uuid.uuid4(),
            user_id=user_id,
            name="Python",
            query_text="Python",
            query_key="python",
            category="",
            career_type="",
            is_enabled=True,
            last_checked_at=now - timedelta(hours=1),
        )
        career_state = UserCareerState(
            user_id=user_id,
            followed_company_slugs=["test-lab"],
            company_notifications_checked_at=now - timedelta(hours=1),
            job_notifications_enabled=False,
        )
        session.add_all([posting, saved_search, career_state])
        session.commit()

        report = evaluate_job_notifications(session, now)

        assert report.saved_searches_checked == 0
        assert report.followed_accounts_checked == 0
        assert report.notifications_created == 0
        assert session.scalars(select(UserNotification)).all() == []
        assert _as_utc(saved_search.last_checked_at) == now
        assert _as_utc(career_state.company_notifications_checked_at) == now
