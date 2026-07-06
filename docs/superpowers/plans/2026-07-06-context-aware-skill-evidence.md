# Context-Aware Skill Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify extracted job-posting skills as required, preferred, or unspecified, retain evidence and deterministic confidence, and accurately distinguish ambiguous aliases such as C, Go, R, Spring, and React.

**Architecture:** Split the current mixed catalog/extraction/storage module into a typed alias catalog, a pure HTML-aware extraction pipeline, and database synchronization. Preserve the existing `extract_skills()` and `skills: string[]` contracts while adding structured evidence to the database, API, and web detail page.

**Tech Stack:** Python 3.12, BeautifulSoup/lxml, SQLAlchemy 2, Alembic, FastAPI/Pydantic, pytest, Next.js 16, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not use an LLM or an external extraction API.
- Keep extraction deterministic: identical input must produce identical output.
- Preserve the existing `extract_skills(text) -> list[str]` and `skills: string[]` contracts.
- Treat `confidence` as a deterministic rule score, not a probability; `0.80` is the confirmed threshold.
- Preserve low-confidence ambiguous candidates in `posting_skills`, but exclude them from public skill lists, statistics, and the default UI.
- Never classify aliases by lowercasing the entire source text when case is a required signal.
- Every `contextual` or `strict` alias requires positive and negative golden cases.
- Do not change crawler access, CAPTCHA, or source-closing safety behavior.
- Do not touch the unrelated untracked `.agents/` directory.

---

## File Structure

- Create `packages/backend/src/ejikfit/skill_catalog.py`: canonical skills, typed aliases, risk policies, categories, and context vocabulary.
- Create `packages/backend/src/ejikfit/skill_extraction.py`: evidence-block parsing, requirement classification, alias matching, confidence scoring, and match merging.
- Modify `packages/backend/src/ejikfit/skills.py`: backward-compatible exports plus DB synchronization/backfill.
- Create `packages/backend/alembic/versions/20260706_0004_skill_evidence.py`: additive `posting_skills` migration.
- Modify `packages/backend/src/ejikfit/models.py`: structured skill relation fields.
- Modify backend API schemas/readers to expose confirmed structured results and aggregate counts.
- Create `apps/web/src/components/skill-evidence.tsx`: grouped evidence presentation.
- Create focused backend and web tests adjacent to existing skill tests.

---

### Task 1: Typed Alias Catalog and Risk Policies

**Files:**
- Create: `packages/backend/src/ejikfit/skill_catalog.py`
- Create: `packages/backend/tests/test_skill_catalog.py`

**Interfaces:**
- Produces: `AliasPolicy`, `AliasDef`, `SkillDef`, `SKILLS`, `SKILL_CATEGORY`, `skill_category()`, and `aliases_requiring_context()`.
- Does not switch the runtime extractor yet; that happens atomically in Task 2.

- [ ] **Step 1: Write the failing catalog tests**

```python
from ejikfit.skill_catalog import (
    AliasPolicy,
    SKILLS,
    aliases_requiring_context,
    skill_category,
)


RISKY_ALIASES = {
    ("Java", "java"),
    ("Swift", "swift"),
    ("Go", "Go"),
    ("Rust", "rust"),
    ("C", "C"),
    ("R", "R"),
    ("Ruby", "ruby"),
    ("Scala", "scala"),
    ("React", "react"),
    ("Spring", "spring"),
    ("Flask", "flask"),
    ("Kafka", "kafka"),
    ("Unity", "unity"),
    ("ROS", "ros"),
    ("SLAM", "slam"),
    ("Gazebo", "gazebo"),
    ("Android", "android"),
    ("Flutter", "flutter"),
}


def test_every_alias_has_an_explicit_policy() -> None:
    aliases = [alias for skill in SKILLS for alias in skill.aliases]
    assert aliases
    assert all(isinstance(alias.policy, AliasPolicy) for alias in aliases)


def test_all_risky_aliases_are_covered_by_golden_case_registry() -> None:
    actual = {
        (skill.canonical, alias.value)
        for skill, alias in aliases_requiring_context()
    }
    assert actual == RISKY_ALIASES


def test_c_and_r_are_first_class_language_skills() -> None:
    assert skill_category("C") == "language"
    assert skill_category("R") == "language"


def test_same_skill_can_have_aliases_with_different_risk() -> None:
    go = next(skill for skill in SKILLS if skill.canonical == "Go")
    policies = {alias.value: alias.policy for alias in go.aliases}
    assert policies["golang"] is AliasPolicy.DISTINCT
    assert policies["Go"] is AliasPolicy.STRICT
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin packages/backend/tests/test_skill_catalog.py -v
```

Expected: collection fails with `ModuleNotFoundError: No module named 'ejikfit.skill_catalog'`.

- [ ] **Step 3: Add typed catalog definitions and convert all existing aliases**

Implement these public types first:

```python
from dataclasses import dataclass, field
from enum import Enum


class AliasPolicy(str, Enum):
    DISTINCT = "distinct"
    CONTEXTUAL = "contextual"
    STRICT = "strict"


@dataclass(frozen=True)
class AliasDef:
    value: str
    policy: AliasPolicy
    case_sensitive: bool = False
    context_terms: tuple[str, ...] = field(default=())
    negative_patterns: tuple[str, ...] = field(default=())


@dataclass(frozen=True)
class SkillDef:
    canonical: str
    category: str
    aliases: tuple[AliasDef, ...]


def distinct(value: str) -> AliasDef:
    return AliasDef(value=value, policy=AliasPolicy.DISTINCT)


def contextual(
    value: str,
    *,
    context_terms: tuple[str, ...],
    negative_patterns: tuple[str, ...] = (),
) -> AliasDef:
    return AliasDef(
        value=value,
        policy=AliasPolicy.CONTEXTUAL,
        context_terms=context_terms,
        negative_patterns=negative_patterns,
    )


def strict(
    value: str,
    *,
    context_terms: tuple[str, ...],
    negative_patterns: tuple[str, ...],
) -> AliasDef:
    return AliasDef(
        value=value,
        policy=AliasPolicy.STRICT,
        case_sensitive=True,
        context_terms=context_terms,
        negative_patterns=negative_patterns,
    )
```

Convert every existing string alias to an `AliasDef`. Add canonical `C` and `R`.
Use alias-specific policies rather than canonical-skill policies. Required exact entries:

```python
SkillDef(
    "Go",
    "language",
    (
        strict(
            "Go",
            context_terms=(
                "개발", "백엔드", "서버", "프로그래밍", "언어",
                "framework", "backend", "server", "programming",
            ),
            negative_patterns=(r"\bgo-to-market\b", r"\bgo to\b"),
        ),
        distinct("golang"),
    ),
),
SkillDef(
    "C",
    "language",
    (
        strict(
            "C",
            context_terms=(
                "언어", "프로그래밍", "개발", "펌웨어", "임베디드",
                "컴파일러", "rtos", "firmware", "embedded", "compiler",
            ),
            negative_patterns=(
                r"\bc[- ]level\b", r"\bvitamin c\b", r"\ba/b/c\b",
            ),
        ),
    ),
),
SkillDef(
    "R",
    "language",
    (
        strict(
            "R",
            context_terms=(
                "통계", "데이터", "분석", "모델링", "시각화",
                "statistics", "data", "analytics", "modeling",
            ),
            negative_patterns=(r"\br&d\b", r"\bcortex-m/r\b"),
        ),
        distinct("rstudio"),
        distinct("r shiny"),
    ),
),
```

Classify the remaining risky aliases listed in `RISKY_ALIASES` as
`contextual`; keep Korean transliterations and unambiguous compound aliases
such as `spring boot`, `리액트`, `ros2`, and `vue.js` as `distinct`.

Expose:

```python
SKILL_CATEGORY = {skill.canonical: skill.category for skill in SKILLS}


def skill_category(canonical: str) -> str:
    return SKILL_CATEGORY.get(canonical, "")


def aliases_requiring_context() -> list[tuple[SkillDef, AliasDef]]:
    return [
        (skill, alias)
        for skill in SKILLS
        for alias in skill.aliases
        if alias.policy is not AliasPolicy.DISTINCT
    ]
```

- [ ] **Step 4: Run catalog and existing skill tests**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_skill_catalog.py \
  packages/backend/tests/test_skills.py -v
```

Expected: catalog and existing extraction tests both pass because the runtime
extractor still uses its original in-module catalog until Task 2.

- [ ] **Step 5: Commit the catalog**

```bash
git add packages/backend/src/ejikfit/skill_catalog.py \
  packages/backend/tests/test_skill_catalog.py
git commit -m "refactor: add typed skill alias policies"
```

---

### Task 2: HTML-Aware Evidence and Ambiguous Alias Extraction

**Files:**
- Create: `packages/backend/src/ejikfit/skill_extraction.py`
- Create: `packages/backend/tests/test_skill_extraction.py`
- Modify: `packages/backend/src/ejikfit/skills.py`
- Modify: `packages/backend/tests/test_skills.py`

**Interfaces:**
- Produces: `CONFIRMED_CONFIDENCE`, `RequirementType`, `SkillMatch`, and `extract_skill_matches(*, title, description_html, description_text)`.
- Preserves: `extract_skills(text) -> list[str]`, returning only confirmed names.

- [ ] **Step 1: Write failing golden tests for ambiguous aliases**

```python
import pytest

from ejikfit.skill_extraction import extract_skill_matches


RISKY_GOLDENS = {
    ("Java", "java"): ("Java 백엔드 개발", "인도네시아 Java 섬 여행"),
    ("Swift", "swift"): ("Swift iOS 앱 개발", "SWIFT 해외 송금 전문"),
    ("Go", "Go"): ("Go 기반 서버 개발", "Go-to-Market 전략"),
    ("Rust", "rust"): ("Rust 언어 개발", "remove rust from metal"),
    ("C", "C"): ("C 언어 펌웨어 개발", "고객사 C-level 미팅"),
    ("R", "R"): ("R 기반 통계 분석", "국가 R&D 과제"),
    ("Ruby", "ruby"): ("Ruby on Rails 개발", "ruby gemstone"),
    ("Scala", "scala"): ("Scala 언어 개발", "Teatro alla Scala"),
    ("React", "react"): ("React 프론트엔드 개발", "users react quickly"),
    ("Spring", "spring"): ("Spring 백엔드 개발", "spring season event"),
    ("Flask", "flask"): ("Flask API 개발", "laboratory flask"),
    ("Kafka", "kafka"): ("Kafka 메시지 파이프라인", "Kafka 소설"),
    ("Unity", "unity"): ("Unity 게임 개발", "team unity matters"),
    ("ROS", "ros"): ("ROS 로봇 개발", "ros라는 임의 문자열"),
    ("SLAM", "slam"): ("SLAM 로봇 알고리즘", "slam the door"),
    ("Gazebo", "gazebo"): ("Gazebo 로봇 시뮬레이션", "garden gazebo"),
    ("Android", "android"): ("Android 앱 개발", "android character"),
    ("Flutter", "flutter"): ("Flutter 모바일 앱 개발", "butterflies flutter"),
}


def names(text: str) -> list[str]:
    return [
        match.skill
        for match in extract_skill_matches(
            title="",
            description_html="",
            description_text=text,
        )
        if match.confidence >= 0.80
    ]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("C/C++ 프로그래밍 능력", ["C", "C++"]),
        ("C++17 기반 게임 엔진 개발", ["C++"]),
        ("Go/TypeScript/Solidity 중 1개 이상 실무 활용", ["Go", "TypeScript"]),
        ("Golang 기반 백엔드 개발", ["Go"]),
        ("Python, R, SQL을 사용한 통계 분석", ["Python", "R", "SQL"]),
        ("RStudio와 R Shiny 경험", ["R"]),
    ],
)
def test_confirms_ambiguous_aliases_in_technical_context(
    text: str, expected: list[str]
) -> None:
    assert sorted(names(text)) == sorted(expected)


@pytest.mark.parametrize(
    "text",
    [
        "고객사 C-level 대상 제안",
        "Vitamin C 제품",
        "A/B/C 등급 관리",
        "Go-to-Market 전략 수립",
        "go to the next step",
        "국가 R&D 과제",
        "ARM Cortex-M/R 시리즈",
    ],
)
def test_rejects_known_non_technical_collisions(text: str) -> None:
    assert names(text) == []


def test_keeps_unresolved_strict_alias_as_low_confidence_candidate() -> None:
    matches = extract_skill_matches(
        title="",
        description_html="",
        description_text="Go",
    )
    assert [(m.skill, m.confidence) for m in matches] == [("Go", 0.50)]


@pytest.mark.parametrize(
    ("identity", "positive", "negative"),
    [
        (identity, positive, negative)
        for identity, (positive, negative) in RISKY_GOLDENS.items()
    ],
)
def test_every_risky_alias_has_positive_and_negative_evidence(
    identity: tuple[str, str],
    positive: str,
    negative: str,
) -> None:
    canonical, _alias = identity
    assert canonical in names(positive)
    assert canonical not in names(negative)
```

- [ ] **Step 2: Write failing section and requirement tests**

```python
from ejikfit.skill_extraction import RequirementType, extract_skill_matches


def by_skill(html: str) -> dict:
    return {
        match.skill: match
        for match in extract_skill_matches(
            title="",
            description_html=html,
            description_text="",
        )
        if match.confidence >= 0.80
    }


def test_classifies_heading_and_pseudo_heading_sections() -> None:
    html = """
    <h2>자격 요건</h2><ul><li>Python 개발 경험</li></ul>
    <p>[우대 사항]</p><ul><li>Go 언어 경험</li></ul>
    <h2>이런 기술들을 사용하고 있어요</h2><p>Rust 언어</p>
    """
    matches = by_skill(html)
    assert matches["Python"].requirement_type is RequirementType.REQUIRED
    assert matches["Go"].requirement_type is RequirementType.PREFERRED
    assert matches["Rust"].requirement_type is RequirementType.UNSPECIFIED
    assert matches["Go"].evidence_text == "Go 언어 경험"


def test_local_preferred_phrase_overrides_required_section() -> None:
    matches = by_skill(
        "<h2>자격 요건</h2><ul><li>AWS 경험자 우대</li></ul>"
    )
    assert matches["AWS"].requirement_type is RequirementType.PREFERRED
```

- [ ] **Step 3: Verify the tests fail because the extraction module is absent**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin packages/backend/tests/test_skill_extraction.py -v
```

Expected: collection fails with `ModuleNotFoundError`.

- [ ] **Step 4: Implement evidence blocks and requirement classification**

Use these public result types:

```python
from dataclasses import dataclass
from enum import Enum


CONFIRMED_CONFIDENCE = 0.80


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


@dataclass(frozen=True)
class SkillMatch:
    skill: str
    category: str
    requirement_type: RequirementType
    evidence_text: str
    confidence: float
    match_reason: str
    position: int
```

Normalize headings by removing emoji, surrounding brackets, Markdown `#`,
trailing punctuation, and repeated whitespace. Match explicit normalized phrase
sets:

```python
REQUIRED_HEADINGS = {
    "자격 요건", "자격요건", "필수 자격 요건", "지원 자격",
    "이런 분을 찾고 있어요", "이런 분들을 찾고 있어요",
    "이런 분과 함께하고 싶어요", "함께하기 위해 필요한 기본 요건이에요",
    "이런 기술이 필요해요",
}
PREFERRED_HEADINGS = {
    "우대 사항", "우대사항", "일반 우대사항",
    "이런 분이면 더 좋아요", "이런 분이라면 더 좋아요",
    "preferred", "nice to have",
}
TECHNICAL_HEADINGS = {
    "사용중인 기술", "이런 기술들을 사용하고 있어요",
    "기술 스택", "tech stack",
}
```

Any real `h1`-`h6` resets the current section, including unrecognized headings.
A short leaf `p`, `div`, `strong`, or `b` becomes a pseudo-heading only when it
matches one of the explicit heading sets. Emit `li` and leaf `p` evidence
blocks. If HTML yields no blocks, split `description_text` on newlines and
sentence terminators.

Local `우대`, `선호`, `있으면 좋아요` phrases override to `preferred`; local
`필수`, `반드시` phrases override to `required`.

- [ ] **Step 5: Implement policy-aware matching and deterministic merging**

Implement boundary matching against the original text. For case-insensitive
aliases, compare a lowercased copy but preserve original indices. Apply
`negative_patterns` before positive context.

Use exact scores:

```python
DISTINCT_SCORE = 1.00
STRONG_CONTEXT_SCORE = 0.95
SECTION_CONTEXT_SCORE = 0.85
CANDIDATE_SCORE = 0.50
```

Special behavior:

- `C++` accepts optional `11|14|17|20|23` suffixes.
- `C` accepts `C/C++`, explicit language/development phrases, or firmware/
  embedded/RTOS context; it never matches the `C` inside `C++` as a separate
  occurrence unless the text explicitly contains `C/C++`.
- `Go` rejects `Go-to-Market`; lowercase `go` only matches `go.mod`,
  `go test`, or `go build`.
- `R` rejects `R&D` and `Cortex-M/R`; it accepts data-language lists and
  statistics/data-analysis context.
- `contextual` aliases require a technical section, one of their context terms,
  or another confirmed skill in the same list-style block.

Merge matches by canonical skill with this key:

```python
REQUIREMENT_PRIORITY = {
    RequirementType.REQUIRED: 3,
    RequirementType.PREFERRED: 2,
    RequirementType.UNSPECIFIED: 1,
}


def match_priority(match: SkillMatch) -> tuple[int, float, int]:
    return (
        REQUIREMENT_PRIORITY[match.requirement_type],
        match.confidence,
        -match.position,
    )
```

Sort the final list by canonical skill for stable output.

- [ ] **Step 6: Restore the legacy extractor as a confirmed-only facade**

In `ejikfit.skills`:

```python
def extract_skills(text: str) -> list[str]:
    return sorted(
        match.skill
        for match in extract_skill_matches(
            title="",
            description_html="",
            description_text=text,
        )
        if match.confidence >= CONFIRMED_CONFIDENCE
    )
```

Update existing tests only where the old test assumed all aliases were
case-insensitive. Add paired positive/negative cases for every alias returned by
`aliases_requiring_context()` and assert:

```python
assert set(RISKY_GOLDENS) == {
    (skill.canonical, alias.value)
    for skill, alias in aliases_requiring_context()
}
```

At this point, replace the old in-module catalog in `ejikfit.skills` with
re-exports from `skill_catalog`.

- [ ] **Step 7: Run pure extraction tests**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_skill_catalog.py \
  packages/backend/tests/test_skill_extraction.py \
  packages/backend/tests/test_skills.py -v
```

Expected: all tests pass.

- [ ] **Step 8: Commit the extraction pipeline**

```bash
git add packages/backend/src/ejikfit/skill_extraction.py \
  packages/backend/src/ejikfit/skills.py \
  packages/backend/tests/test_skill_extraction.py \
  packages/backend/tests/test_skills.py
git commit -m "feat: extract contextual skill evidence"
```

---

### Task 3: Persist Skill Evidence and Keep Synchronization Idempotent

**Files:**
- Create: `packages/backend/alembic/versions/20260706_0004_skill_evidence.py`
- Modify: `packages/backend/src/ejikfit/models.py`
- Modify: `packages/backend/src/ejikfit/skills.py`
- Modify: `packages/backend/tests/test_posting_skills.py`
- Modify: `packages/backend/tests/test_models.py`
- Modify: `packages/backend/tests/test_migration_offline.py`

**Interfaces:**
- `PostingSkill.requirement_type: str`
- `PostingSkill.evidence_text: str | None`
- `PostingSkill.confidence: float`
- `PostingSkill.match_reason: str`
- `sync_posting_skills(session, posting) -> list[str]` remains confirmed-only.

- [ ] **Step 1: Extend DB synchronization tests before changing the model**

Add assertions after synchronizing HTML-backed postings:

```python
def test_sync_stores_evidence_type_confidence_and_reason() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        posting = _make_posting(session, "백엔드 엔지니어", "")
        posting.description_html = (
            "<h2>자격 요건</h2>"
            "<ul><li>Go 언어 기반 백엔드 개발 경험</li></ul>"
        )
        returned = sync_posting_skills(session, posting)
        session.commit()

        row = session.scalar(
            select(PostingSkill).where(PostingSkill.skill == "Go")
        )
        assert returned == ["Go"]
        assert row.requirement_type == "required"
        assert row.evidence_text == "Go 언어 기반 백엔드 개발 경험"
        assert row.confidence == 0.95
        assert row.match_reason


def test_sync_preserves_but_does_not_return_low_confidence_candidate() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        posting = _make_posting(session, "개발자", "Go")
        returned = sync_posting_skills(session, posting)
        session.commit()
        row = session.scalar(select(PostingSkill))
        assert returned == []
        assert row.skill == "Go"
        assert row.confidence == 0.50
```

Extend the existing update test so a second sync changes
`requirement_type`, `evidence_text`, `confidence`, and `match_reason` without
creating a second `(posting_id, skill)` row.

- [ ] **Step 2: Run the focused test and verify the missing-column failure**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin packages/backend/tests/test_posting_skills.py -v
```

Expected: failure because `PostingSkill` lacks the new fields.

- [ ] **Step 3: Add model fields and migration**

Model fields:

```python
from sqlalchemy import Float


requirement_type: Mapped[str] = mapped_column(
    String(20), default="unspecified"
)
evidence_text: Mapped[str | None] = mapped_column(Text, nullable=True)
confidence: Mapped[float] = mapped_column(Float, default=0.5)
match_reason: Mapped[str] = mapped_column(
    String(100), default="legacy_backfill"
)
```

Migration `20260706_0004` must use:

```python
op.add_column(
    "posting_skills",
    sa.Column(
        "requirement_type",
        sa.String(length=20),
        server_default="unspecified",
        nullable=False,
    ),
)
op.add_column(
    "posting_skills",
    sa.Column("evidence_text", sa.Text(), nullable=True),
)
op.add_column(
    "posting_skills",
    sa.Column(
        "confidence",
        sa.Float(),
        server_default=sa.text("0.5"),
        nullable=False,
    ),
)
op.add_column(
    "posting_skills",
    sa.Column(
        "match_reason",
        sa.String(length=100),
        server_default="legacy_backfill",
        nullable=False,
    ),
)
```

Downgrade drops the four columns in reverse order.

- [ ] **Step 4: Update synchronization to upsert all derived fields**

Call:

```python
matches = extract_skill_matches(
    title=posting.title,
    description_html=posting.description_html,
    description_text=posting.description_text,
)
```

For every match, set all structured fields on both new and existing rows.
Delete rows absent from `matches`. Return sorted skill names whose
`confidence >= CONFIRMED_CONFIDENCE`.

- [ ] **Step 5: Add offline migration assertions**

Extend the offline migration test to assert the generated SQL contains:

```python
assert "requirement_type" in sql
assert "evidence_text" in sql
assert "confidence" in sql
assert "match_reason" in sql
```

- [ ] **Step 6: Run model, sync, and migration tests**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_models.py \
  packages/backend/tests/test_posting_skills.py \
  packages/backend/tests/test_migration_offline.py -v

.venv/bin/alembic -c packages/backend/alembic.ini \
  upgrade head --sql >/tmp/ejikfit-skill-evidence.sql
rg -n 'requirement_type|evidence_text|confidence|match_reason' \
  /tmp/ejikfit-skill-evidence.sql
```

Expected: tests pass and all four columns occur in offline SQL.

- [ ] **Step 7: Commit persistence**

```bash
git add packages/backend/alembic/versions/20260706_0004_skill_evidence.py \
  packages/backend/src/ejikfit/models.py \
  packages/backend/src/ejikfit/skills.py \
  packages/backend/tests/test_models.py \
  packages/backend/tests/test_posting_skills.py \
  packages/backend/tests/test_migration_offline.py
git commit -m "feat: persist skill evidence and confidence"
```

---

### Task 4: Extend Posting and Skill Statistics APIs Without Breaking Clients

**Files:**
- Modify: `packages/backend/src/ejikfit/api/schemas.py`
- Modify: `packages/backend/src/ejikfit/api/postings.py`
- Modify: `packages/backend/src/ejikfit/api/skills.py`
- Modify: `packages/backend/tests/test_postings_api.py`
- Modify: `packages/backend/tests/test_skills_api.py`

**Interfaces:**
- Adds `PostingDetail.skill_details: list[SkillDetail]`.
- Adds `required_count`, `preferred_count`, and `unspecified_count` to each skill stat.
- Keeps all existing fields and types.

- [ ] **Step 1: Write failing posting-detail compatibility tests**

Extend `FakePostingReader` with `get()` returning:

```python
{
    "id": "00000000-0000-0000-0000-000000000001",
    "title": "백엔드 개발자",
    "company_name": "테스트 기업",
    "location": "서울",
    "source_url": "https://example.com/o/1",
    "last_verified_at": datetime(2026, 7, 3, tzinfo=timezone.utc),
    "description_html": "<p>Go 개발</p>",
    "description_text": "Go 개발",
    "skills": ["Go"],
    "skill_details": [
        {
            "skill": "Go",
            "category": "language",
            "requirement_type": "required",
            "evidence_text": "Go 개발",
            "confidence": 0.95,
            "match_reason": "strict_alias_with_context",
        }
    ],
}
```

Assert both `skills == ["Go"]` and the structured detail are returned.

- [ ] **Step 2: Write failing statistics tests**

Update fake results and expected JSON to include:

```python
{
    "skill": "Python",
    "category": "language",
    "count": 12,
    "required_count": 7,
    "preferred_count": 3,
    "unspecified_count": 2,
}
```

In the database reader test, create:

- confirmed required Python,
- confirmed preferred Python,
- confirmed unspecified AWS,
- low-confidence Go,
- closed confirmed Python.

Assert Go is absent, Python has total `2`, required `1`, preferred `1`, and
AWS has unspecified `1`.

- [ ] **Step 3: Run API tests and verify schema/reader failures**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_postings_api.py \
  packages/backend/tests/test_skills_api.py -v
```

Expected: failures because structured fields and aggregates do not exist.

- [ ] **Step 4: Add Pydantic response models**

```python
class SkillDetail(BaseModel):
    skill: str
    category: str
    requirement_type: str
    evidence_text: str | None = None
    confidence: float
    match_reason: str


class PostingDetail(PostingSummary):
    description_html: str
    description_text: str
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    skills: list[str] = []
    skill_details: list[SkillDetail] = []


class SkillStat(BaseModel):
    skill: str
    category: str
    count: int
    required_count: int
    preferred_count: int
    unspecified_count: int
```

- [ ] **Step 5: Filter and serialize confirmed posting skills**

In `_detail`, sort confirmed rows by
`(requirement_type order, skill)` and use the same rows for both fields:

```python
confirmed = [
    skill
    for skill in posting.skills
    if skill.confidence >= CONFIRMED_CONFIDENCE
]
```

Build `skills` from names and `skill_details` from all six structured fields.

- [ ] **Step 6: Add confirmed-only conditional aggregate counts**

Use `sqlalchemy.case` with distinct posting IDs:

```python
required_count = func.count(
    func.distinct(
        case(
            (
                PostingSkill.requirement_type == "required",
                PostingSkill.posting_id,
            ),
        )
    )
)
```

Create equivalent preferred and unspecified expressions. Add
`PostingSkill.confidence >= CONFIRMED_CONFIDENCE` to the query. Keep `count`
as the distinct total and preserve existing ordering.

- [ ] **Step 7: Run API and backend regression tests**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_postings_api.py \
  packages/backend/tests/test_skills_api.py -v

PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin packages/backend/tests -v
```

Expected: all backend tests pass.

- [ ] **Step 8: Commit API changes**

```bash
git add packages/backend/src/ejikfit/api/schemas.py \
  packages/backend/src/ejikfit/api/postings.py \
  packages/backend/src/ejikfit/api/skills.py \
  packages/backend/tests/test_postings_api.py \
  packages/backend/tests/test_skills_api.py
git commit -m "feat: expose skill evidence and requirement counts"
```

---

### Task 5: Show Grouped Skill Evidence in the Web App

**Files:**
- Create: `apps/web/src/components/skill-evidence.tsx`
- Create: `apps/web/src/components/skill-evidence.test.tsx`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/app/jobs/[id]/page.tsx`
- Modify: `apps/web/src/components/skill-ranking.tsx`
- Modify: `apps/web/src/components/skill-ranking.test.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- `SkillDetail` mirrors the backend object.
- `SkillEvidence({ skills }: { skills: SkillDetail[] })` renders non-empty groups.

- [ ] **Step 1: Add failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkillEvidence } from "./skill-evidence";


const skills = [
  {
    skill: "Go",
    category: "language",
    requirement_type: "required",
    evidence_text: "Go 기반 백엔드 개발 경험",
    confidence: 0.95,
    match_reason: "strict_alias_with_context",
  },
  {
    skill: "AWS",
    category: "infra",
    requirement_type: "preferred",
    evidence_text: "AWS 운영 경험자 우대",
    confidence: 1,
    match_reason: "distinct_alias",
  },
  {
    skill: "Docker",
    category: "infra",
    requirement_type: "unspecified",
    evidence_text: "사용 기술: Docker",
    confidence: 1,
    match_reason: "distinct_alias",
  },
];


describe("SkillEvidence", () => {
  it("groups skills and renders their source evidence", () => {
    render(<SkillEvidence skills={skills} />);
    expect(screen.getByText("필수 기술")).toBeInTheDocument();
    expect(screen.getByText("우대 기술")).toBeInTheDocument();
    expect(screen.getByText("공고에 언급된 기술")).toBeInTheDocument();
    expect(screen.getByText("Go 기반 백엔드 개발 경험")).toBeInTheDocument();
  });

  it("does not render empty groups", () => {
    render(<SkillEvidence skills={[skills[0]]} />);
    expect(screen.queryByText("우대 기술")).not.toBeInTheDocument();
  });
});
```

Extend ranking test data with requirement counts and assert text:

```tsx
expect(screen.getByText("필수 24 · 우대 10")).toBeInTheDocument();
```

- [ ] **Step 2: Run focused web tests and verify failures**

Run:

```bash
cd apps/web
npm test -- --run \
  src/components/skill-evidence.test.tsx \
  src/components/skill-ranking.test.tsx
```

Expected: missing component/type failures.

- [ ] **Step 3: Add TypeScript contracts**

```typescript
export type SkillDetail = {
  skill: string;
  category: string;
  requirement_type: "required" | "preferred" | "unspecified";
  evidence_text: string | null;
  confidence: number;
  match_reason: string;
};

export type PostingDetail = PostingSummary & {
  description_html: string;
  description_text: string;
  opens_at: string | null;
  closes_at: string | null;
  skills: string[];
  skill_details: SkillDetail[];
};

export type SkillStat = {
  skill: string;
  category: string;
  count: number;
  required_count: number;
  preferred_count: number;
  unspecified_count: number;
};
```

- [ ] **Step 4: Implement the grouped evidence component**

Use a fixed group definition:

```tsx
const GROUPS = [
  { type: "required", label: "필수 기술" },
  { type: "preferred", label: "우대 기술" },
  { type: "unspecified", label: "공고에 언급된 기술" },
] as const;
```

For each non-empty group, render a heading and list. Each list item contains the
skill name and, when non-null, a `<q>` evidence element. Do not expose
confidence or `match_reason` as user-facing probability claims.

Replace the old `job.skills` tag section in the detail page with:

```tsx
<SkillEvidence skills={job.skill_details} />
```

- [ ] **Step 5: Add requirement breakdown to ranking**

Below the existing count, render:

```tsx
<span className="skill-ranking__breakdown">
  필수 {stat.required_count} · 우대 {stat.preferred_count}
</span>
```

Keep the existing total bar calculation.

- [ ] **Step 6: Add responsive styles**

Add flat, border-separated evidence groups with the following styles:

```css
.skill-evidence {
  padding: 48px 0;
  border-bottom: 1px solid var(--line);
}

.skill-evidence__group + .skill-evidence__group {
  margin-top: 36px;
}

.skill-evidence__group h2 {
  margin: 0 0 18px;
  font-size: 20px;
  letter-spacing: -0.03em;
}

.skill-evidence__list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}

.skill-evidence__item {
  display: grid;
  grid-template-columns: minmax(120px, 0.35fr) minmax(0, 1fr);
  gap: 24px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}

.skill-evidence__name {
  color: var(--accent);
  font-weight: 720;
}

.skill-evidence__quote {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.skill-ranking__breakdown {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 767px) {
  .skill-evidence__item {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
```

Use no gradients, nested card shells, or confidence-color scoring. On mobile,
stack the skill name above the evidence.

- [ ] **Step 7: Run web tests, lint, and build**

Run:

```bash
cd apps/web
npm test -- --run
npm run lint
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 8: Commit the web UI**

```bash
git add apps/web/src/components/skill-evidence.tsx \
  apps/web/src/components/skill-evidence.test.tsx \
  apps/web/src/lib/types.ts \
  'apps/web/src/app/jobs/[id]/page.tsx' \
  apps/web/src/components/skill-ranking.tsx \
  apps/web/src/components/skill-ranking.test.tsx \
  apps/web/src/app/globals.css
git commit -m "feat: show required and preferred skill evidence"
```

---

### Task 6: Document, Audit Production Samples, and Run Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment/access-and-auth.md`

**Interfaces:**
- Documents the structured API fields, deterministic confidence threshold, and production backfill procedure.

- [ ] **Step 1: Update user and operations documentation**

Add to the README skill-intelligence section:

```markdown
- 상세 API는 스킬별 필수·우대 구분, 원문 근거, 규칙 기반 신뢰도를 제공합니다.
- `C`, `Go`, `R`과 일반 단어형 기술명은 별칭별 문맥 정책으로 검증합니다.
- 신뢰도 `0.80` 미만 후보는 보존하지만 공개 통계와 기본 화면에서는 제외합니다.
```

Add the production refresh command to the operations guide:

```bash
gh workflow run crawl.yml --repo NoirStar/ejik-fit
```

State that `alembic upgrade head` runs before crawl and every fetched posting
recomputes its skill relations.

- [ ] **Step 2: Run the full local verification suite**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin packages/backend/tests -v

.venv/bin/alembic -c packages/backend/alembic.ini \
  upgrade head --sql >/tmp/ejikfit-migration.sql

rg -n 'posting_skills|requirement_type|evidence_text|confidence|match_reason' \
  /tmp/ejikfit-migration.sql

cd apps/web
npm test -- --run
npm run lint
npm run build
```

Expected: backend tests, migration generation, web tests, lint, and build all
pass.

- [ ] **Step 3: Run a read-only production corpus audit**

Fetch all 130 current open postings by the ten seeded company slugs through the
public API. Apply `extract_skill_matches()` locally to each returned detail
without writing to Supabase.

The audit must report, without secrets or full private payloads:

```text
postings_analyzed=<count>
confirmed_C=<count>
confirmed_C++=<count>
confirmed_Go=<count>
confirmed_R=<count>
known_false_positive_matches=0
```

Manually compare every confirmed or candidate `C`, `C++`, `Go`, and `R` result
against the validated expressions in the design document. If a mismatch is
found, add a failing golden test first, then correct the policy and rerun the
entire audit.

- [ ] **Step 4: Review the final diff and repository state**

Run:

```bash
git diff --check
git status --short
git log --oneline -8
```

Confirm only task files and the pre-existing untracked `.agents/` directory
remain.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md docs/deployment/access-and-auth.md
git commit -m "docs: explain contextual skill evidence"
```

- [ ] **Step 6: Do not deploy without a separate publish decision**

Stop after local verification. Pushing, opening a PR, merging, and triggering
the production crawl are external publication steps and require the user's
explicit publish instruction.
