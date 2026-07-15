from ejikfit.connectors.technical_roles import (
    is_korea_technical_role,
    is_technical_role,
)


def test_technical_role_filter_keeps_software_roles_and_rejects_title_noise() -> None:
    assert is_technical_role("Staff Back-end Engineer") is True
    assert is_technical_role("데이터 엔지니어") is True
    assert is_technical_role("Machine Learning Engineer") is True

    assert is_technical_role("Cloud Sales Talent Pool") is False
    assert is_technical_role("HVAC 설계 엔지니어") is False
    assert is_technical_role("Data Privacy & AI Legal Counsel") is False
    assert is_technical_role("CS QA - 상담 품질 평가") is False
    assert is_technical_role("라스트마일 데이터 분석 및 운영 개선 담당자") is False


def test_korea_technical_filter_requires_both_role_and_domestic_location() -> None:
    assert is_korea_technical_role(
        "Software Engineer, AI Agent",
        "Seoul, South Korea",
    ) is True
    assert is_korea_technical_role(
        "Software Engineer, AI Agent",
        "San Mateo, California, United States",
    ) is False
    assert is_korea_technical_role(
        "Digital Marketing Manager, APAC",
        "Seoul, South Korea",
    ) is False
