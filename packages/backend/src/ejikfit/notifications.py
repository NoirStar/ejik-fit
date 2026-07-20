from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload, selectinload

from ejikfit.models import (
    JobPosting,
    PostingSkill,
    PostingStatus,
    UserCareerState,
    UserNotification,
    UserSavedJobSearch,
)
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE


MAX_SAVED_SEARCHES_PER_USER = 10
MAX_NOTIFICATIONS_PER_USER_PER_RUN = 20
NOTIFICATION_LOOKBACK = timedelta(days=30)
NOTIFICATION_RETENTION = timedelta(days=180)


@dataclass(frozen=True)
class NotificationEvaluationReport:
    saved_searches_checked: int
    followed_accounts_checked: int
    notifications_created: int


@dataclass
class _NotificationCandidate:
    posting: JobPosting
    followed_company: bool = False
    saved_search_ids: list[str] = field(default_factory=list)
    saved_search_names: list[str] = field(default_factory=list)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _bounded_saved_searches(
    searches: list[UserSavedJobSearch],
) -> list[UserSavedJobSearch]:
    counts: defaultdict[uuid.UUID, int] = defaultdict(int)
    bounded: list[UserSavedJobSearch] = []
    for search in searches:
        if counts[search.user_id] >= MAX_SAVED_SEARCHES_PER_USER:
            continue
        counts[search.user_id] += 1
        bounded.append(search)
    return bounded


def _confirmed_skills(posting: JobPosting) -> list[PostingSkill]:
    return [
        skill
        for skill in posting.skills
        if skill.confidence >= CONFIRMED_CONFIDENCE
    ]


def _matches_saved_search(
    posting: JobPosting,
    search: UserSavedJobSearch,
) -> bool:
    if search.career_type and posting.career_type != search.career_type:
        return False

    confirmed_skills = _confirmed_skills(posting)
    if search.category and not any(
        skill.category == search.category for skill in confirmed_skills
    ):
        return False

    query = search.query_text.strip().casefold()
    if not query:
        return True
    searchable = (
        posting.title,
        posting.description_text,
        posting.location or "",
        posting.company.name,
        *(skill.skill for skill in confirmed_skills),
    )
    return any(query in value.casefold() for value in searchable)


def _candidate_for(
    candidates: dict[
        tuple[uuid.UUID, uuid.UUID],
        _NotificationCandidate,
    ],
    user_id: uuid.UUID,
    posting: JobPosting,
) -> _NotificationCandidate:
    return candidates.setdefault(
        (user_id, posting.id),
        _NotificationCandidate(posting=posting),
    )


def evaluate_job_notifications(
    session: Session,
    now: datetime,
) -> NotificationEvaluationReport:
    observed_at = _as_utc(now)
    searches = _bounded_saved_searches(
        list(
            session.scalars(
                select(UserSavedJobSearch)
                .where(UserSavedJobSearch.is_enabled.is_(True))
                .order_by(
                    UserSavedJobSearch.user_id,
                    UserSavedJobSearch.updated_at.desc(),
                    UserSavedJobSearch.id,
                )
            ).all()
        )
    )
    career_states = [
        state
        for state in session.scalars(select(UserCareerState)).all()
        if state.followed_company_slugs
    ]
    checkpoints = [
        _as_utc(search.last_checked_at) for search in searches
    ] + [
        _as_utc(state.company_notifications_checked_at)
        for state in career_states
    ]
    if not checkpoints:
        session.execute(
            delete(UserNotification).where(
                UserNotification.created_at
                < observed_at - NOTIFICATION_RETENTION
            ).execution_options(synchronize_session=False)
        )
        session.commit()
        return NotificationEvaluationReport(0, 0, 0)

    earliest_checkpoint = max(
        min(checkpoints),
        observed_at - NOTIFICATION_LOOKBACK,
    )
    postings = list(
        session.scalars(
            select(JobPosting)
            .options(
                joinedload(JobPosting.company),
                selectinload(JobPosting.skills),
            )
            .where(
                JobPosting.status == PostingStatus.OPEN,
                JobPosting.first_seen_at > earliest_checkpoint,
                JobPosting.first_seen_at <= observed_at,
            )
            .order_by(
                JobPosting.first_seen_at.desc(),
                JobPosting.id.desc(),
            )
        )
        .unique()
        .all()
    )

    candidates: dict[
        tuple[uuid.UUID, uuid.UUID],
        _NotificationCandidate,
    ] = {}
    for search in searches:
        checkpoint = max(
            _as_utc(search.last_checked_at),
            observed_at - NOTIFICATION_LOOKBACK,
        )
        for posting in postings:
            if _as_utc(posting.first_seen_at) <= checkpoint:
                continue
            if not _matches_saved_search(posting, search):
                continue
            candidate = _candidate_for(candidates, search.user_id, posting)
            search_id = str(search.id)
            if search_id not in candidate.saved_search_ids:
                candidate.saved_search_ids.append(search_id)
                candidate.saved_search_names.append(search.name)
        search.last_checked_at = observed_at

    for state in career_states:
        checkpoint = max(
            _as_utc(state.company_notifications_checked_at),
            observed_at - NOTIFICATION_LOOKBACK,
        )
        followed_slugs = {
            slug
            for value in state.followed_company_slugs[:60]
            if isinstance(value, str) and (slug := value.strip())
        }
        for posting in postings:
            if (
                _as_utc(posting.first_seen_at) > checkpoint
                and posting.company.slug in followed_slugs
            ):
                _candidate_for(
                    candidates,
                    state.user_id,
                    posting,
                ).followed_company = True
        state.company_notifications_checked_at = observed_at

    limited_candidates: list[
        tuple[uuid.UUID, _NotificationCandidate]
    ] = []
    candidates_by_user: defaultdict[
        uuid.UUID,
        list[_NotificationCandidate],
    ] = defaultdict(list)
    for (user_id, _), candidate in candidates.items():
        candidates_by_user[user_id].append(candidate)
    for user_id, user_candidates in candidates_by_user.items():
        user_candidates.sort(
            key=lambda candidate: (
                _as_utc(candidate.posting.first_seen_at),
                str(candidate.posting.id),
            ),
            reverse=True,
        )
        limited_candidates.extend(
            (user_id, candidate)
            for candidate in user_candidates[
                :MAX_NOTIFICATIONS_PER_USER_PER_RUN
            ]
        )

    candidate_keys = {
        (user_id, f"job:{candidate.posting.id}")
        for user_id, candidate in limited_candidates
    }
    existing_keys: set[tuple[uuid.UUID, str]] = set()
    if candidate_keys:
        user_ids = {user_id for user_id, _ in candidate_keys}
        dedupe_keys = {key for _, key in candidate_keys}
        existing_keys = {
            (user_id, dedupe_key)
            for user_id, dedupe_key in session.execute(
                select(
                    UserNotification.user_id,
                    UserNotification.dedupe_key,
                ).where(
                    UserNotification.user_id.in_(user_ids),
                    UserNotification.dedupe_key.in_(dedupe_keys),
                )
            ).all()
        }

    created = 0
    for user_id, candidate in limited_candidates:
        posting = candidate.posting
        dedupe_key = f"job:{posting.id}"
        if (user_id, dedupe_key) in existing_keys:
            continue
        session.add(
            UserNotification(
                user_id=user_id,
                kind="job",
                dedupe_key=dedupe_key,
                title=f"{posting.company.name} 새 공고",
                body=posting.title,
                href=f"/jobs/{posting.id}",
                metadata_json={
                    "company_slug": posting.company.slug,
                    "followed_company": candidate.followed_company,
                    "saved_search_ids": candidate.saved_search_ids,
                    "saved_search_names": candidate.saved_search_names,
                },
                created_at=observed_at,
            )
        )
        created += 1

    session.execute(
        delete(UserNotification).where(
            UserNotification.created_at
            < observed_at - NOTIFICATION_RETENTION
        ).execution_options(synchronize_session=False)
    )
    session.commit()
    return NotificationEvaluationReport(
        saved_searches_checked=len(searches),
        followed_accounts_checked=len(career_states),
        notifications_created=created,
    )
