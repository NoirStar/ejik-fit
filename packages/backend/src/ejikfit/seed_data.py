from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ejikfit.models import CareerSource, Company, SourceStatus, SourceType


@dataclass(frozen=True)
class SeedSource:
    name: str
    slug: str
    base_url: str


INITIAL_GREETING_SOURCES = (
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
)


def seed_sources(session: Session) -> int:
    created = 0

    for item in INITIAL_GREETING_SOURCES:
        company = session.scalar(select(Company).where(Company.slug == item.slug))
        if company is None:
            company = Company(name=item.name, slug=item.slug)
            session.add(company)
            session.flush()

        source = session.scalar(
            select(CareerSource).where(CareerSource.base_url == item.base_url)
        )
        if source is None:
            session.add(
                CareerSource(
                    company_id=company.id,
                    base_url=item.base_url,
                    source_type=SourceType.GREETING,
                    status=SourceStatus.ALLOWED,
                )
            )
            created += 1

    session.commit()
    return created
