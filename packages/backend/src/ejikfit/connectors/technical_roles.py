TECHNICAL_ROLE_MARKERS = (
    "android",
    "applied scientist",
    "backend",
    "cloud architect",
    "data analysis",
    "data analyst",
    "data architect",
    "data engineer",
    "data science",
    "data scientist",
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
    "rpa",
    "security",
    "server",
    "site reliability",
    "software",
    "solution architect",
    "개발자",
    "데이터 분석",
    "데이터과학",
    "데이터 사이언",
    "데이터 엔지니어",
    "데이터엔지니어",
    "데이터베이스",
    "보안",
    "소프트웨어",
    "엔지니어",
    "인프라",
    "서버 개발",
    "시스템 개발",
    "앱 개발",
    "웹 개발",
    "s/w",
)

NON_TECHNICAL_ROLE_MARKERS = (
    "business development",
    "civil engineer",
    "counsel",
    "customer service",
    "facilities",
    "facility",
    "hvac",
    "icqa",
    "lawyer",
    "legal",
    "loss prevention",
    "marketing",
    "mechanical engineer",
    "product manager",
    "program manager",
    " pm",
    "sales",
    "냉난방",
    "노무",
    "마케팅",
    "변호사",
    "사업법",
    "상담 품질",
    "세일즈",
    "시설",
    "영업",
    "운영 개선",
    "공조",
)

KOREA_LOCATION_MARKERS = (
    "korea",
    "seoul",
    "대한민국",
    "서울",
    "성남",
    "판교",
)


def is_technical_role(*values: str | None) -> bool:
    searchable = " ".join(value for value in values if value).casefold()
    if any(marker in searchable for marker in NON_TECHNICAL_ROLE_MARKERS):
        return False
    return any(marker in searchable for marker in TECHNICAL_ROLE_MARKERS)


def is_korea_technical_role(
    title: str | None,
    location: str | None,
) -> bool:
    normalized_location = (location or "").casefold()
    return any(
        marker in normalized_location for marker in KOREA_LOCATION_MARKERS
    ) and is_technical_role(title)
