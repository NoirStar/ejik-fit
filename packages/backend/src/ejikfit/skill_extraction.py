from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from bs4 import BeautifulSoup, Tag

from ejikfit.skill_catalog import (
    AliasDef,
    AliasPolicy,
    SKILLS,
    SkillDef,
)


CONFIRMED_CONFIDENCE = 0.80
DISTINCT_SCORE = 1.00
STRONG_CONTEXT_SCORE = 0.95
SECTION_CONTEXT_SCORE = 0.85
CANDIDATE_SCORE = 0.50

_TOKEN_CHARS = "A-Za-z0-9_+#."
_BLOCK_TAGS = ("div", "p", "li", "ul", "ol", "table", "section", "article")
_HEADING_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6")

REQUIRED_HEADINGS = {
    "자격 요건",
    "자격요건",
    "필수 자격 요건",
    "필수자격요건",
    "지원 자격",
    "지원자격",
    "이런 분을 찾고 있어요",
    "이런 분들을 찾고 있어요",
    "이런 분과 함께하고 싶어요",
    "함께하기 위해 필요한 기본 요건이에요",
    "이런 기술이 필요해요",
}
PREFERRED_HEADINGS = {
    "우대 사항",
    "우대사항",
    "일반 우대사항",
    "이런 분이면 더 좋아요",
    "이런 분이라면 더 좋아요",
    "preferred",
    "nice to have",
}
TECHNICAL_HEADINGS = {
    "사용중인 기술",
    "사용 중인 기술",
    "이런 기술들을 사용하고 있어요",
    "기술 스택",
    "tech stack",
}

_LOCAL_PREFERRED = re.compile(r"(우대|선호|있으면\s+(?:더\s+)?좋)")
_LOCAL_REQUIRED = re.compile(r"(필수|반드시)")


class RequirementType(str, Enum):
    REQUIRED = "required"
    PREFERRED = "preferred"
    UNSPECIFIED = "unspecified"


@dataclass(frozen=True)
class EvidenceBlock:
    text: str
    requirement_type: RequirementType
    position: int
    technical_section: bool = False
    list_item: bool = False


@dataclass(frozen=True)
class SkillMatch:
    skill: str
    category: str
    requirement_type: RequirementType
    evidence_text: str
    confidence: float
    match_reason: str
    position: int


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _normalize_heading(value: str) -> str:
    normalized = _clean_text(value).lower()
    normalized = re.sub(r"^#+\s*", "", normalized)
    normalized = normalized.strip("[]【】(){}")
    normalized = re.sub(r"^[^\w가-힣]+", "", normalized)
    normalized = re.sub(r"[^\w가-힣]+$", "", normalized)
    return _clean_text(normalized)


def _heading_kind(
    value: str,
) -> tuple[RequirementType, bool] | None:
    normalized = _normalize_heading(value)
    for phrase in PREFERRED_HEADINGS:
        if phrase in normalized:
            return RequirementType.PREFERRED, False
    for phrase in REQUIRED_HEADINGS:
        if phrase in normalized:
            return RequirementType.REQUIRED, phrase == "이런 기술이 필요해요"
    for phrase in TECHNICAL_HEADINGS:
        if phrase in normalized:
            return RequirementType.UNSPECIFIED, True
    return None


def _local_requirement(
    text: str, inherited: RequirementType
) -> RequirementType:
    if _LOCAL_PREFERRED.search(text):
        return RequirementType.PREFERRED
    if _LOCAL_REQUIRED.search(text):
        return RequirementType.REQUIRED
    return inherited


def _is_leaf_block(tag: Tag) -> bool:
    return tag.find(_BLOCK_TAGS) is None


def _html_blocks(description_html: str) -> list[EvidenceBlock]:
    soup = BeautifulSoup(description_html, "lxml")
    blocks: list[EvidenceBlock] = []
    current_type = RequirementType.UNSPECIFIED
    current_technical = False
    position = 0

    for tag in soup.find_all((*_HEADING_TAGS, "p", "div", "strong", "b", "li")):
        text = _clean_text(tag.get_text(" ", strip=True))
        if not text:
            continue

        if tag.name in _HEADING_TAGS:
            heading = _heading_kind(text)
            if heading is None:
                current_type = RequirementType.UNSPECIFIED
                current_technical = False
            else:
                current_type, current_technical = heading
            continue

        is_pseudo_candidate = (
            tag.name in {"p", "div", "strong", "b"}
            and len(text) <= 80
            and _is_leaf_block(tag)
            and tag.find_parent(_HEADING_TAGS) is None
        )
        heading = _heading_kind(text) if is_pseudo_candidate else None
        if heading is not None:
            current_type, current_technical = heading
            continue

        if tag.name == "li":
            blocks.append(
                EvidenceBlock(
                    text=text,
                    requirement_type=_local_requirement(text, current_type),
                    position=position,
                    technical_section=current_technical,
                    list_item=True,
                )
            )
            position += 1
            continue

        if tag.name in {"p", "div"}:
            if tag.find_parent("li") is not None or not _is_leaf_block(tag):
                continue
            blocks.append(
                EvidenceBlock(
                    text=text,
                    requirement_type=_local_requirement(text, current_type),
                    position=position,
                    technical_section=current_technical,
                )
            )
            position += 1

    return blocks


def _plain_blocks(description_text: str, start: int = 0) -> list[EvidenceBlock]:
    parts = re.split(r"(?:\r?\n)+|(?<=[.!?。])\s+", description_text)
    return [
        EvidenceBlock(
            text=cleaned,
            requirement_type=_local_requirement(
                cleaned, RequirementType.UNSPECIFIED
            ),
            position=start + index,
        )
        for index, part in enumerate(parts)
        if (cleaned := _clean_text(part))
    ]


def _evidence_blocks(
    title: str, description_html: str, description_text: str
) -> list[EvidenceBlock]:
    blocks: list[EvidenceBlock] = []
    if cleaned_title := _clean_text(title):
        blocks.append(
            EvidenceBlock(
                text=cleaned_title,
                requirement_type=RequirementType.UNSPECIFIED,
                position=0,
            )
        )

    html_blocks = _html_blocks(description_html) if description_html else []
    offset = len(blocks)
    if html_blocks:
        blocks.extend(
            EvidenceBlock(
                text=block.text,
                requirement_type=block.requirement_type,
                position=block.position + offset,
                technical_section=block.technical_section,
                list_item=block.list_item,
            )
            for block in html_blocks
        )
    else:
        blocks.extend(_plain_blocks(description_text, start=offset))
    return blocks


def _alias_pattern(skill: SkillDef, alias: AliasDef) -> re.Pattern[str]:
    if skill.canonical == "C++" and alias.value.lower() == "c++":
        source = rf"(?<![{_TOKEN_CHARS}])C\+\+(?:11|14|17|20|23)?(?![{_TOKEN_CHARS}])"
        return re.compile(source, re.IGNORECASE)

    if skill.canonical == "Go" and alias.value == "Go":
        return re.compile(
            rf"(?<![{_TOKEN_CHARS}])(?:Go(?![{_TOKEN_CHARS}])|go(?=\.mod\b|\s+(?:test|build)\b))"
        )

    escaped = re.escape(alias.value)
    has_ascii_token = any(
        character.isascii() and character.isalnum()
        for character in alias.value
    )
    if has_ascii_token:
        escaped = (
            rf"(?<![{_TOKEN_CHARS}]){escaped}(?![{_TOKEN_CHARS}])"
        )
    flags = 0 if alias.case_sensitive else re.IGNORECASE
    return re.compile(escaped, flags)


def _negative_overlap(
    alias: AliasDef, text: str, start: int, end: int
) -> bool:
    for source in alias.negative_patterns:
        for negative in re.finditer(source, text, re.IGNORECASE):
            if start < negative.end() and end > negative.start():
                return True
    return False


def _has_context(text: str, terms: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def _looks_like_parallel_list(text: str) -> bool:
    return bool(
        re.search(
            r"[,/]|(?:^|\s)(?:및|와|과|또는|or|and)(?:\s|$)",
            text,
            re.IGNORECASE,
        )
    )


def _distinct_skills_in_block(block: EvidenceBlock) -> set[str]:
    found: set[str] = set()
    for skill in SKILLS:
        for alias in skill.aliases:
            if alias.policy is not AliasPolicy.DISTINCT:
                continue
            if _alias_pattern(skill, alias).search(block.text):
                found.add(skill.canonical)
                break
    return found


def _score_alias(
    skill: SkillDef,
    alias: AliasDef,
    block: EvidenceBlock,
    other_skills: set[str],
) -> tuple[float, str]:
    if alias.policy is AliasPolicy.DISTINCT:
        return DISTINCT_SCORE, "distinct_alias"

    has_terms = _has_context(block.text, alias.context_terms)
    has_companion = bool(other_skills - {skill.canonical})

    if alias.policy is AliasPolicy.CONTEXTUAL:
        if has_terms:
            return STRONG_CONTEXT_SCORE, "contextual_alias_with_terms"
        if block.technical_section or (
            has_companion
            and (block.list_item or _looks_like_parallel_list(block.text))
        ):
            return SECTION_CONTEXT_SCORE, "contextual_alias_with_section"
        return CANDIDATE_SCORE, "ambiguous_alias_candidate"

    if skill.canonical == "C" and re.search(
        r"(?<![A-Za-z0-9_+#.])C\s*/\s*C\+\+", block.text
    ):
        return STRONG_CONTEXT_SCORE, "strict_compound_alias"
    if skill.canonical == "R" and has_companion and any(
        name in other_skills for name in {"Python", "SQL"}
    ):
        return STRONG_CONTEXT_SCORE, "strict_data_language_list"
    if has_terms:
        return STRONG_CONTEXT_SCORE, "strict_alias_with_context"
    if block.technical_section or (
        has_companion
        and (block.list_item or _looks_like_parallel_list(block.text))
    ):
        return SECTION_CONTEXT_SCORE, "strict_alias_with_section"
    return CANDIDATE_SCORE, "ambiguous_alias_candidate"


def _block_matches(block: EvidenceBlock) -> list[SkillMatch]:
    other_skills = _distinct_skills_in_block(block)
    matches: list[SkillMatch] = []

    for skill in SKILLS:
        for alias in skill.aliases:
            pattern = _alias_pattern(skill, alias)
            for occurrence in pattern.finditer(block.text):
                if _negative_overlap(
                    alias,
                    block.text,
                    occurrence.start(),
                    occurrence.end(),
                ):
                    continue
                confidence, reason = _score_alias(
                    skill, alias, block, other_skills
                )
                matches.append(
                    SkillMatch(
                        skill=skill.canonical,
                        category=skill.category,
                        requirement_type=block.requirement_type,
                        evidence_text=block.text,
                        confidence=confidence,
                        match_reason=reason,
                        position=block.position,
                    )
                )
                break
    return matches


_REQUIREMENT_PRIORITY = {
    RequirementType.REQUIRED: 3,
    RequirementType.PREFERRED: 2,
    RequirementType.UNSPECIFIED: 1,
}


def _match_priority(match: SkillMatch) -> tuple[int, int, float, int]:
    return (
        int(match.confidence >= CONFIRMED_CONFIDENCE),
        _REQUIREMENT_PRIORITY[match.requirement_type],
        match.confidence,
        -match.position,
    )


def extract_skill_matches(
    *,
    title: str,
    description_html: str,
    description_text: str,
) -> list[SkillMatch]:
    best: dict[str, SkillMatch] = {}
    for block in _evidence_blocks(title, description_html, description_text):
        for match in _block_matches(block):
            current = best.get(match.skill)
            if current is None or _match_priority(match) > _match_priority(
                current
            ):
                best[match.skill] = match
    return [best[name] for name in sorted(best)]
