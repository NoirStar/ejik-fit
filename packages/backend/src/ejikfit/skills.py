"""Deterministic skill extraction from job posting text.

The dictionary is the source of truth; extracted skills are derived data.
Matching is dictionary based (no LLM): ASCII aliases use a token-boundary
rule so `Java` does not match inside `JavaScript`, while Korean aliases use
plain substring matching.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from sqlalchemy import select

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from ejikfit.models import JobPosting


@dataclass(frozen=True)
class SkillDef:
    canonical: str
    category: str
    aliases: tuple[str, ...] = field(default=())


# Characters that count as part of an ASCII token. A match is only valid when
# the characters immediately around it are outside this set, so "sql" does not
# match inside "mysql" and "c" never triggers a "c++" match.
_TOKEN_CHARS = frozenset("abcdefghijklmnopqrstuvwxyz0123456789+#.")


SKILLS: tuple[SkillDef, ...] = (
    # languages
    SkillDef("Python", "language", ("python",)),
    SkillDef("Java", "language", ("java",)),
    SkillDef("JavaScript", "language", ("javascript",)),
    SkillDef("TypeScript", "language", ("typescript",)),
    SkillDef("Kotlin", "language", ("kotlin",)),
    SkillDef("Swift", "language", ("swift",)),
    SkillDef("Go", "language", ("golang",)),
    SkillDef("Rust", "language", ("rust",)),
    SkillDef("C++", "language", ("c++",)),
    SkillDef("C#", "language", ("c#",)),
    SkillDef("Ruby", "language", ("ruby",)),
    SkillDef("PHP", "language", ("php",)),
    SkillDef("Scala", "language", ("scala",)),
    SkillDef("SQL", "language", ("sql",)),
    # frontend
    SkillDef("React", "frontend", ("react", "리액트")),
    # "뷰" is intentionally excluded: it matches 인터뷰/리뷰/뷰티 and floods results.
    SkillDef("Vue", "frontend", ("vue.js", "vuejs", "vue")),
    SkillDef("Next.js", "frontend", ("next.js", "nextjs")),
    SkillDef("Angular", "frontend", ("angular",)),
    SkillDef("Svelte", "frontend", ("svelte",)),
    # backend
    SkillDef("Node.js", "backend", ("node.js", "nodejs")),
    SkillDef("Spring", "backend", ("spring boot", "springboot", "spring")),
    SkillDef("FastAPI", "backend", ("fastapi",)),
    SkillDef("Django", "backend", ("django",)),
    SkillDef("Flask", "backend", ("flask",)),
    SkillDef("NestJS", "backend", ("nestjs", "nest.js")),
    # infra
    SkillDef("Docker", "infra", ("docker", "도커")),
    SkillDef("Kubernetes", "infra", ("kubernetes", "k8s", "쿠버네티스")),
    SkillDef("AWS", "infra", ("aws",)),
    SkillDef("GCP", "infra", ("gcp",)),
    SkillDef("Azure", "infra", ("azure",)),
    SkillDef("Terraform", "infra", ("terraform",)),
    SkillDef("Kafka", "infra", ("kafka",)),
    SkillDef("Nginx", "infra", ("nginx",)),
    SkillDef("Linux", "infra", ("linux",)),
    # data
    SkillDef("PostgreSQL", "data", ("postgresql", "postgres")),
    SkillDef("MySQL", "data", ("mysql",)),
    SkillDef("MongoDB", "data", ("mongodb",)),
    SkillDef("Redis", "data", ("redis",)),
    SkillDef("Elasticsearch", "data", ("elasticsearch",)),
    # ai
    SkillDef("TensorFlow", "ai", ("tensorflow",)),
    SkillDef("PyTorch", "ai", ("pytorch",)),
    # security
    SkillDef("OWASP", "security", ("owasp",)),
    SkillDef("SIEM", "security", ("siem",)),
    SkillDef("Wireshark", "security", ("wireshark",)),
    # game
    SkillDef("Unity", "game", ("unity",)),
    SkillDef("Unreal Engine", "game", ("unreal engine", "unreal", "언리얼")),
    # robotics
    SkillDef("ROS", "robotics", ("ros2", "ros 2", "ros")),
    SkillDef("SLAM", "robotics", ("slam",)),
    SkillDef("Gazebo", "robotics", ("gazebo",)),
    # mobile
    SkillDef("Android", "mobile", ("android",)),
    SkillDef("iOS", "mobile", ("ios",)),
    SkillDef("Flutter", "mobile", ("flutter",)),
)


SKILL_CATEGORY: dict[str, str] = {skill.canonical: skill.category for skill in SKILLS}


def skill_category(canonical: str) -> str:
    return SKILL_CATEGORY.get(canonical, "")


def _is_ascii_token(alias: str) -> bool:
    return any(c.isascii() and c.isalnum() for c in alias)


def _alias_matches(alias: str, text_lower: str) -> bool:
    alias_lower = alias.lower()
    if not _is_ascii_token(alias_lower):
        return alias_lower in text_lower

    span = len(alias_lower)
    start = 0
    while True:
        index = text_lower.find(alias_lower, start)
        if index == -1:
            return False
        before_ok = index == 0 or text_lower[index - 1] not in _TOKEN_CHARS
        end = index + span
        after_ok = end == len(text_lower) or text_lower[end] not in _TOKEN_CHARS
        if before_ok and after_ok:
            return True
        start = index + 1


def extract_skills(text: str) -> list[str]:
    """Return the sorted, de-duplicated canonical skills mentioned in text."""
    if not text:
        return []

    text_lower = text.lower()
    found: set[str] = set()
    for skill in SKILLS:
        for alias in skill.aliases:
            if _alias_matches(alias, text_lower):
                found.add(skill.canonical)
                break
    return sorted(found)


def sync_posting_skills(session: "Session", posting: "JobPosting") -> list[str]:
    """Store the skills extracted from a posting's title and description.

    Derived data: idempotent, so re-running removes skills that no longer
    match and adds newly matched ones. Does not commit.
    """
    from ejikfit.models import PostingSkill

    text = f"{posting.title}\n{posting.description_text or ''}"
    desired = extract_skills(text)
    desired_set = set(desired)

    existing = {
        row.skill: row
        for row in session.scalars(
            select(PostingSkill).where(PostingSkill.posting_id == posting.id)
        )
    }
    for skill, row in existing.items():
        if skill not in desired_set:
            session.delete(row)
    for skill in desired:
        if skill not in existing:
            session.add(
                PostingSkill(
                    posting_id=posting.id,
                    skill=skill,
                    category=skill_category(skill),
                )
            )
    return desired


def backfill_all_skills(session: "Session") -> int:
    """Re-extract skills for every stored posting. Commits. Returns count."""
    from ejikfit.models import JobPosting

    postings = list(session.scalars(select(JobPosting)))
    for posting in postings:
        sync_posting_skills(session, posting)
    session.commit()
    return len(postings)
