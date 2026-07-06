import pytest

from ejikfit.skill_catalog import aliases_requiring_context
from ejikfit.skill_extraction import (
    RequirementType,
    extract_skill_matches,
)


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


def confirmed_names(text: str) -> list[str]:
    return [
        match.skill
        for match in extract_skill_matches(
            title="",
            description_html="",
            description_text=text,
        )
        if match.confidence >= 0.80
    ]


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


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("C/C++ 프로그래밍 능력", ["C", "C++"]),
        ("C++17 기반 게임 엔진 개발", ["C++"]),
        (
            "Go/TypeScript/Solidity 중 1개 이상 실무 활용",
            ["Go", "TypeScript"],
        ),
        ("Golang 기반 백엔드 개발", ["Go"]),
        ("Python, R, SQL을 사용한 통계 분석", ["Python", "R", "SQL"]),
        ("RStudio와 R Shiny 경험", ["R"]),
    ],
)
def test_confirms_ambiguous_aliases_in_technical_context(
    text: str, expected: list[str]
) -> None:
    assert sorted(confirmed_names(text)) == sorted(expected)


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
    assert confirmed_names(text) == []


def test_keeps_unresolved_strict_alias_as_low_confidence_candidate() -> None:
    matches = extract_skill_matches(
        title="",
        description_html="",
        description_text="Go",
    )
    assert [(match.skill, match.confidence) for match in matches] == [
        ("Go", 0.50)
    ]


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
    assert canonical in confirmed_names(positive)
    assert canonical not in confirmed_names(negative)


def test_golden_registry_covers_every_contextual_or_strict_alias() -> None:
    assert set(RISKY_GOLDENS) == {
        (skill.canonical, alias.value)
        for skill, alias in aliases_requiring_context()
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


def test_required_match_wins_when_skill_appears_in_multiple_sections() -> None:
    html = """
    <h2>우대 사항</h2><p>Python 경험</p>
    <h2>자격 요건</h2><p>Python 개발 필수</p>
    """
    match = by_skill(html)["Python"]
    assert match.requirement_type is RequirementType.REQUIRED
    assert match.evidence_text == "Python 개발 필수"


def test_unrecognized_real_heading_resets_previous_section() -> None:
    html = """
    <h2>자격 요건</h2><p>Python 개발 경험</p>
    <h2>주요 업무</h2><p>Docker로 서비스를 배포합니다</p>
    """
    matches = by_skill(html)
    assert matches["Docker"].requirement_type is RequirementType.UNSPECIFIED
