import pytest

from ejikfit.skill_catalog import aliases_requiring_context
from ejikfit.skill_extraction import (
    RequirementType,
    extract_skill_matches,
)


RISKY_GOLDENS = {
    ("Bash", "bash"): ("Linux Bash 셸 스크립트 개발", "bash the command repeatedly"),
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
    ("RAG", "rag"): ("RAG 엔진 개발", "rag cloth texture"),
    ("Blender", "blender"): ("Blender 3D 아티스트", "kitchen blender sale"),
    ("Maya", "maya"): ("Maya 3D 모델링 아티스트", "maya라는 이름의 사람"),
    ("Illustrator", "illustrator"): ("Adobe Illustrator 디자인", "illustrator of a novel"),
    ("ROS", "ros"): ("ROS 로봇 개발", "ros라는 임의 문자열"),
    ("SLAM", "slam"): ("SLAM 로봇 알고리즘", "slam the door"),
    ("Gazebo", "gazebo"): ("Gazebo 로봇 시뮬레이션", "garden gazebo"),
    ("CAN", "CAN"): ("임베디드 CAN 통신 개발", "You can join the event"),
    ("Android", "android"): ("Android 앱 개발", "android character"),
    ("Flutter", "flutter"): ("Flutter 모바일 앱 개발", "butterflies flutter"),
    (".NET", ".net"): ("C# .NET 백엔드 개발", "example.net domain migration"),
    ("Prometheus", "prometheus"): (
        "Prometheus 메트릭 모니터링 운영",
        "Prometheus is a figure in Greek mythology",
    ),
    ("Helm", "helm"): ("Kubernetes Helm chart 운영", "at the helm of the company"),
    ("Apache Airflow", "airflow"): (
        "Apache Airflow 데이터 파이프라인 개발",
        "improve office airflow and ventilation",
    ),
    ("Apache Spark", "spark"): (
        "Apache Spark 데이터 처리 파이프라인",
        "spark customer curiosity",
    ),
    ("Apache Hive", "hive"): (
        "Apache Hive 데이터 웨어하우스 SQL",
        "beehive maintenance experience",
    ),
    ("Snowflake", "snowflake"): (
        "Snowflake 데이터 웨어하우스와 SQL 운영",
        "snowflake-shaped holiday design",
    ),
    ("Oracle", "oracle"): (
        "Oracle 데이터베이스와 SQL 튜닝",
        "Oracle corporate account manager",
    ),
    ("Tailwind CSS", "tailwind"): (
        "React 프론트엔드에서 Tailwind CSS 사용",
        "a strong tailwind helped the aircraft",
    ),
    ("Storybook", "storybook"): (
        "React Storybook UI 컴포넌트 개발",
        "children's storybook editor",
    ),
    ("Celery", "celery"): (
        "Python Celery 비동기 작업 큐 개발",
        "celery salad recipe",
    ),
    ("Pandas", "pandas"): (
        "Python Pandas 데이터 분석",
        "giant pandas conservation program",
    ),
    ("JAX", "jax"): (
        "JAX 기반 AI 모델 학습",
        "Jax joined the marketing team",
    ),
    ("Triton", "triton"): (
        "NVIDIA Triton 모델 추론 최적화",
        "Triton is a moon of Neptune",
    ),
    ("Redshift", "redshift"): (
        "AWS Redshift 데이터 웨어하우스 운영",
        "astronomers measured the galaxy redshift",
    ),
    ("Cassandra", "cassandra"): (
        "Apache Cassandra NoSQL 데이터베이스 운영",
        "Cassandra joined the sales team",
    ),
    ("OpenTelemetry", "otel"): (
        "OTel tracing 기반 observability 구축",
        "the hotel lobby was renovated",
    ),
    ("Sentry", "sentry"): (
        "Sentry 오류 모니터링 운영",
        "a sentry guards the entrance",
    ),
    ("Loki", "loki"): (
        "Grafana Loki 로그 모니터링 운영",
        "Loki is a Marvel character",
    ),
    ("Yocto", "yocto"): (
        "Yocto Linux 임베디드 빌드 환경",
        "the yocto prefix denotes a tiny unit",
    ),
    ("Vulkan", "vulkan"): (
        "Vulkan GPU graphics 렌더링 개발",
        "Vulkan was used as a fictional name",
    ),
    ("HPC", "hpc"): (
        "HPC 클러스터에서 고성능 컴퓨팅 워크로드 운영",
        "HPC라는 임의의 사내 프로젝트 코드",
    ),
    ("MCP", "mcp"): (
        "LLM 도구 연동을 위한 MCP 서버 개발",
        "Microsoft Certified Professional (MCP) 자격증",
    ),
    ("NVIDIA Omniverse", "omniverse"): (
        "NVIDIA Omniverse 기반 3D 시뮬레이션 개발",
        "an omniverse story collection",
    ),
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
        ("CUDA 기반 모델 서빙 최적화", ["CUDA", "Model Serving"]),
        ("OpenCV를 활용한 computer vision 개발", ["OpenCV"]),
        ("MLOps 파이프라인과 Feature Store 운영", ["Feature Store", "MLOps"]),
        ("LLM 기반 RAG 엔진과 LangChain 개발", ["LLM", "LangChain", "RAG"]),
        ("Unity 3D 아티스트: Blender, Photoshop, Illustrator 경험", ["Blender", "Illustrator", "Photoshop", "Unity"]),
        ("임베디드 Linux 환경에서 CAN, UART, SPI, I2C 통신 개발", ["CAN", "I2C", "Linux", "SPI", "UART"]),
        ("웹 보안을 위한 OAuth, JWT, SSO, IAM 이해", ["IAM", "JWT", "OAuth", "SSO"]),
        ("QA 자동화: Playwright와 Selenium 경험", ["Playwright", "Selenium"]),
        (
            "Grafana, Datadog, Argo CD, GitHub Actions 기반 운영",
            ["Argo CD", "Datadog", "GitHub Actions", "Grafana"],
        ),
        (
            "Airflow, Databricks, BigQuery, dbt 데이터 파이프라인",
            ["Apache Airflow", "BigQuery", "Databricks", "dbt"],
        ),
        (
            "MLflow, Kubeflow, vLLM, Hugging Face, ONNX 모델 서빙",
            ["Hugging Face", "Kubeflow", "MLflow", "Model Serving", "ONNX", "vLLM"],
        ),
        (
            "React Native, Vite, Webpack을 사용하는 모바일 프론트엔드",
            ["React Native", "Vite", "Webpack"],
        ),
        (
            "FPGA와 SystemVerilog 기반 임베디드 하드웨어 개발",
            ["FPGA", "Verilog"],
        ),
        (
            "gRPC 서비스와 RabbitMQ, OpenSearch, ClickHouse 운영",
            ["ClickHouse", "OpenSearch", "RabbitMQ", "gRPC"],
        ),
        (
            "GraphQL API와 TanStack Query, Redux, Tailwind CSS, Storybook UI 컴포넌트, WebSocket, WebRTC 개발",
            [
                "GraphQL",
                "Redux",
                "Storybook",
                "Tailwind CSS",
                "TanStack Query",
                "WebRTC",
                "WebSocket",
            ],
        ),
        (
            "Gradle과 CMake 빌드, Python Celery 작업 큐, JUnit, Pytest, SonarQube 테스트",
            ["CMake", "Celery", "Gradle", "JUnit", "Pytest", "Python", "SonarQube"],
        ),
        (
            "Python Pandas, NumPy, JAX AI 학습, TensorRT, NVIDIA Triton 추론, LlamaIndex, Milvus, DynamoDB, AWS Redshift, Apache Cassandra, MariaDB",
            [
                "AWS",
                "Cassandra",
                "DynamoDB",
                "JAX",
                "LlamaIndex",
                "MariaDB",
                "Milvus",
                "NumPy",
                "Pandas",
                "Python",
                "Redshift",
                "TensorRT",
                "Triton",
            ],
        ),
        (
            "OpenTelemetry와 OTel tracing, Sentry 오류 모니터링, Grafana Loki 로그, QNX, AUTOSAR, Yocto Linux, MATLAB, Simulink, MQTT, Vulkan graphics, Isaac Sim 로봇 시뮬레이션",
            [
                "AUTOSAR",
                "Grafana",
                "Isaac Sim",
                "Linux",
                "Loki",
                "MATLAB",
                "MQTT",
                "OpenTelemetry",
                "QNX",
                "Sentry",
                "Simulink",
                "Vulkan",
                "Yocto",
            ],
        ),
        (
            "High-performance computing과 Model Context Protocol, NVIDIA Omniverse, PhysicsNeMo 기반 시뮬레이션",
            ["HPC", "MCP", "NVIDIA Omniverse", "NVIDIA PhysicsNeMo"],
        ),
    ],
)
def test_confirms_seed_pack_skills_in_technical_context(
    text: str,
    expected: list[str],
) -> None:
    assert sorted(confirmed_names(text)) == sorted(expected)


@pytest.mark.parametrize(
    "text",
    [
        "You can join the event tomorrow",
        "maya라는 이름의 사람",
        "rag cloth texture",
        "illustrator of a novel",
    ],
)
def test_rejects_seed_pack_non_technical_collisions(text: str) -> None:
    assert confirmed_names(text) == []


@pytest.mark.parametrize(
    "text",
    [
        "rag cloth repair",
        "rag cloth chain",
        "rag cloth painting",
    ],
)
def test_rejects_rag_when_non_technical_text_only_contains_ai_substring(
    text: str,
) -> None:
    assert confirmed_names(text) == []


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


@pytest.mark.parametrize(
    "text",
    [
        "Rust를 활용한 성능 최적화 경험",
        "Rust를 활용한 고성능 컴포넌트 구현 경험",
    ],
)
def test_rust_is_confirmed_by_implementation_context(text: str) -> None:
    assert "Rust" in confirmed_names(text)
