from ejikfit.skill_catalog import (
    AliasPolicy,
    SKILLS,
    SKILL_METADATA,
    aliases_requiring_context,
    canonicalize_skill_input,
    canonicalize_skill_inputs,
    skill_category,
)


RISKY_ALIASES = {
    ("Bash", "bash"),
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
    ("RAG", "rag"),
    ("Blender", "blender"),
    ("Maya", "maya"),
    ("Illustrator", "illustrator"),
    ("ROS", "ros"),
    ("SLAM", "slam"),
    ("Gazebo", "gazebo"),
    ("CAN", "CAN"),
    ("Android", "android"),
    ("Flutter", "flutter"),
    (".NET", ".net"),
    ("Prometheus", "prometheus"),
    ("Helm", "helm"),
    ("Apache Airflow", "airflow"),
    ("Apache Spark", "spark"),
    ("Apache Hive", "hive"),
    ("Snowflake", "snowflake"),
    ("Oracle", "oracle"),
    ("Tailwind CSS", "tailwind"),
    ("Storybook", "storybook"),
    ("Celery", "celery"),
    ("Pandas", "pandas"),
    ("JAX", "jax"),
    ("Triton", "triton"),
    ("Redshift", "redshift"),
    ("Cassandra", "cassandra"),
    ("OpenTelemetry", "otel"),
    ("Sentry", "sentry"),
    ("Loki", "loki"),
    ("Yocto", "yocto"),
    ("Vulkan", "vulkan"),
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


def test_every_skill_has_kind_and_domains() -> None:
    from ejikfit.skill_catalog import skill_domains, skill_kind

    assert set(SKILL_METADATA) == {skill.canonical for skill in SKILLS}
    for skill in SKILLS:
        assert skill_kind(skill.canonical), skill.canonical
        assert skill_domains(skill.canonical), skill.canonical


def test_seed_pack_contains_professional_tools_and_cross_domain_skills() -> None:
    from ejikfit.skill_catalog import skill_domains, skill_kind

    expected = {
        "CUDA": ("platform", {"ai", "graphics", "high_performance"}),
        "OpenCV": ("library", {"ai", "computer_vision", "robotics", "graphics"}),
        "MLOps": ("practice", {"ai", "mlops", "devops"}),
        "Feature Store": ("practice", {"ai", "mlops", "data"}),
        "Blender": ("professional_tool", {"game", "graphics", "design"}),
        "Photoshop": ("professional_tool", {"game", "graphics", "design"}),
        "Jira": ("tool", {"product", "qa", "devops"}),
        "CAN": ("protocol", {"embedded", "automotive", "robotics"}),
        "OAuth": ("standard", {"security", "web"}),
        "Playwright": ("tool", {"qa", "frontend", "web"}),
        "Grafana": ("platform", {"devops", "observability"}),
        "Apache Airflow": ("platform", {"data", "devops"}),
        "Databricks": ("platform", {"data", "ai"}),
        "MLflow": ("platform", {"ai", "mlops"}),
        "vLLM": ("platform", {"ai", "mlops"}),
        "React Native": ("framework", {"mobile", "frontend"}),
        "FPGA": ("platform", {"embedded", "hardware"}),
        "Verilog": ("language", {"embedded", "hardware"}),
    }

    actual_names = {skill.canonical for skill in SKILLS}
    for canonical, (kind, domains) in expected.items():
        assert canonical in actual_names
        assert skill_kind(canonical) == kind
        assert domains.issubset(set(skill_domains(canonical)))


def test_reviewed_market_expansion_uses_stable_categories() -> None:
    expected_categories = {
        "Bash": "language",
        "React Native": "mobile",
        "Vite": "frontend",
        "Webpack": "frontend",
        ".NET": "backend",
        "gRPC": "backend",
        "RabbitMQ": "backend",
        "Grafana": "infra",
        "Prometheus": "infra",
        "Datadog": "infra",
        "Argo CD": "infra",
        "GitHub Actions": "infra",
        "GitLab CI": "infra",
        "Jenkins": "infra",
        "Ansible": "infra",
        "Helm": "infra",
        "Istio": "infra",
        "Apache Airflow": "data",
        "Databricks": "data",
        "BigQuery": "data",
        "Apache Spark": "data",
        "Apache Flink": "data",
        "Apache Hive": "data",
        "dbt": "data",
        "Snowflake": "data",
        "Oracle": "data",
        "OpenSearch": "data",
        "ClickHouse": "data",
        "MLflow": "ai",
        "Kubeflow": "ai",
        "vLLM": "ai",
        "Hugging Face": "ai",
        "ONNX": "ai",
        "FPGA": "embedded",
        "Verilog": "embedded",
    }

    assert {
        skill.canonical: skill.category
        for skill in SKILLS
        if skill.canonical in expected_categories
    } == expected_categories


def test_production_posting_gap_expansion_uses_stable_categories() -> None:
    expected_categories = {
        "GraphQL": "backend",
        "TanStack Query": "frontend",
        "Redux": "frontend",
        "Tailwind CSS": "frontend",
        "Storybook": "frontend",
        "WebSocket": "backend",
        "WebRTC": "backend",
        "Gradle": "backend",
        "CMake": "embedded",
        "Celery": "backend",
        "JUnit": "qa",
        "Pytest": "qa",
        "Pandas": "data",
        "NumPy": "data",
        "JAX": "ai",
        "TensorRT": "ai",
        "Triton": "ai",
        "LlamaIndex": "ai",
        "Milvus": "data",
        "DynamoDB": "data",
        "Redshift": "data",
        "Cassandra": "data",
        "MariaDB": "data",
        "OpenTelemetry": "infra",
        "Sentry": "infra",
        "Loki": "infra",
        "SonarQube": "qa",
        "QNX": "embedded",
        "AUTOSAR": "embedded",
        "Yocto": "embedded",
        "MATLAB": "language",
        "Simulink": "embedded",
        "MQTT": "embedded",
        "Vulkan": "game",
        "Isaac Sim": "robotics",
    }

    assert {
        skill.canonical: skill.category
        for skill in SKILLS
        if skill.canonical in expected_categories
    } == expected_categories


def test_graph_metadata_preserves_existing_category_contract() -> None:
    assert skill_category("C++") == "language"
    assert skill_category("Unity") == "game"
    assert skill_category("ROS") == "robotics"


def test_explicit_skill_inputs_are_canonicalized_and_deduplicated() -> None:
    assert canonicalize_skill_input(" python ") == "Python"
    assert canonicalize_skill_input("K8S") == "Kubernetes"
    assert canonicalize_skill_input("feature   store") == "Feature Store"
    assert canonicalize_skill_input("react-query") == "TanStack Query"
    assert canonicalize_skill_input("Custom Tool") == "Custom Tool"
    assert canonicalize_skill_inputs(
        ["python", "PYTHON", " k8s ", "Custom Tool", "custom tool"]
    ) == ["Python", "Kubernetes", "Custom Tool"]
