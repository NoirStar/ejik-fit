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


@dataclass(frozen=True)
class SkillMetadata:
    kind: str
    domains: tuple[str, ...]


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
    "구현",
    "활용",
    "developer",
    "programming",
    "language",
    "backend",
    "server",
    "implementation",
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
    SkillDef("CUDA", "ai", (distinct("cuda"),)),
    SkillDef(
        "OpenCV",
        "ai",
        (
            distinct("opencv"),
            distinct("open cv"),
        ),
    ),
    SkillDef("LLM", "ai", (distinct("llm"),)),
    SkillDef(
        "RAG",
        "ai",
        (
            contextual(
                "rag",
                context_terms=("llm", "검색", "retrieval", "generation", "engine", "엔진"),
            ),
        ),
    ),
    SkillDef("LangChain", "ai", (distinct("langchain"),)),
    SkillDef("MLOps", "ai", (distinct("mlops"),)),
    SkillDef("Feature Store", "ai", (distinct("feature store"),)),
    SkillDef("Model Serving", "ai", (distinct("model serving"), distinct("모델 서빙"))),
    # security
    SkillDef("OWASP", "security", (distinct("owasp"),)),
    SkillDef("SIEM", "security", (distinct("siem"),)),
    SkillDef("Wireshark", "security", (distinct("wireshark"),)),
    SkillDef("OAuth", "security", (distinct("oauth"), distinct("oauth2"))),
    SkillDef("JWT", "security", (distinct("jwt"),)),
    SkillDef("IAM", "security", (distinct("iam"),)),
    SkillDef("SSO", "security", (distinct("sso"),)),
    # game
    SkillDef(
        "Unity",
        "game",
        (
            contextual(
                "unity",
                context_terms=("게임", "개발", "엔진", "game", "engine", "3d", "아티스트", "artist"),
            ),
        ),
    ),
    SkillDef(
        "Unreal Engine",
        "game",
        (distinct("unreal engine"), distinct("unreal"), distinct("언리얼")),
    ),
    SkillDef(
        "Blender",
        "game",
        (
            contextual(
                "blender",
                context_terms=("3d", "artist", "아티스트", "모델링", "graphics", "game"),
            ),
        ),
    ),
    SkillDef(
        "Maya",
        "game",
        (
            contextual(
                "maya",
                context_terms=("3d", "artist", "아티스트", "모델링", "graphics", "game"),
            ),
        ),
    ),
    SkillDef("Photoshop", "game", (distinct("photoshop"),)),
    SkillDef(
        "Illustrator",
        "game",
        (
            contextual(
                "illustrator",
                context_terms=("adobe", "design", "디자인", "아트", "artist", "game"),
            ),
        ),
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
    # embedded
    SkillDef(
        "CAN",
        "embedded",
        (
            strict(
                "CAN",
                context_terms=("임베디드", "차량", "자동차", "통신", "embedded", "automotive", "vehicle"),
                negative_patterns=(r"\bcan\s+(?:join|use|work|make|see)\b",),
            ),
        ),
    ),
    SkillDef("RTOS", "embedded", (distinct("rtos"),)),
    SkillDef("UART", "embedded", (distinct("uart"),)),
    SkillDef("SPI", "embedded", (distinct("spi"),)),
    SkillDef("I2C", "embedded", (distinct("i2c"),)),
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
    # design/product/qa
    SkillDef("Jira", "qa", (distinct("jira"),)),
    SkillDef("Figma", "design", (distinct("figma"),)),
    SkillDef("Selenium", "qa", (distinct("selenium"),)),
    SkillDef("Playwright", "qa", (distinct("playwright"),)),
)


SKILL_CATEGORY: dict[str, str] = {
    skill.canonical: skill.category for skill in SKILLS
}

SKILL_METADATA: dict[str, SkillMetadata] = {
    "Python": SkillMetadata("language", ("backend", "data", "ai", "mlops")),
    "Java": SkillMetadata("language", ("backend", "web")),
    "JavaScript": SkillMetadata("language", ("frontend", "web", "backend")),
    "TypeScript": SkillMetadata("language", ("frontend", "web", "backend")),
    "Kotlin": SkillMetadata("language", ("backend", "mobile")),
    "Swift": SkillMetadata("language", ("mobile",)),
    "Go": SkillMetadata("language", ("backend", "cloud", "devops")),
    "Rust": SkillMetadata("language", ("backend", "embedded", "high_performance")),
    "C": SkillMetadata("language", ("embedded", "automotive", "robotics")),
    "C++": SkillMetadata("language", ("game", "graphics", "robotics", "autonomy", "embedded", "backend", "ai")),
    "C#": SkillMetadata("language", ("game", "backend")),
    "R": SkillMetadata("language", ("data", "ai")),
    "Ruby": SkillMetadata("language", ("backend", "web")),
    "PHP": SkillMetadata("language", ("backend", "web")),
    "Scala": SkillMetadata("language", ("backend", "data")),
    "SQL": SkillMetadata("language", ("data", "backend", "ai")),
    "React": SkillMetadata("framework", ("frontend", "web")),
    "Vue": SkillMetadata("framework", ("frontend", "web")),
    "Next.js": SkillMetadata("framework", ("frontend", "web", "backend")),
    "Angular": SkillMetadata("framework", ("frontend", "web")),
    "Svelte": SkillMetadata("framework", ("frontend", "web")),
    "Node.js": SkillMetadata("platform", ("backend", "web")),
    "Spring": SkillMetadata("framework", ("backend", "web")),
    "FastAPI": SkillMetadata("framework", ("backend", "ai")),
    "Django": SkillMetadata("framework", ("backend", "web")),
    "Flask": SkillMetadata("framework", ("backend", "web", "ai")),
    "NestJS": SkillMetadata("framework", ("backend", "web")),
    "Docker": SkillMetadata("platform", ("devops", "cloud", "backend", "mlops")),
    "Kubernetes": SkillMetadata("platform", ("devops", "cloud", "mlops")),
    "AWS": SkillMetadata("cloud", ("cloud", "devops", "backend", "security")),
    "GCP": SkillMetadata("cloud", ("cloud", "devops", "ai", "mlops")),
    "Azure": SkillMetadata("cloud", ("cloud", "devops", "security")),
    "Terraform": SkillMetadata("tool", ("devops", "cloud")),
    "Kafka": SkillMetadata("platform", ("backend", "data", "devops")),
    "Nginx": SkillMetadata("platform", ("backend", "web", "devops")),
    "Linux": SkillMetadata("platform", ("devops", "embedded", "robotics", "security", "backend")),
    "PostgreSQL": SkillMetadata("database", ("data", "backend")),
    "MySQL": SkillMetadata("database", ("data", "backend")),
    "MongoDB": SkillMetadata("database", ("data", "backend")),
    "Redis": SkillMetadata("database", ("data", "backend")),
    "Elasticsearch": SkillMetadata("database", ("data", "backend", "web")),
    "TensorFlow": SkillMetadata("library", ("ai", "mlops")),
    "PyTorch": SkillMetadata("library", ("ai", "mlops")),
    "CUDA": SkillMetadata("platform", ("ai", "graphics", "high_performance")),
    "OpenCV": SkillMetadata("library", ("ai", "computer_vision", "robotics", "graphics")),
    "LLM": SkillMetadata("practice", ("ai",)),
    "RAG": SkillMetadata("practice", ("ai", "data")),
    "LangChain": SkillMetadata("framework", ("ai",)),
    "MLOps": SkillMetadata("practice", ("ai", "mlops", "devops")),
    "Feature Store": SkillMetadata("practice", ("ai", "mlops", "data")),
    "Model Serving": SkillMetadata("practice", ("ai", "mlops", "backend")),
    "OWASP": SkillMetadata("standard", ("security", "web")),
    "SIEM": SkillMetadata("platform", ("security",)),
    "Wireshark": SkillMetadata("tool", ("security",)),
    "Unity": SkillMetadata("engine", ("game", "graphics")),
    "Unreal Engine": SkillMetadata("engine", ("game", "graphics")),
    "Blender": SkillMetadata("professional_tool", ("game", "graphics", "design")),
    "Maya": SkillMetadata("professional_tool", ("game", "graphics", "design")),
    "Photoshop": SkillMetadata("professional_tool", ("game", "graphics", "design")),
    "Illustrator": SkillMetadata("professional_tool", ("game", "graphics", "design")),
    "ROS": SkillMetadata("framework", ("robotics", "autonomy", "embedded")),
    "SLAM": SkillMetadata("practice", ("robotics", "autonomy", "computer_vision")),
    "Gazebo": SkillMetadata("tool", ("robotics",)),
    "CAN": SkillMetadata("protocol", ("embedded", "automotive", "robotics")),
    "RTOS": SkillMetadata("platform", ("embedded",)),
    "UART": SkillMetadata("protocol", ("embedded", "hardware")),
    "SPI": SkillMetadata("protocol", ("embedded", "hardware")),
    "I2C": SkillMetadata("protocol", ("embedded", "hardware")),
    "Android": SkillMetadata("platform", ("mobile",)),
    "iOS": SkillMetadata("platform", ("mobile",)),
    "Flutter": SkillMetadata("framework", ("mobile", "frontend")),
    "OAuth": SkillMetadata("standard", ("security", "web")),
    "JWT": SkillMetadata("standard", ("security", "web")),
    "IAM": SkillMetadata("practice", ("security", "cloud")),
    "SSO": SkillMetadata("practice", ("security", "web")),
    "Jira": SkillMetadata("tool", ("product", "qa", "devops")),
    "Figma": SkillMetadata("professional_tool", ("design", "frontend", "product")),
    "Selenium": SkillMetadata("tool", ("qa", "web")),
    "Playwright": SkillMetadata("tool", ("qa", "frontend", "web")),
}


def skill_category(canonical: str) -> str:
    return SKILL_CATEGORY.get(canonical, "")


def skill_metadata(canonical: str) -> SkillMetadata:
    return SKILL_METADATA.get(canonical, SkillMetadata("tool", ("web",)))


def skill_kind(canonical: str) -> str:
    return skill_metadata(canonical).kind


def skill_domains(canonical: str) -> tuple[str, ...]:
    return skill_metadata(canonical).domains


def aliases_requiring_context() -> list[tuple[SkillDef, AliasDef]]:
    return [
        (skill, alias)
        for skill in SKILLS
        for alias in skill.aliases
        if alias.policy is not AliasPolicy.DISTINCT
    ]
