from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ejikfit.models import (
    CareerSource,
    Company,
    PolicyStatus,
    SourceStatus,
    SourceType,
)


@dataclass(frozen=True)
class SeedSource:
    name: str
    slug: str
    base_url: str
    source_type: SourceType = SourceType.GREETING
    homepage_url: str | None = None
    sector: str | None = "startup"
    connector_family: str | None = None
    policy_status: PolicyStatus = PolicyStatus.ALLOWED
    brand_tier_weight: int = 2
    tech_job_priority: int = 3
    expected_job_volume: int = 1
    connector_reuse_score: int = 3
    policy_risk: int = 0
    non_tech_noise: int = 1
    notes: str | None = None


INITIAL_SOURCE_CATALOG = (
    SeedSource(
        "DeepAuto.ai",
        "deepauto-ai",
        "https://deepauto-ai.career.greetinghr.com/ko",
    ),
    SeedSource("NHN KCP", "nhn-kcp", "https://kcp.career.greetinghr.com/ko"),
    SeedSource(
        "Sionic AI",
        "sionic-ai",
        "https://sionicai.career.greetinghr.com/ko",
    ),
    SeedSource("EXEM", "exem", "https://ex-em.career.greetinghr.com/ko"),
    SeedSource(
        "AFI 뒤끝",
        "afi-thebackend",
        "https://thebackend.career.greetinghr.com/ko",
    ),
    SeedSource(
        "뉴빌리티",
        "neubility",
        "https://neubility.career.greetinghr.com/ko",
    ),
    SeedSource(
        "비트센싱",
        "bitsensing",
        "https://bitsensing.career.greetinghr.com/ko",
    ),
    SeedSource("오누이", "onuii", "https://onuii.career.greetinghr.com/ko"),
    SeedSource(
        "로앤컴퍼니",
        "lawcompany",
        "https://lawcompany.career.greetinghr.com/ko",
    ),
    SeedSource(
        "슈퍼센트",
        "supercent",
        "https://supercent.career.greetinghr.com/ko",
    ),
    SeedSource(
        "카카오페이",
        "kakaopay",
        "https://kakaopay.career.greetinghr.com/ko",
    ),
    SeedSource(
        "카카오모빌리티",
        "kakaomobility",
        "https://kakaomobility.career.greetinghr.com/ko",
    ),
    SeedSource(
        "넥스트증권",
        "nextsecurities",
        "https://nextsecurities.career.greetinghr.com/ko",
    ),
    SeedSource(
        "현대오토에버",
        "hyundai-autoever",
        "https://hyundai-autoever.career.greetinghr.com/ko",
    ),
    SeedSource("S2W", "s2w", "https://s2w.career.greetinghr.com/ko"),
    SeedSource(
        "네이버",
        "naver",
        "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
        SourceType.NAVER_JSON,
        "https://www.navercorp.com",
        "platform",
        "naver_json",
        PolicyStatus.ALLOWED,
        6,
        5,
        5,
        2,
        0,
        1,
        "Official Naver recruitment JSON list.",
    ),
    SeedSource(
        "카카오",
        "kakao",
        "https://careers.kakao.com/public/api/job-list?lang=ko&skillSet=&page=1&company=KAKAO&part=TECHNOLOGY&employeeType=&keyword=",
        SourceType.KAKAO_JSON,
        "https://www.kakaocorp.com",
        "platform",
        "kakao_json",
        PolicyStatus.ALLOWED,
        6,
        5,
        5,
        2,
        0,
        1,
        "Official Kakao technology jobs API.",
    ),
    SeedSource(
        "LINE Plus",
        "line-plus",
        "https://careers.linecorp.com/page-data/jobs/page-data.json",
        SourceType.LINE_GATSBY,
        "https://linepluscorp.com",
        "platform",
        "line_gatsby",
        PolicyStatus.ALLOWED,
        6,
        5,
        4,
        2,
        0,
        1,
        "Official LINE Careers Gatsby page-data.",
    ),
)

INITIAL_GREETING_SOURCES = tuple(
    item
    for item in INITIAL_SOURCE_CATALOG
    if item.source_type == SourceType.GREETING
)


def _apply_source_metadata(source: CareerSource, item: SeedSource) -> None:
    source.source_type = item.source_type
    if (
        source.policy_status not in {PolicyStatus.BLOCKED, PolicyStatus.STOPPED}
        and source.last_error_code is None
    ):
        source.policy_status = item.policy_status
    source.connector_family = item.connector_family or item.source_type.value
    source.sector = item.sector
    source.brand_tier_weight = item.brand_tier_weight
    source.tech_job_priority = item.tech_job_priority
    source.expected_job_volume = item.expected_job_volume
    source.connector_reuse_score = item.connector_reuse_score
    source.policy_risk = item.policy_risk
    source.non_tech_noise = item.non_tech_noise
    source.notes = item.notes


def seed_sources(session: Session) -> int:
    created = 0

    for item in INITIAL_SOURCE_CATALOG:
        company = session.scalar(select(Company).where(Company.slug == item.slug))
        if company is None:
            company = Company(
                name=item.name,
                slug=item.slug,
                homepage_url=item.homepage_url,
            )
            session.add(company)
            session.flush()
        elif item.homepage_url and company.homepage_url is None:
            company.homepage_url = item.homepage_url

        source = session.scalar(
            select(CareerSource).where(CareerSource.base_url == item.base_url)
        )
        if source is None:
            source = CareerSource(
                company_id=company.id,
                base_url=item.base_url,
                source_type=item.source_type,
                status=SourceStatus.ALLOWED,
            )
            session.add(source)
            created += 1
        _apply_source_metadata(source, item)

    session.commit()
    return created
