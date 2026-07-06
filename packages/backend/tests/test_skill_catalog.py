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
