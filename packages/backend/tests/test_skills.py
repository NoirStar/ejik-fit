from ejikfit.skills import (
    SKILL_CATEGORY,
    extract_skills,
    skill_category,
)


def test_extracts_english_skills_from_mixed_korean_text() -> None:
    text = "백엔드 엔지니어로서 Python과 FastAPI, PostgreSQL 경험이 필요합니다."
    assert extract_skills(text) == ["FastAPI", "PostgreSQL", "Python"]


def test_java_is_not_matched_inside_javascript() -> None:
    assert extract_skills("JavaScript 개발자") == ["JavaScript"]
    assert "Java" not in extract_skills("JavaScript 개발자")


def test_aliases_map_to_canonical_name() -> None:
    assert extract_skills("k8s 클러스터 운영") == ["Kubernetes"]
    assert extract_skills("리액트 기반 프론트엔드") == ["React"]
    assert extract_skills("쿠버네티스와 도커") == ["Docker", "Kubernetes"]


def test_matching_is_case_insensitive() -> None:
    assert extract_skills("PYTHON, python, Python") == ["Python"]


def test_result_is_deduplicated_and_sorted() -> None:
    text = "AWS, aws, 그리고 Docker와 docker를 다룹니다."
    assert extract_skills(text) == ["AWS", "Docker"]


def test_plus_and_hash_languages_are_distinct() -> None:
    assert extract_skills("C++ 로 게임 엔진 개발") == ["C++"]
    assert extract_skills("C# 과 Unity") == ["C#", "Unity"]
    # bare "c" must not trigger a C++/C# match
    assert extract_skills("이 문장에는 스킬이 없다") == []


def test_korean_common_words_do_not_trigger_false_positives() -> None:
    # "뷰" appears inside 인터뷰/리뷰/뷰티 — it must not be read as Vue.
    assert extract_skills("인터뷰 후 리뷰를 진행하고 뷰티 브랜드와 협업") == []
    # "Unity" must not match inside "community".
    assert extract_skills("community 관리 경험") == []


def test_no_skills_returns_empty_list() -> None:
    assert extract_skills("") == []
    assert extract_skills("좋은 팀 문화와 성장 기회를 제공합니다.") == []


def test_every_canonical_has_a_category() -> None:
    found = extract_skills("Python, React, AWS, Kubernetes, TensorFlow")
    for name in found:
        assert skill_category(name) in SKILL_CATEGORY.values()
        assert skill_category(name)  # non-empty
