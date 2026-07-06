"""Skill catalog compatibility exports and posting-skill synchronization."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from ejikfit.skill_catalog import (
    SKILLS,
    SKILL_CATEGORY,
    SkillDef,
    skill_category,
)
from ejikfit.skill_extraction import (
    CONFIRMED_CONFIDENCE,
    extract_skill_matches,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from ejikfit.models import JobPosting


def extract_skills(text: str) -> list[str]:
    """Return confirmed canonical skill names from unstructured text."""
    return sorted(
        match.skill
        for match in extract_skill_matches(
            title="",
            description_html="",
            description_text=text,
        )
        if match.confidence >= CONFIRMED_CONFIDENCE
    )


def sync_posting_skills(session: "Session", posting: "JobPosting") -> list[str]:
    """Store the skills extracted from a posting's title and description.

    Derived data: idempotent, so re-running removes skills that no longer
    match and adds newly matched ones. Does not commit.
    """
    from ejikfit.models import PostingSkill

    matches = extract_skill_matches(
        title=posting.title,
        description_html=posting.description_html or "",
        description_text=posting.description_text or "",
    )
    desired = {match.skill: match for match in matches}

    existing = {
        row.skill: row
        for row in session.scalars(
            select(PostingSkill).where(PostingSkill.posting_id == posting.id)
        )
    }
    for skill, row in existing.items():
        if skill not in desired:
            session.delete(row)
    for skill, match in desired.items():
        row = existing.get(skill)
        if row is None:
            row = PostingSkill(
                posting_id=posting.id,
                skill=skill,
                category=match.category,
            )
            session.add(row)
        row.category = match.category
        row.requirement_type = match.requirement_type.value
        row.evidence_text = match.evidence_text
        row.confidence = match.confidence
        row.match_reason = match.match_reason

    return sorted(
        skill
        for skill, match in desired.items()
        if match.confidence >= CONFIRMED_CONFIDENCE
    )


def backfill_all_skills(session: "Session") -> int:
    """Re-extract skills for every stored posting. Commits. Returns count."""
    from ejikfit.models import JobPosting

    postings = list(session.scalars(select(JobPosting)))
    for posting in postings:
        sync_posting_skills(session, posting)
    session.commit()
    return len(postings)
