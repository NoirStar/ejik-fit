from __future__ import annotations

from collections.abc import Iterable
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
    SkillDef(
        "Bash",
        "language",
        (
            contextual(
                "bash",
                context_terms=(
                    "shell",
                    "script",
                    "linux",
                    "terminal",
                    "command line",
                    "셸",
                    "쉘",
                    "스크립트",
                    "리눅스",
                ),
            ),
        ),
    ),
    SkillDef("MATLAB", "language", (distinct("matlab"),)),
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
                negative_patterns=(r"\breact\s+native\b",),
            ),
            distinct("리액트"),
        ),
    ),
    SkillDef("Vue", "frontend", (distinct("vue.js"), distinct("vuejs"), distinct("vue"))),
    SkillDef("Next.js", "frontend", (distinct("next.js"), distinct("nextjs"))),
    SkillDef("Angular", "frontend", (distinct("angular"),)),
    SkillDef("Svelte", "frontend", (distinct("svelte"),)),
    SkillDef("Vite", "frontend", (distinct("vite"),)),
    SkillDef("Webpack", "frontend", (distinct("webpack"),)),
    SkillDef(
        "TanStack Query",
        "frontend",
        (
            distinct("tanstack query"),
            distinct("tanstack-query"),
            distinct("@tanstack/react-query"),
            distinct("tanstack/react-query"),
            distinct("react query"),
            distinct("react-query"),
        ),
    ),
    SkillDef("Redux", "frontend", (distinct("redux"),)),
    SkillDef(
        "Tailwind CSS",
        "frontend",
        (
            distinct("tailwind css"),
            distinct("tailwindcss"),
            contextual(
                "tailwind",
                context_terms=(
                    "css",
                    "frontend",
                    "프론트엔드",
                    "web",
                    "웹",
                    "react",
                    "vue",
                ),
            ),
        ),
    ),
    SkillDef(
        "Storybook",
        "frontend",
        (
            contextual(
                "storybook",
                context_terms=(
                    "ui",
                    "component",
                    "컴포넌트",
                    "frontend",
                    "프론트엔드",
                    "design system",
                    "디자인 시스템",
                    "react",
                    "vue",
                ),
            ),
        ),
    ),
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
    SkillDef(
        ".NET",
        "backend",
        (
            distinct("asp.net"),
            distinct(".net core"),
            distinct(".net framework"),
            contextual(
                ".net",
                context_terms=(
                    "c#",
                    "백엔드",
                    "개발",
                    "framework",
                    "backend",
                    "asp",
                ),
            ),
        ),
    ),
    SkillDef("gRPC", "backend", (distinct("grpc"),)),
    SkillDef("RabbitMQ", "backend", (distinct("rabbitmq"),)),
    SkillDef("GraphQL", "backend", (distinct("graphql"),)),
    SkillDef(
        "WebSocket",
        "backend",
        (distinct("websocket"), distinct("websockets"), distinct("web socket")),
    ),
    SkillDef("WebRTC", "backend", (distinct("webrtc"),)),
    SkillDef("Gradle", "backend", (distinct("gradle"),)),
    SkillDef(
        "Celery",
        "backend",
        (
            contextual(
                "celery",
                context_terms=(
                    "python",
                    "django",
                    "backend",
                    "백엔드",
                    "task",
                    "queue",
                    "worker",
                    "async",
                    "비동기",
                    "작업 큐",
                ),
            ),
        ),
    ),
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
    SkillDef("Grafana", "infra", (distinct("grafana"),)),
    SkillDef(
        "Prometheus",
        "infra",
        (
            contextual(
                "prometheus",
                context_terms=(
                    "metrics",
                    "metric",
                    "monitoring",
                    "observability",
                    "grafana",
                    "kubernetes",
                    "메트릭",
                    "모니터링",
                    "관측",
                ),
            ),
        ),
    ),
    SkillDef("Datadog", "infra", (distinct("datadog"),)),
    SkillDef(
        "Argo CD",
        "infra",
        (distinct("argo cd"), distinct("argocd")),
    ),
    SkillDef("GitHub Actions", "infra", (distinct("github actions"),)),
    SkillDef("GitLab CI", "infra", (distinct("gitlab ci"),)),
    SkillDef("Jenkins", "infra", (distinct("jenkins"),)),
    SkillDef("Ansible", "infra", (distinct("ansible"),)),
    SkillDef(
        "Helm",
        "infra",
        (
            contextual(
                "helm",
                context_terms=(
                    "kubernetes",
                    "k8s",
                    "chart",
                    "devops",
                    "container",
                    "쿠버네티스",
                    "배포",
                ),
            ),
        ),
    ),
    SkillDef("Istio", "infra", (distinct("istio"),)),
    SkillDef(
        "OpenTelemetry",
        "infra",
        (
            distinct("opentelemetry"),
            distinct("open telemetry"),
            contextual(
                "otel",
                context_terms=(
                    "tracing",
                    "trace",
                    "telemetry",
                    "observability",
                    "metric",
                    "관측",
                    "추적",
                    "메트릭",
                ),
            ),
        ),
    ),
    SkillDef(
        "Sentry",
        "infra",
        (
            contextual(
                "sentry",
                context_terms=(
                    "error",
                    "오류",
                    "에러",
                    "monitoring",
                    "모니터링",
                    "observability",
                    "frontend",
                    "backend",
                ),
            ),
        ),
    ),
    SkillDef(
        "Loki",
        "infra",
        (
            distinct("grafana loki"),
            contextual(
                "loki",
                context_terms=(
                    "grafana",
                    "log",
                    "로그",
                    "monitoring",
                    "모니터링",
                    "observability",
                ),
            ),
        ),
    ),
    # data
    SkillDef("PostgreSQL", "data", (distinct("postgresql"), distinct("postgres"))),
    SkillDef("MySQL", "data", (distinct("mysql"),)),
    SkillDef("MariaDB", "data", (distinct("mariadb"),)),
    SkillDef("MongoDB", "data", (distinct("mongodb"),)),
    SkillDef("Redis", "data", (distinct("redis"),)),
    SkillDef("Elasticsearch", "data", (distinct("elasticsearch"),)),
    SkillDef(
        "Apache Airflow",
        "data",
        (
            distinct("apache airflow"),
            contextual(
                "airflow",
                context_terms=(
                    "data",
                    "pipeline",
                    "workflow",
                    "dag",
                    "etl",
                    "데이터",
                    "파이프라인",
                    "워크플로",
                ),
            ),
        ),
    ),
    SkillDef("Databricks", "data", (distinct("databricks"),)),
    SkillDef("BigQuery", "data", (distinct("bigquery"), distinct("big query"))),
    SkillDef(
        "Apache Spark",
        "data",
        (
            distinct("apache spark"),
            distinct("pyspark"),
            contextual(
                "spark",
                context_terms=(
                    "data",
                    "pipeline",
                    "big data",
                    "hadoop",
                    "데이터",
                    "파이프라인",
                    "분산 처리",
                ),
            ),
        ),
    ),
    SkillDef("Apache Flink", "data", (distinct("apache flink"), distinct("flink"))),
    SkillDef(
        "Apache Hive",
        "data",
        (
            distinct("apache hive"),
            contextual(
                "hive",
                context_terms=(
                    "data",
                    "warehouse",
                    "hadoop",
                    "sql",
                    "데이터",
                    "웨어하우스",
                ),
            ),
        ),
    ),
    SkillDef("dbt", "data", (distinct("dbt"), distinct("data build tool"))),
    SkillDef(
        "Snowflake",
        "data",
        (
            contextual(
                "snowflake",
                context_terms=(
                    "data",
                    "warehouse",
                    "sql",
                    "etl",
                    "데이터",
                    "웨어하우스",
                ),
            ),
        ),
    ),
    SkillDef(
        "Oracle",
        "data",
        (
            distinct("oracle database"),
            distinct("oracle db"),
            contextual(
                "oracle",
                context_terms=(
                    "database",
                    "sql",
                    "pl/sql",
                    "rdbms",
                    "데이터베이스",
                    "디비",
                    "튜닝",
                ),
            ),
        ),
    ),
    SkillDef("OpenSearch", "data", (distinct("opensearch"),)),
    SkillDef("ClickHouse", "data", (distinct("clickhouse"),)),
    SkillDef(
        "Pandas",
        "data",
        (
            contextual(
                "pandas",
                context_terms=(
                    "python",
                    "data",
                    "데이터",
                    "analysis",
                    "분석",
                    "dataframe",
                    "머신러닝",
                ),
            ),
        ),
    ),
    SkillDef("NumPy", "data", (distinct("numpy"),)),
    SkillDef("Milvus", "data", (distinct("milvus"),)),
    SkillDef("DynamoDB", "data", (distinct("dynamodb"), distinct("dynamo db"))),
    SkillDef(
        "Redshift",
        "data",
        (
            distinct("amazon redshift"),
            distinct("aws redshift"),
            contextual(
                "redshift",
                context_terms=(
                    "aws",
                    "amazon",
                    "data",
                    "데이터",
                    "warehouse",
                    "웨어하우스",
                    "sql",
                ),
            ),
        ),
    ),
    SkillDef(
        "Cassandra",
        "data",
        (
            distinct("apache cassandra"),
            contextual(
                "cassandra",
                context_terms=(
                    "database",
                    "데이터베이스",
                    "nosql",
                    "data",
                    "데이터",
                    "distributed",
                    "분산",
                ),
            ),
        ),
    ),
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
    SkillDef("MLflow", "ai", (distinct("mlflow"),)),
    SkillDef("Kubeflow", "ai", (distinct("kubeflow"),)),
    SkillDef("vLLM", "ai", (distinct("vllm"),)),
    SkillDef(
        "Hugging Face",
        "ai",
        (distinct("hugging face"), distinct("huggingface")),
    ),
    SkillDef("ONNX", "ai", (distinct("onnx"),)),
    SkillDef(
        "JAX",
        "ai",
        (
            contextual(
                "jax",
                context_terms=(
                    "ai",
                    "ml",
                    "model",
                    "모델",
                    "python",
                    "training",
                    "학습",
                    "gpu",
                    "tpu",
                ),
            ),
        ),
    ),
    SkillDef("TensorRT", "ai", (distinct("tensorrt"),)),
    SkillDef(
        "Triton",
        "ai",
        (
            distinct("nvidia triton"),
            contextual(
                "triton",
                context_terms=(
                    "inference",
                    "추론",
                    "model",
                    "모델",
                    "nvidia",
                    "gpu",
                    "cuda",
                    "kernel",
                    "커널",
                ),
            ),
        ),
    ),
    SkillDef(
        "LlamaIndex",
        "ai",
        (distinct("llamaindex"), distinct("llama index")),
    ),
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
    SkillDef(
        "Vulkan",
        "game",
        (
            contextual(
                "vulkan",
                context_terms=(
                    "gpu",
                    "graphics",
                    "그래픽",
                    "rendering",
                    "렌더링",
                    "game",
                    "게임",
                    "engine",
                    "엔진",
                ),
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
    SkillDef(
        "Isaac Sim",
        "robotics",
        (distinct("isaac sim"), distinct("nvidia isaac sim")),
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
    SkillDef("FPGA", "embedded", (distinct("fpga"),)),
    SkillDef("CMake", "embedded", (distinct("cmake"),)),
    SkillDef("QNX", "embedded", (distinct("qnx"),)),
    SkillDef("AUTOSAR", "embedded", (distinct("autosar"),)),
    SkillDef(
        "Yocto",
        "embedded",
        (
            distinct("yocto project"),
            contextual(
                "yocto",
                context_terms=(
                    "linux",
                    "embedded",
                    "임베디드",
                    "bitbake",
                    "build",
                    "빌드",
                ),
            ),
        ),
    ),
    SkillDef("Simulink", "embedded", (distinct("simulink"),)),
    SkillDef("MQTT", "embedded", (distinct("mqtt"),)),
    SkillDef(
        "Verilog",
        "embedded",
        (distinct("systemverilog"), distinct("verilog")),
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
    SkillDef("React Native", "mobile", (distinct("react native"),)),
    # design/product/qa
    SkillDef("Jira", "qa", (distinct("jira"),)),
    SkillDef("Figma", "design", (distinct("figma"),)),
    SkillDef("Selenium", "qa", (distinct("selenium"),)),
    SkillDef("Playwright", "qa", (distinct("playwright"),)),
    SkillDef(
        "JUnit",
        "qa",
        (distinct("junit"), distinct("junit5"), distinct("junit 5")),
    ),
    SkillDef("Pytest", "qa", (distinct("pytest"),)),
    SkillDef("SonarQube", "qa", (distinct("sonarqube"),)),
)


SKILL_CATEGORY: dict[str, str] = {
    skill.canonical: skill.category for skill in SKILLS
}


def _skill_input_key(value: str) -> str:
    return " ".join(value.split()).casefold()


SKILL_INPUT_CANONICAL: dict[str, str] = {}
for _skill in SKILLS:
    for _name in (_skill.canonical, *(_alias.value for _alias in _skill.aliases)):
        _key = _skill_input_key(_name)
        _existing = SKILL_INPUT_CANONICAL.get(_key)
        if _existing is not None and _existing != _skill.canonical:
            raise RuntimeError(
                f"ambiguous explicit skill input {_name!r}: "
                f"{_existing!r} and {_skill.canonical!r}"
            )
        SKILL_INPUT_CANONICAL[_key] = _skill.canonical


def canonicalize_skill_input(value: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        return ""
    return SKILL_INPUT_CANONICAL.get(_skill_input_key(normalized), normalized)


def canonicalize_skill_inputs(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        canonical = canonicalize_skill_input(value)
        key = _skill_input_key(canonical)
        if not canonical or key in seen:
            continue
        seen.add(key)
        result.append(canonical)
    return result


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
    "Bash": SkillMetadata("language", ("devops", "backend", "security")),
    "React": SkillMetadata("framework", ("frontend", "web")),
    "Vue": SkillMetadata("framework", ("frontend", "web")),
    "Next.js": SkillMetadata("framework", ("frontend", "web", "backend")),
    "Angular": SkillMetadata("framework", ("frontend", "web")),
    "Svelte": SkillMetadata("framework", ("frontend", "web")),
    "Vite": SkillMetadata("tool", ("frontend", "web")),
    "Webpack": SkillMetadata("tool", ("frontend", "web")),
    "Node.js": SkillMetadata("platform", ("backend", "web")),
    "Spring": SkillMetadata("framework", ("backend", "web")),
    "FastAPI": SkillMetadata("framework", ("backend", "ai")),
    "Django": SkillMetadata("framework", ("backend", "web")),
    "Flask": SkillMetadata("framework", ("backend", "web", "ai")),
    "NestJS": SkillMetadata("framework", ("backend", "web")),
    ".NET": SkillMetadata("framework", ("backend", "web")),
    "gRPC": SkillMetadata("protocol", ("backend", "cloud")),
    "RabbitMQ": SkillMetadata("platform", ("backend", "data")),
    "Docker": SkillMetadata("platform", ("devops", "cloud", "backend", "mlops")),
    "Kubernetes": SkillMetadata("platform", ("devops", "cloud", "mlops")),
    "AWS": SkillMetadata("cloud", ("cloud", "devops", "backend", "security")),
    "GCP": SkillMetadata("cloud", ("cloud", "devops", "ai", "mlops")),
    "Azure": SkillMetadata("cloud", ("cloud", "devops", "security")),
    "Terraform": SkillMetadata("tool", ("devops", "cloud")),
    "Kafka": SkillMetadata("platform", ("backend", "data", "devops")),
    "Nginx": SkillMetadata("platform", ("backend", "web", "devops")),
    "Linux": SkillMetadata("platform", ("devops", "embedded", "robotics", "security", "backend")),
    "Grafana": SkillMetadata("platform", ("devops", "observability")),
    "Prometheus": SkillMetadata("platform", ("devops", "observability")),
    "Datadog": SkillMetadata("platform", ("devops", "observability", "cloud")),
    "Argo CD": SkillMetadata("tool", ("devops", "cloud")),
    "GitHub Actions": SkillMetadata("tool", ("devops", "cloud")),
    "GitLab CI": SkillMetadata("tool", ("devops", "cloud")),
    "Jenkins": SkillMetadata("tool", ("devops",)),
    "Ansible": SkillMetadata("tool", ("devops", "cloud")),
    "Helm": SkillMetadata("tool", ("devops", "cloud")),
    "Istio": SkillMetadata("platform", ("devops", "cloud", "backend")),
    "PostgreSQL": SkillMetadata("database", ("data", "backend")),
    "MySQL": SkillMetadata("database", ("data", "backend")),
    "MongoDB": SkillMetadata("database", ("data", "backend")),
    "Redis": SkillMetadata("database", ("data", "backend")),
    "Elasticsearch": SkillMetadata("database", ("data", "backend", "web")),
    "Apache Airflow": SkillMetadata("platform", ("data", "devops")),
    "Databricks": SkillMetadata("platform", ("data", "ai", "cloud")),
    "BigQuery": SkillMetadata("database", ("data", "cloud")),
    "Apache Spark": SkillMetadata("framework", ("data", "ai")),
    "Apache Flink": SkillMetadata("framework", ("data", "backend")),
    "Apache Hive": SkillMetadata("database", ("data",)),
    "dbt": SkillMetadata("tool", ("data",)),
    "Snowflake": SkillMetadata("database", ("data", "cloud")),
    "Oracle": SkillMetadata("database", ("data", "backend")),
    "OpenSearch": SkillMetadata("database", ("data", "backend")),
    "ClickHouse": SkillMetadata("database", ("data", "backend")),
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
    "MLflow": SkillMetadata("platform", ("ai", "mlops")),
    "Kubeflow": SkillMetadata("platform", ("ai", "mlops", "devops")),
    "vLLM": SkillMetadata("platform", ("ai", "mlops")),
    "Hugging Face": SkillMetadata("platform", ("ai", "mlops")),
    "ONNX": SkillMetadata("standard", ("ai", "mlops")),
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
    "FPGA": SkillMetadata("platform", ("embedded", "hardware")),
    "Verilog": SkillMetadata("language", ("embedded", "hardware")),
    "Android": SkillMetadata("platform", ("mobile",)),
    "iOS": SkillMetadata("platform", ("mobile",)),
    "Flutter": SkillMetadata("framework", ("mobile", "frontend")),
    "React Native": SkillMetadata("framework", ("mobile", "frontend")),
    "OAuth": SkillMetadata("standard", ("security", "web")),
    "JWT": SkillMetadata("standard", ("security", "web")),
    "IAM": SkillMetadata("practice", ("security", "cloud")),
    "SSO": SkillMetadata("practice", ("security", "web")),
    "Jira": SkillMetadata("tool", ("product", "qa", "devops")),
    "Figma": SkillMetadata("professional_tool", ("design", "frontend", "product")),
    "Selenium": SkillMetadata("tool", ("qa", "web")),
    "Playwright": SkillMetadata("tool", ("qa", "frontend", "web")),
    "GraphQL": SkillMetadata("query_language", ("backend", "frontend", "web", "api")),
    "TanStack Query": SkillMetadata("library", ("frontend", "web")),
    "Redux": SkillMetadata("library", ("frontend", "web")),
    "Tailwind CSS": SkillMetadata("framework", ("frontend", "design", "web")),
    "Storybook": SkillMetadata("tool", ("frontend", "design", "qa")),
    "WebSocket": SkillMetadata("protocol", ("backend", "frontend", "web")),
    "WebRTC": SkillMetadata("standard", ("frontend", "backend", "web")),
    "Gradle": SkillMetadata("build_tool", ("backend", "mobile", "devops")),
    "CMake": SkillMetadata("build_tool", ("embedded", "robotics", "game")),
    "Celery": SkillMetadata("framework", ("backend", "data")),
    "JUnit": SkillMetadata("test_framework", ("qa", "backend")),
    "Pytest": SkillMetadata("test_framework", ("qa", "backend", "data", "ai")),
    "Pandas": SkillMetadata("library", ("data", "ai")),
    "NumPy": SkillMetadata("library", ("data", "ai")),
    "JAX": SkillMetadata("library", ("ai", "high_performance")),
    "TensorRT": SkillMetadata("platform", ("ai", "mlops", "high_performance")),
    "Triton": SkillMetadata("platform", ("ai", "mlops", "high_performance")),
    "LlamaIndex": SkillMetadata("framework", ("ai", "data")),
    "Milvus": SkillMetadata("database", ("ai", "data")),
    "DynamoDB": SkillMetadata("database", ("data", "cloud", "backend")),
    "Redshift": SkillMetadata("database", ("data", "cloud")),
    "Cassandra": SkillMetadata("database", ("data", "backend")),
    "MariaDB": SkillMetadata("database", ("data", "backend")),
    "OpenTelemetry": SkillMetadata(
        "standard", ("observability", "devops", "backend")
    ),
    "Sentry": SkillMetadata("platform", ("observability", "frontend", "backend")),
    "Loki": SkillMetadata("platform", ("observability", "devops")),
    "SonarQube": SkillMetadata("tool", ("qa", "security", "devops")),
    "QNX": SkillMetadata("platform", ("embedded", "automotive")),
    "AUTOSAR": SkillMetadata("standard", ("embedded", "automotive")),
    "Yocto": SkillMetadata("platform", ("embedded",)),
    "MATLAB": SkillMetadata("language", ("embedded", "data", "robotics")),
    "Simulink": SkillMetadata(
        "professional_tool", ("embedded", "automotive", "robotics")
    ),
    "MQTT": SkillMetadata("protocol", ("embedded", "iot", "backend")),
    "Vulkan": SkillMetadata("api", ("graphics", "game", "embedded")),
    "Isaac Sim": SkillMetadata("tool", ("robotics", "ai", "simulation")),
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
