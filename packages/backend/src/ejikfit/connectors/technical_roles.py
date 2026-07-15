TECHNICAL_ROLE_MARKERS = (
    "android",
    "backend",
    "cloud",
    "data",
    "database",
    "dba",
    "developer",
    "devops",
    "engineer",
    "engineering",
    "frontend",
    "infrastructure",
    "ios",
    "machine learning",
    "mlops",
    "qa",
    "security",
    "site reliability",
    "software",
    "system",
    "개발자",
    "데이터",
    "보안",
    "소프트웨어",
    "엔지니어",
    "인프라",
    "클라우드",
    "서버 개발",
    "시스템 개발",
    "앱 개발",
    "웹 개발",
)


def is_technical_role(*values: str | None) -> bool:
    searchable = " ".join(value for value in values if value).casefold()
    return any(marker in searchable for marker in TECHNICAL_ROLE_MARKERS)
