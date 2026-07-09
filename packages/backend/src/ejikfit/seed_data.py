from dataclasses import dataclass
from typing import Any

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
    status: SourceStatus = SourceStatus.ALLOWED
    request_method: str = "GET"
    request_body: dict[str, Any] | None = None


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
    SeedSource(
        name="삼성전자",
        slug="samsung-electronics",
        base_url="https://www.samsungcareers.com/",
        source_type=SourceType.BROWSER_PUBLIC_RENDER,
        homepage_url="https://www.samsung.com/sec/",
        sector="enterprise_it",
        connector_family="browser_public_render",
        policy_status=PolicyStatus.BLOCKED,
        brand_tier_weight=6,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=1,
        policy_risk=5,
        non_tech_noise=4,
        notes=(
            "Official Samsung group careers site; public preview currently "
            "returns an access challenge."
        ),
        status=SourceStatus.BLOCKED,
    ),
    SeedSource(
        name="삼성SDS",
        slug="samsung-sds",
        base_url="https://www.samsungcareers.com/hr/list.data",
        source_type=SourceType.HTML_LISTING_DETAIL,
        homepage_url="https://www.samsungsds.com",
        sector="enterprise_it",
        connector_family="html_listing_detail",
        request_method="POST",
        request_body={
            "currentPageNo": "1",
            "intNo": "0",
            "strVal": "",
            "strTxt": "",
            "strKey": "",
            "strCompany": "C60",
            "strType": "",
            "strOrderBy": "",
            "strEntity": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=3,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=1,
        notes=(
            "Official Samsung Careers HTML listing filtered to Samsung SDS "
            "company code C60; currently returns an empty state when no "
            "postings are open."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="현대자동차",
        slug="hyundai-motor",
        base_url=(
            "https://talent.hyundai.com/api/rec/AP-HM-FO-02700?hgrCd=1"
            "&lang=en&page=1&pageblock=100&searchFieldList=&searchOccupList="
            "&searchPlaceList=&searchSectorList=&searchText=&jdSec=&srcOrd="
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.hyundai.com",
        sector="enterprise_it",
        connector_family="enterprise_json",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=4,
        expected_job_volume=4,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=3,
        notes="Official Hyundai Motor careers JSON listing.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="기아",
        slug="kia",
        base_url="https://career.kia.com/apply/applyList.kc",
        source_type=SourceType.BROWSER_PUBLIC_RENDER,
        homepage_url="https://www.kia.com",
        sector="enterprise_it",
        connector_family="browser_public_render",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=4,
        expected_job_volume=3,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=3,
        notes="Official Kia rendered careers listing.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="LG전자",
        slug="lg-electronics",
        base_url="https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=20",
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.lge.co.kr",
        sector="enterprise_it",
        connector_family="enterprise_json",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=4,
        expected_job_volume=5,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=3,
        notes="Official LG Electronics global careers JSON jobs endpoint.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="LG CNS",
        slug="lg-cns",
        base_url="https://api.careers.lg.com/rmk/job/retrieveJobNoticesList",
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.lgcns.com",
        sector="enterprise_it",
        connector_family="enterprise_json",
        request_method="POST",
        request_body={
            "lnbSearch": "",
            "hashTagText": "",
            "recDate": "CREATION_DATE",
            "order": "DESC",
            "careerList": [],
            "companyCodeList": ["CNS"],
            "desireLocList": [],
            "jobGroupList": [],
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=1,
        notes="Official LG Careers JSON jobs endpoint filtered to LG CNS.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="SK하이닉스",
        slug="sk-hynix",
        base_url="https://talent.skhynix.com/hub/ko/apply/job",
        source_type=SourceType.HTML_LISTING_DETAIL,
        homepage_url="https://www.skhynix.com",
        sector="enterprise_it",
        connector_family="html_listing_detail",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official SK hynix Talent Hub jobs page; server-rendered listing "
            "currently shows an empty state when no postings are open."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="SK텔레콤",
        slug="sk-telecom",
        base_url="https://www.skcareers.com/Recruit/GetRecruitList",
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.sktelecom.com",
        sector="enterprise_it",
        connector_family="enterprise_json",
        request_method="POST",
        request_body={
            "sort": "2",
            "searchText": "",
            "corpCode": "10005",
            "jobRole": "0",
            "recruitType": "",
            "workingType": "",
            "workingRegion": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official SK Careers JSON listing filtered to SK telecom with "
            "corpCode=10005."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="KT",
        slug="kt",
        base_url=(
            "https://recruit.kt.com/api/recruit?isPost=1&isInprogress=1"
            "&isContainsContents=0"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://corp.kt.com",
        sector="enterprise_it",
        connector_family="enterprise_json",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=3,
        notes="Official KT Group careers JSON listing.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="포스코DX",
        slug="posco-dx",
        base_url=(
            "https://recruit.posco.com/h22a01-recruit/H22A1000/list"
            "?rowCount=20&pageSize=10&currPage=1&offset=0&SEARCH_TYPE="
            "&SEARCH_ORDER=s1&SEARCH_KEYWORD=&SEARCH_COMP=01&SEARCH_VALUE="
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.poscodx.com",
        sector="enterprise_it",
        connector_family="enterprise_json",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=1,
        notes=(
            "Official POSCO Group recruit JSON listing filtered to POSCO DX "
            "with SEARCH_COMP=01."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="CJ올리브네트웍스",
        slug="cj-olivenetworks",
        base_url=(
            "https://recruit.cj.net/recruit/ko/common/common/jobListInfo.fo"
            "?COMPANY=E10&BUSINESS_UNIT=E10BU&ZZ_TARGET_1=Z&ROWNO=100"
            "&PAGENO=1&TOTAL_COUNT=1&ZZ_TITLE=&callback=list"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.cjolivenetworks.co.kr",
        sector="enterprise_it",
        connector_family="enterprise_json",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=2,
        notes="Official CJ Group JSONP listing filtered to CJ OliveNetworks.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="한화시스템",
        slug="hanwha-systems",
        base_url=(
            "https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/"
            "search-rcrt"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.hanwhasystems.com",
        sector="enterprise_it",
        connector_family="enterprise_json",
        request_method="POST",
        request_body={
            "langCd": "ko",
            "searchText": "",
            "sdSeqList": [215, 328],
            "rtNrcrtYn": "",
            "rtCarrYn": "",
            "rtIntnYn": "",
            "rtPermanentWorkYn": "",
            "rtTempWorkYn": "",
            "djSeqList": None,
            "rjSeqList": None,
            "page": 0,
            "size": 100,
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official HanwhaIn JSON listing filtered to Hanwha Systems ICT "
            "and Defense subsidiaries."
        ),
        status=SourceStatus.ALLOWED,
    ),
)

INITIAL_GREETING_SOURCES = tuple(
    item
    for item in INITIAL_SOURCE_CATALOG
    if item.source_type == SourceType.GREETING
)


def _apply_source_metadata(source: CareerSource, item: SeedSource) -> None:
    source.source_type = item.source_type
    source.request_method = item.request_method
    source.request_body = item.request_body
    if source.status not in {SourceStatus.BLOCKED, SourceStatus.STOPPED}:
        source.status = item.status
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
                status=item.status,
            )
            session.add(source)
            created += 1
        _apply_source_metadata(source, item)

    session.commit()
    return created
