from __future__ import annotations

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


DEVELOPMENT_CONTEXT = (
    "개발",
    "프로그래밍",
    "언어",
    "백엔드",
    "서버",
    "developer",
    "programming",
    "language",
    "backend",
    "server",
)


SKILLS: tuple[SkillDef, ...] = (
    # languages
    SkillDef("Python", "language", (distinct("python"),)),
    SkillDef(
        "Java",
        "language",
        (
            contextual(
                "java",
                context_terms=DEVELOPMENT_CONTEXT + ("jvm", "spring"),
            ),
        ),
    ),
    SkillDef("JavaScript", "language", (distinct("javascript"),)),
    SkillDef("TypeScript", "language", (distinct("typescript"),)),
    SkillDef("Kotlin", "language", (distinct("kotlin"),)),
    SkillDef(
        "Swift",
        "language",
        (
            contextual(
                "swift",
                context_terms=DEVELOPMENT_CONTEXT + ("ios", "apple", "xcode", "앱"),
                negative_patterns=(r"\bswift\s+(송금|결제|전문)\b",),
            ),
        ),
    ),
    SkillDef(
        "Go",
        "language",
        (
            strict(
                "Go",
                context_terms=DEVELOPMENT_CONTEXT + ("framework",),
                negative_patterns=(r"\bgo-to-market\b", r"\bgo to\b"),
            ),
            distinct("golang"),
        ),
    ),
    SkillDef(
        "Rust",
        "language",
        (
            contextual(
                "rust",
                context_terms=DEVELOPMENT_CONTEXT + ("cargo",),
            ),
        ),
    ),
    SkillDef(
        "C",
        "language",
        (
            strict(
                "C",
                context_terms=DEVELOPMENT_CONTEXT
                + (
                    "펌웨어",
                    "임베디드",
                    "컴파일러",
                    "rtos",
                    "firmware",
                    "embedded",
                    "compiler",
                ),
                negative_patterns=(
                    r"\bc[- ]level\b",
                    r"\bvitamin c\b",
                    r"\ba/b/c\b",
                ),
            ),
        ),
    ),
    SkillDef("C++", "language", (distinct("c++"),)),
    SkillDef("C#", "language", (distinct("c#"),)),
    SkillDef(
        "R",
        "language",
        (
            strict(
                "R",
                context_terms=(
                    "통계",
                    "데이터",
                    "분석",
                    "모델링",
                    "시각화",
                    "statistics",
                    "data",
                    "analytics",
                    "modeling",
                ),
                negative_patterns=(r"\br&d\b", r"\bcortex-m/r\b"),
            ),
            distinct("rstudio"),
            distinct("r shiny"),
        ),
    ),
    SkillDef(
        "Ruby",
        "language",
        (
            contextual(
                "ruby",
                context_terms=DEVELOPMENT_CONTEXT + ("rails",),
            ),
        ),
    ),
    SkillDef("PHP", "language", (distinct("php"),)),
    SkillDef(
        "Scala",
        "language",
        (
            contextual(
                "scala",
                context_terms=DEVELOPMENT_CONTEXT + ("jvm", "spark"),
            ),
        ),
    ),
    SkillDef("SQL", "language", (distinct("sql"),)),
    # frontend
    SkillDef(
        "React",
        "frontend",
        (
            contextual(
                "react",
                context_terms=(
                    "프론트엔드",
                    "개발",
                    "컴포넌트",
                    "javascript",
                    "typescript",
                    "frontend",
                    "component",
                ),
            ),
            distinct("리액트"),
        ),
    ),
    SkillDef("Vue", "frontend", (distinct("vue.js"), distinct("vuejs"), distinct("vue"))),
    SkillDef("Next.js", "frontend", (distinct("next.js"), distinct("nextjs"))),
    SkillDef("Angular", "frontend", (distinct("angular"),)),
    SkillDef("Svelte", "frontend", (distinct("svelte"),)),
    # backend
    SkillDef("Node.js", "backend", (distinct("node.js"), distinct("nodejs"))),
    SkillDef(
        "Spring",
        "backend",
        (
            distinct("spring boot"),
            distinct("springboot"),
            contextual(
                "spring",
                context_terms=(
                    "java",
                    "백엔드",
                    "개발",
                    "프레임워크",
                    "backend",
                    "framework",
                    "boot",
                ),
            ),
        ),
    ),
    SkillDef("FastAPI", "backend", (distinct("fastapi"),)),
    SkillDef("Django", "backend", (distinct("django"),)),
    SkillDef(
        "Flask",
        "backend",
        (
            contextual(
                "flask",
                context_terms=("python", "api", "백엔드", "개발", "framework"),
            ),
        ),
    ),
    SkillDef("NestJS", "backend", (distinct("nestjs"), distinct("nest.js"))),
    # infra
    SkillDef("Docker", "infra", (distinct("docker"), distinct("도커"))),
    SkillDef(
        "Kubernetes",
        "infra",
        (distinct("kubernetes"), distinct("k8s"), distinct("쿠버네티스")),
    ),
    SkillDef("AWS", "infra", (distinct("aws"),)),
    SkillDef("GCP", "infra", (distinct("gcp"),)),
    SkillDef("Azure", "infra", (distinct("azure"),)),
    SkillDef("Terraform", "infra", (distinct("terraform"),)),
    SkillDef(
        "Kafka",
        "infra",
        (
            contextual(
                "kafka",
                context_terms=(
                    "메시지",
                    "스트리밍",
                    "이벤트",
                    "파이프라인",
                    "broker",
                    "stream",
                    "event",
                    "pipeline",
                ),
            ),
        ),
    ),
    SkillDef("Nginx", "infra", (distinct("nginx"),)),
    SkillDef("Linux", "infra", (distinct("linux"),)),
    # data
    SkillDef("PostgreSQL", "data", (distinct("postgresql"), distinct("postgres"))),
    SkillDef("MySQL", "data", (distinct("mysql"),)),
    SkillDef("MongoDB", "data", (distinct("mongodb"),)),
    SkillDef("Redis", "data", (distinct("redis"),)),
    SkillDef("Elasticsearch", "data", (distinct("elasticsearch"),)),
    # ai
    SkillDef("TensorFlow", "ai", (distinct("tensorflow"),)),
    SkillDef("PyTorch", "ai", (distinct("pytorch"),)),
    # security
    SkillDef("OWASP", "security", (distinct("owasp"),)),
    SkillDef("SIEM", "security", (distinct("siem"),)),
    SkillDef("Wireshark", "security", (distinct("wireshark"),)),
    # game
    SkillDef(
        "Unity",
        "game",
        (
            contextual(
                "unity",
                context_terms=("게임", "개발", "엔진", "game", "engine"),
            ),
        ),
    ),
    SkillDef(
        "Unreal Engine",
        "game",
        (distinct("unreal engine"), distinct("unreal"), distinct("언리얼")),
    ),
    # robotics
    SkillDef(
        "ROS",
        "robotics",
        (
            distinct("ros2"),
            distinct("ros 2"),
            contextual(
                "ros",
                context_terms=("로봇", "개발", "미들웨어", "robot", "robotics"),
            ),
        ),
    ),
    SkillDef(
        "SLAM",
        "robotics",
        (
            contextual(
                "slam",
                context_terms=(
                    "로봇",
                    "자율주행",
                    "알고리즘",
                    "localization",
                    "mapping",
                    "robot",
                ),
            ),
        ),
    ),
    SkillDef(
        "Gazebo",
        "robotics",
        (
            contextual(
                "gazebo",
                context_terms=("로봇", "시뮬레이션", "robot", "simulation"),
            ),
        ),
    ),
    # mobile
    SkillDef(
        "Android",
        "mobile",
        (
            contextual(
                "android",
                context_terms=("앱", "모바일", "개발", "kotlin", "mobile"),
            ),
        ),
    ),
    SkillDef("iOS", "mobile", (distinct("ios"),)),
    SkillDef(
        "Flutter",
        "mobile",
        (
            contextual(
                "flutter",
                context_terms=("앱", "모바일", "개발", "dart", "mobile"),
            ),
        ),
    ),
)


SKILL_CATEGORY: dict[str, str] = {
    skill.canonical: skill.category for skill in SKILLS
}


def skill_category(canonical: str) -> str:
    return SKILL_CATEGORY.get(canonical, "")


def aliases_requiring_context() -> list[tuple[SkillDef, AliasDef]]:
    return [
        (skill, alias)
        for skill in SKILLS
        for alias in skill.aliases
        if alias.policy is not AliasPolicy.DISTINCT
    ]
