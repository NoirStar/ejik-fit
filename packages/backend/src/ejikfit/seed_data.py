from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ejikfit.models import (
    CareerSource,
    Company,
    JobPosting,
    PolicyStatus,
    PostingStatus,
    RawSnapshot,
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
        name="NHN 그룹",
        slug="nhn-group",
        base_url="https://careers.nhn.com/recruits",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.nhn.com",
        sector="platform_cloud",
        connector_family="nhn_public_api_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official NHN Careers public list and detail APIs; limited to "
            "Korea-based Tech job groups, excluding talent pools and NHN "
            "JAPAN postings. Affiliate names are preserved in job titles."
        ),
        status=SourceStatus.ALLOWED,
    ),
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
        name="마키나락스",
        slug="makinarocks",
        base_url="https://makinarocks.career.greetinghr.com/ko",
        homepage_url="https://www.makinarocks.ai",
        sector="ai_saas",
        connector_family="greeting",
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=3,
        non_tech_noise=1,
        notes="Official public Greeting careers listing and detail pages.",
    ),
    SeedSource(
        name="리벨리온",
        slug="rebellions",
        base_url="https://rebellions.career.greetinghr.com/ko",
        homepage_url="https://rebellions.ai",
        sector="ai_saas",
        connector_family="greeting",
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=3,
        non_tech_noise=1,
        notes="Official public Greeting careers listing and detail pages.",
    ),
    SeedSource(
        name="코빗",
        slug="korbit",
        base_url="https://korbit.career.greetinghr.com/ko",
        homepage_url="https://www.korbit.co.kr",
        sector="fintech",
        connector_family="greeting",
        brand_tier_weight=3,
        tech_job_priority=4,
        expected_job_volume=2,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes="Official public Greeting careers listing and detail pages.",
    ),
    SeedSource(
        name="빗썸",
        slug="bithumb",
        base_url="https://career.bithumbcorp.com/ko",
        homepage_url="https://www.bithumbcorp.com",
        sector="fintech",
        connector_family="greeting_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=3,
        non_tech_noise=1,
        notes=(
            "Official public Bithumb Greeting careers listing and detail "
            "pages; only technical roles are ingested."
        ),
    ),
    SeedSource(
        name="버즈빌",
        slug="buzzvil",
        base_url="https://buzzvil.career.greetinghr.com/ko/home",
        homepage_url="https://www.buzzvil.com",
        sector="adtech",
        connector_family="greeting_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=4,
        connector_reuse_score=3,
        non_tech_noise=1,
        notes=(
            "Official public Buzzvil Greeting careers listing and detail "
            "pages; referral directories and non-technical roles are excluded."
        ),
    ),
    SeedSource(
        name="디노티시아",
        slug="dnotitia",
        base_url="https://dno.career.greetinghr.com/ko",
        homepage_url="https://dnotitia-recruit.com/",
        sector="ai_infrastructure",
        connector_family="greeting_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=30,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes=(
            "Official public Dnotitia Greeting careers listing and detail "
            "pages; only technical roles are ingested."
        ),
    ),
    SeedSource(
        name="모빌린트",
        slug="mobilint",
        base_url="https://mobilinthire.career.greetinghr.com/ko",
        homepage_url="https://www.mobilint.com/",
        sector="semiconductor_ai",
        connector_family="greeting_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=18,
        connector_reuse_score=3,
        non_tech_noise=1,
        notes=(
            "Official public Mobilint Greeting careers listing and detail "
            "pages; only technical roles are ingested."
        ),
    ),
    SeedSource(
        name="스트라드비젼",
        slug="stradvision",
        base_url="https://stradvision.career.greetinghr.com/ko",
        homepage_url="https://www.stradvision.com/",
        sector="mobility_ai",
        connector_family="greeting_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=18,
        connector_reuse_score=3,
        non_tech_noise=3,
        notes=(
            "Official public STRADVISION Greeting careers listing and "
            "detail pages; only technical roles with a Korean location are "
            "ingested."
        ),
    ),
    SeedSource(
        name="RLWRLD",
        slug="rlwrld",
        base_url="https://realworld.career.greetinghr.com/ko",
        homepage_url="https://www.rlwrld.ai/en/careers",
        sector="robotics_ai",
        connector_family="greeting_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=16,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes=(
            "Official public RLWRLD Greeting careers listing and detail "
            "pages; only technical roles with a Korean location are ingested."
        ),
    ),
    SeedSource(
        name="루닛",
        slug="lunit",
        base_url="https://apply.workable.com/lunit/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.lunit.io",
        sector="medical_ai",
        connector_family="workable_public_api_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=10,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official public Lunit Workable listing and detail APIs; only "
            "published technical roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="트웰브랩스",
        slug="twelve-labs",
        base_url=(
            "https://api.ashbyhq.com/posting-api/job-board/twelve-labs"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.twelvelabs.io",
        sector="ai_saas",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=14,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official public Twelve Labs Ashby feed; only listed technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="42dot",
        slug="42dot",
        base_url="https://api.ashbyhq.com/posting-api/job-board/42dot",
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.42dot.ai",
        sector="mobility_ai",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=60,
        connector_reuse_score=5,
        non_tech_noise=7,
        notes=(
            "Official public 42dot Ashby feed; only listed technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Fieldguide",
        slug="fieldguide",
        base_url=(
            "https://api.ashbyhq.com/posting-api/job-board/fieldguide"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.fieldguide.io",
        sector="audit_saas_ai",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=3,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official public Fieldguide Ashby feed; only listed technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="FriendliAI",
        slug="friendli-ai",
        base_url=(
            "https://api.ashbyhq.com/posting-api/job-board/friendliai"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://friendli.ai",
        sector="ai_infrastructure",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=7,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official public FriendliAI Ashby feed; only listed technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Hopae",
        slug="hopae",
        base_url="https://api.ashbyhq.com/posting-api/job-board/hopae",
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://hopae.com",
        sector="identity_security",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official public Hopae Ashby feed; only listed technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="크라우드웍스",
        slug="crowdworks",
        base_url="https://crowdworks.career.greetinghr.com/ko",
        homepage_url="https://www.crowdworks.ai",
        sector="ai_data",
        connector_family="greeting_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official CrowdWorks Greeting careers listing and detail pages; "
            "limited to explicit software, data, and AI roles."
        ),
    ),
    SeedSource(
        name="데이블",
        slug="dable",
        base_url="https://dable.career.greetinghr.com/ko",
        homepage_url="https://dable.io",
        sector="ai_adtech",
        connector_family="greeting_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official Dable Greeting careers listing and detail pages; "
            "limited to explicit software, data, and ML roles."
        ),
    ),
    SeedSource(
        name="모레(Moreh)",
        slug="moreh",
        base_url="https://moreh.career.greetinghr.com/ko",
        homepage_url="https://moreh.io",
        sector="ai_infrastructure",
        connector_family="greeting_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=12,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official Moreh Greeting careers listing and detail pages; "
            "limited to explicit AI infrastructure and software roles."
        ),
    ),
    SeedSource(
        name="하이퍼엑셀",
        slug="hyperaccel",
        base_url="https://hyperaccel.career.greetinghr.com/ko",
        homepage_url="https://www.hyperaccel.ai",
        sector="ai_semiconductor",
        connector_family="greeting_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=11,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official HyperAccel Greeting careers listing and detail pages; "
            "limited to explicit compiler, systems, infrastructure, and "
            "semiconductor engineering roles."
        ),
    ),
    SeedSource(
        name="피처링",
        slug="featuring",
        base_url="https://featuring.career.greetinghr.com/ko",
        homepage_url="https://featuring.co",
        sector="ai_marketing",
        connector_family="greeting_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=7,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official Featuring Greeting careers listing and detail pages; "
            "limited to explicit software, data, AI, and infrastructure roles."
        ),
    ),
    SeedSource(
        name="올거나이즈",
        slug="allganize",
        base_url="https://allganize.career.greetinghr.com/ko",
        homepage_url="https://www.allganize.ai",
        sector="ai_saas",
        connector_family="greeting_korea_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official Allganize Greeting careers listing and detail pages; "
            "limited to technical roles explicitly based in Korea."
        ),
    ),
    SeedSource(
        name="마크비전",
        slug="marqvision",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/"
            "marqvision/jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.marqvision.com",
        sector="ai_brand_protection",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official public MarqVision Greenhouse feed; only listed "
            "technical roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="네이버웹툰",
        slug="naver-webtoon",
        base_url=(
            "https://recruit.webtoonscorp.com/rcrt/loadJobList.do?"
            "firstIndex=0&recordCountPerPage=500"
        ),
        source_type=SourceType.NAVER_JSON,
        homepage_url="https://webtoonscorp.com",
        sector="content_platform",
        connector_family="naver_webtoon_json_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official NAVER WEBTOON careers JSON listing; limited to active "
            "Tech-category roles and excludes evergreen talent pools."
        ),
    ),
    SeedSource(
        name="KREAM",
        slug="kream",
        base_url=(
            "https://recruit.kreamcorp.com/rcrt/loadJobList.do?"
            "firstIndex=0&recordCountPerPage=500"
        ),
        source_type=SourceType.NAVER_JSON,
        homepage_url="https://kream.co.kr",
        sector="commerce_platform",
        connector_family="naver_company_json_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=9,
        connector_reuse_score=5,
        non_tech_noise=13,
        notes=(
            "Official KREAM careers JSON listing; limited to active "
            "openings in KREAM's explicit Tech job category."
        ),
    ),
    SeedSource(
        name="팀블라인드",
        slug="teamblind",
        base_url="https://recruit.teamblind.com/recruit",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.teamblind.com/kr",
        sector="professional_network",
        connector_family="ninehire_public_api_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=1,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official Teamblind careers site and its public Ninehire feed; "
            "limited to active technical roles with verified detail pages."
        ),
    ),
    SeedSource(
        name="크몽",
        slug="kmong",
        base_url="https://kmong.career.greetinghr.com/ko/home",
        homepage_url="https://kmong.com",
        sector="talent_marketplace",
        connector_family="greeting_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official Kmong Greeting careers listing and detail pages; "
            "limited to explicit software, data, infrastructure, and "
            "security roles."
        ),
    ),
    SeedSource(
        name="직방",
        slug="zigbang",
        base_url="https://zigbang.career.greetinghr.com/ko/home",
        homepage_url="https://www.zigbang.com",
        sector="proptech",
        connector_family="greeting_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=5,
        notes=(
            "Official Zigbang Greeting careers listing and detail pages; "
            "the source remains monitored when no technical role is open."
        ),
    ),
    SeedSource(
        name="야놀자",
        slug="yanolja",
        base_url=(
            "https://yanolja.wd102.myworkdayjobs.com/wday/cxs/yanolja/"
            "External_Yanolja/jobs"
        ),
        source_type=SourceType.WORKDAY,
        homepage_url="https://www.yanoljagroup.com",
        sector="travel_platform",
        connector_family="workday_public_api_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official Yanolja Workday listing and job details; limited to "
            "technical roles based in Korea and monitored through empty "
            "recruiting periods."
        ),
        request_method="POST",
        request_body={
            "appliedFacets": {},
            "limit": 20,
            "offset": 0,
            "searchText": "",
        },
    ),
    SeedSource(
        name="카카오엔터프라이즈",
        slug="kakao-enterprise",
        base_url="https://careers.kakaoenterprise.com/ko/intro",
        homepage_url="https://kakaoenterprise.com",
        sector="cloud_ai",
        connector_family="greeting_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official Kakao Enterprise Greeting careers listing and detail "
            "pages; the source remains monitored when no technical role is "
            "open."
        ),
    ),
    SeedSource(
        name="카카오스타일",
        slug="kakao-style",
        base_url="https://career.kakaostyle.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://kakaostyle.com",
        sector="commerce_platform",
        connector_family="ninehire_public_api_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official KakaoStyle careers site and public Ninehire feed; "
            "limited to active technical roles and excludes explicitly "
            "business-classified AI operations roles."
        ),
    ),
    SeedSource(
        name="카카오헬스케어",
        slug="kakao-healthcare",
        base_url="https://recruit.kakaohealthcare.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://kakaohealthcare.com",
        sector="healthcare_ai",
        connector_family="ninehire_public_api_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official Kakao Healthcare careers site and public Ninehire "
            "feed; limited to active software, data, AI, and infrastructure "
            "roles."
        ),
    ),
    SeedSource(
        name="메가존클라우드 그룹",
        slug="megazone-cloud",
        base_url="https://career.megazone.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.megazone.com",
        sector="cloud_infrastructure",
        connector_family="ninehire_public_api_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official MegazoneCloud group careers site and public Ninehire "
            "feed; limited to active technical roles while preserving each "
            "affiliate name in the posting title."
        ),
    ),
    SeedSource(
        name="11번가",
        slug="11st",
        base_url="https://11st.career.greetinghr.com/ko/career",
        homepage_url="https://www.11stcorp.com",
        sector="commerce_platform",
        connector_family="greeting_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official 11st Greeting careers listing and detail pages; the "
            "source remains monitored when no technical role is open."
        ),
    ),
    SeedSource(
        name="CLASS101",
        slug="class101",
        base_url="https://jobs.class101.net/career",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://class101.net",
        sector="creator_education",
        connector_family="ninehire_public_api_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official CLASS101 careers site and public Ninehire feed; "
            "limited to active software and infrastructure roles."
        ),
    ),
    SeedSource(
        name="콴다(QANDA)",
        slug="qanda",
        base_url="https://recruit.mathpresso.com/ko/home",
        homepage_url="https://qanda.ai",
        sector="education_ai",
        connector_family="greeting_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official QANDA/Mathpresso Greeting careers listing and detail "
            "pages; the source remains monitored when no technical role is "
            "open."
        ),
    ),
    SeedSource(
        name="Gauss Labs",
        slug="gauss-labs",
        base_url=(
            "https://api.lever.co/v0/postings/gausslabs?mode=json"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.gausslabs.ai",
        sector="industrial_ai",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes=(
            "Official public Gauss Labs Lever feed; only technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Palantir Technologies",
        slug="palantir",
        base_url=(
            "https://api.lever.co/v0/postings/palantir?mode=json"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.palantir.com",
        sector="data_ai_platform",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=1,
        connector_reuse_score=3,
        non_tech_noise=6,
        notes=(
            "Official public Palantir Lever feed; only technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Databricks",
        slug="databricks",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/databricks/"
            "jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.databricks.com",
        sector="data_ai_platform",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=7,
        connector_reuse_score=5,
        non_tech_noise=7,
        notes=(
            "Official public Databricks Greenhouse feed; only technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Airwallex",
        slug="airwallex",
        base_url=(
            "https://api.ashbyhq.com/posting-api/job-board/airwallex"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://careers.airwallex.com",
        sector="fintech",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=5,
        non_tech_noise=8,
        notes=(
            "Official public Airwallex Ashby feed; only listed technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Applied Intuition",
        slug="applied-intuition",
        base_url="https://api.ashbyhq.com/posting-api/job-board/applied",
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.appliedintuition.com/careers",
        sector="mobility_ai",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=5,
        notes=(
            "Official public Applied Intuition Ashby feed; only listed "
            "technical roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Reflection AI",
        slug="reflection-ai",
        base_url=(
            "https://api.ashbyhq.com/posting-api/job-board/reflectionai"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://reflection.ai",
        sector="ai_saas",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official public Reflection AI Ashby feed; only listed "
            "technical roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Cheiron",
        slug="cheiron",
        base_url="https://api.ashbyhq.com/posting-api/job-board/cheiron",
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.cheiron.bio",
        sector="biotech_ai",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=5,
        notes=(
            "Official public Cheiron Ashby feed; only listed technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Cohere",
        slug="cohere",
        base_url="https://api.ashbyhq.com/posting-api/job-board/cohere",
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://cohere.com/careers",
        sector="ai_saas",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official public Cohere Ashby feed; only listed technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Datadog",
        slug="datadog",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/datadog/"
            "jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://careers.datadoghq.com",
        sector="cloud_observability",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=5,
        non_tech_noise=8,
        notes=(
            "Official public Datadog Greenhouse feed; only technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="UJET",
        slug="ujet",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/ujet/"
            "jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.ujet.cx",
        sector="ai_saas",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official public UJET Greenhouse feed; only technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="OVERDARE",
        slug="overdare",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/overdare/"
            "jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://overdare.com",
        sector="game_content",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official public OVERDARE Greenhouse feed; only technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Cognite",
        slug="cognite",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/cognite/"
            "jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.cognite.com/en/careers",
        sector="industrial_ai",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=1,
        connector_reuse_score=5,
        non_tech_noise=5,
        notes=(
            "Official public Cognite Greenhouse feed; only technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="CLO Virtual Fashion",
        slug="clo-virtual-fashion",
        base_url=(
            "https://api.lever.co/v0/postings/clovirtualfashion?mode=json"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.clovirtualfashion-careers.com",
        sector="fashion_tech",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=10,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official public CLO Virtual Fashion Lever feed; only "
            "technical roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Amazon Web Services Korea",
        slug="amazon-web-services-korea",
        base_url=(
            "https://www.amazon.jobs/en/search.json?"
            "country=KOR&result_limit=100&offset=0"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url=(
            "https://www.amazon.jobs/content/en/locations/"
            "asia-pacific/south-korea"
        ),
        sector="cloud_infrastructure",
        connector_family="amazon_jobs_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=58,
        connector_reuse_score=4,
        non_tech_noise=7,
        notes=(
            "Official Amazon Jobs Korea search API; all pages are merged and "
            "only roles in Amazon's technical job categories are ingested."
        ),
    ),
    SeedSource(
        name="NVIDIA Korea",
        slug="nvidia-korea",
        base_url=(
            "https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/"
            "NVIDIAExternalCareerSite/jobs"
        ),
        source_type=SourceType.WORKDAY,
        homepage_url="https://www.nvidia.com/en-us/about-nvidia/careers/",
        sector="semiconductor_ai",
        connector_family="workday_public_api_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=21,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official NVIDIA Workday Korea search and job details; all pages "
            "are merged and only technical roles based in Korea are ingested."
        ),
        request_method="POST",
        request_body={
            "appliedFacets": {},
            "limit": 20,
            "offset": 0,
            "searchText": "Korea",
        },
    ),
    SeedSource(
        name="Riot Games Korea",
        slug="riot-games-korea",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/"
            "riotgames/jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.riotgames.com/en/work-with-us",
        sector="game_content",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=1,
        connector_reuse_score=5,
        non_tech_noise=6,
        notes=(
            "Official public Riot Games Greenhouse feed; only technical "
            "roles based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Wiz Korea",
        slug="wiz-korea",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/"
            "wizinc/jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.wiz.io/careers",
        sector="cloud_security",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=1,
        connector_reuse_score=5,
        non_tech_noise=5,
        notes=(
            "Official public Wiz Greenhouse feed; only technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="Celonis Korea",
        slug="celonis-korea",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/"
            "celonis/jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.celonis.com/careers/jobs",
        sector="enterprise_software",
        connector_family="lever_greenhouse_korea_tech",
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=1,
        connector_reuse_score=5,
        non_tech_noise=5,
        notes=(
            "Official public Celonis Greenhouse feed; only technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="OpenAI Korea",
        slug="openai-korea",
        base_url="https://api.ashbyhq.com/posting-api/job-board/openai",
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://openai.com/careers/",
        sector="ai_saas",
        connector_family="ashby_public_api_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=7,
        connector_reuse_score=5,
        non_tech_noise=5,
        notes=(
            "Official public OpenAI Ashby feed; only listed technical roles "
            "based in Korea are ingested."
        ),
    ),
    SeedSource(
        name="백패커",
        slug="backpackr",
        base_url="https://idus.career.greetinghr.com/ko",
        homepage_url="https://www.backpackr.com",
        sector="content_platform",
        connector_family="greeting_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=7,
        connector_reuse_score=3,
        non_tech_noise=4,
        notes=(
            "Official public Backpackr careers page for idus and Tumblbug; "
            "only technical roles are ingested."
        ),
    ),
    SeedSource(
        name="Apple Korea",
        slug="apple-korea",
        base_url=(
            "https://jobs.apple.com/en-us/search?"
            "location=korea-republic-of-KOR"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.apple.com/kr/",
        sector="consumer_technology",
        connector_family="apple_jobs_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=7,
        connector_reuse_score=4,
        non_tech_noise=7,
        notes=(
            "Official Apple Jobs Korea search and job details; every search "
            "page is reconciled and only technical roles are ingested."
        ),
    ),
    SeedSource(
        name="Microsoft Korea",
        slug="microsoft-korea",
        base_url=(
            "https://apply.careers.microsoft.com/api/pcsx/search?"
            "domain=microsoft.com&query=&location=South%20Korea&start=0"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url=(
            "https://apply.careers.microsoft.com/careers?"
            "location=South%20Korea"
        ),
        sector="cloud_software",
        connector_family="microsoft_pcsx_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=8,
        connector_reuse_score=5,
        non_tech_noise=7,
        notes=(
            "Official Microsoft Careers PCS search and detail APIs, which "
            "are explicitly allowed by its robots policy; every Korea page "
            "is reconciled and only technical roles are ingested."
        ),
    ),
    SeedSource(
        name="Qualcomm Korea",
        slug="qualcomm-korea",
        base_url=(
            "https://careers.qualcomm.com/api/pcsx/search?"
            "domain=qualcomm.com&query=&location=Korea%2C%20Republic%20of&"
            "start=0"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.qualcomm.com/company/careers",
        sector="semiconductor_mobile_ai",
        connector_family="qualcomm_pcsx_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=18,
        connector_reuse_score=5,
        non_tech_noise=1,
        notes=(
            "Official Qualcomm Careers PCS search and detail APIs, which "
            "are explicitly allowed by its robots policy; every Korea page "
            "is reconciled and official engineering job families are ingested."
        ),
    ),
    SeedSource(
        name="AMD Korea",
        slug="amd-korea",
        base_url=(
            "https://careers.amd.com/api/jobs?"
            "location=Korea%2C%20South&limit=100"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://careers.amd.com/careers-home/",
        sector="semiconductor_ai",
        connector_family="jibe_api_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=3,
        notes=(
            "Official AMD Careers Jibe API scoped to Korea; the complete "
            "response includes full job descriptions and only AMD's official "
            "Engineering category is ingested."
        ),
    ),
    SeedSource(
        name="SAP Korea",
        slug="sap-korea",
        base_url="https://jobs.sap.com/search/?q=&locationsearch=Korea",
        source_type=SourceType.HTML_LISTING_DETAIL,
        homepage_url="https://jobs.sap.com/search/?q=&locationsearch=Korea",
        sector="enterprise_software_cloud",
        connector_family="sap_public_jobs_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=4,
        non_tech_noise=6,
        notes=(
            "Official public SAP Jobs Korea search and detail pages; the "
            "published result total is reconciled and only developer, "
            "engineering, architecture, and technical operations roles are "
            "ingested."
        ),
    ),
    SeedSource(
        name="Google Korea",
        slug="google-korea",
        base_url=(
            "https://www.google.com/about/careers/applications/jobs/results/"
            "?distance=50&location=Seoul%2C%20South%20Korea&q=engineer"
        ),
        source_type=SourceType.HTML_LISTING_DETAIL,
        homepage_url=(
            "https://www.google.com/about/careers/applications/jobs/results/"
            "?distance=50&location=Seoul%2C%20South%20Korea&q=engineer"
        ),
        sector="consumer_software_cloud",
        connector_family="google_careers_korea_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=9,
        connector_reuse_score=4,
        non_tech_noise=1,
        notes=(
            "Official Google Careers Seoul engineer search and public job "
            "detail pages. The published result total is reconciled before "
            "technical-title filtering, without using disallowed pagination."
        ),
    ),
    SeedSource(
        name="리디",
        slug="ridi",
        base_url="https://ridi.recruit.roundhr.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://ridicorp.com",
        sector="content_platform",
        connector_family="roundhr_public_api_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=4,
        non_tech_noise=3,
        notes=(
            "Official public RIDI RoundHR careers listing and detail pages; "
            "only open technical roles are ingested."
        ),
    ),
    SeedSource(
        name="VESSL AI",
        slug="vessl-ai",
        base_url="https://vessl.recruit.roundhr.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://vessl.ai",
        sector="ai_infrastructure",
        connector_family="roundhr_public_api_tech",
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=4,
        connector_reuse_score=4,
        non_tech_noise=3,
        notes=(
            "Official public VESSL AI RoundHR careers listing and detail "
            "pages; only open engineering roles are ingested."
        ),
    ),
    SeedSource(
        name="휴톰",
        slug="hutom",
        base_url="https://hutom.recruit.roundhr.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://hutom.io",
        sector="medical_ai",
        connector_family="roundhr_public_api_tech",
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=1,
        connector_reuse_score=4,
        non_tech_noise=3,
        notes=(
            "Official public Hutom RoundHR careers listing and detail pages; "
            "only open engineering roles are ingested."
        ),
    ),
    SeedSource(
        name="SNJ LAB",
        slug="snj-lab",
        base_url="https://snjlab.recruit.roundhr.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://snjlab.com",
        sector="quant_fintech",
        connector_family="roundhr_public_api_tech",
        brand_tier_weight=3,
        tech_job_priority=5,
        expected_job_volume=1,
        connector_reuse_score=4,
        non_tech_noise=2,
        notes=(
            "Official public SNJ LAB RoundHR careers listing and detail "
            "pages; only open engineering roles are ingested."
        ),
    ),
    SeedSource(
        name="인딥에이아이",
        slug="indeep-ai",
        base_url="https://indeepai.recruit.roundhr.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://indeepai.co.kr",
        sector="hr_ai",
        connector_family="roundhr_public_api_tech",
        brand_tier_weight=3,
        tech_job_priority=5,
        expected_job_volume=3,
        connector_reuse_score=4,
        non_tech_noise=2,
        notes=(
            "Official public InDeepAI RoundHR careers listing and detail "
            "pages; only open engineering roles are ingested."
        ),
    ),
    SeedSource(
        name="기어세컨드",
        slug="gear2",
        base_url="https://gear2.recruit.roundhr.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://gear2.net",
        sector="game_content",
        connector_family="roundhr_public_api_tech",
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=4,
        non_tech_noise=4,
        notes=(
            "Official public GEAR2 RoundHR careers listing and detail pages; "
            "only open software and data roles are ingested."
        ),
    ),
    SeedSource(
        name="뱅크샐러드",
        slug="banksalad",
        base_url=(
            "https://www.banksalad.com/proxy/api/greeting/openings"
        ),
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://corp.banksalad.com",
        sector="fintech",
        connector_family="banksalad_greeting_api_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=4,
        connector_reuse_score=3,
        non_tech_noise=0,
        notes=(
            "Official Banksalad careers JSON and public Greeting details; "
            "only the technology and data departments are ingested."
        ),
    ),
    SeedSource(
        name="람다256",
        slug="lambda256",
        base_url="https://lambda256.career.greetinghr.com/ko",
        homepage_url="https://lambda256.io",
        sector="fintech",
        connector_family="greeting",
        brand_tier_weight=3,
        tech_job_priority=5,
        expected_job_volume=3,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes="Official public Greeting careers listing and detail pages.",
    ),
    SeedSource(
        name="업스테이지",
        slug="upstage",
        base_url="https://careers.upstage.ai/ko",
        homepage_url="https://www.upstage.ai",
        sector="ai_saas",
        connector_family="greeting",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes="Official public Greeting-powered careers listing and details.",
    ),
    SeedSource(
        name="노타AI",
        slug="nota-ai",
        base_url="https://career.nota.ai/ko",
        homepage_url="https://www.nota.ai",
        sector="ai_saas",
        connector_family="greeting",
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes="Official public Greeting-powered careers listing and details.",
    ),
    SeedSource(
        name="포트원",
        slug="portone",
        base_url="https://portone.career.greetinghr.com/ko",
        homepage_url="https://portone.io",
        sector="fintech",
        connector_family="greeting",
        brand_tier_weight=3,
        tech_job_priority=5,
        expected_job_volume=2,
        connector_reuse_score=3,
        non_tech_noise=1,
        notes="Official public Greeting careers listing and detail pages.",
    ),
    SeedSource(
        name="캐럿AI",
        slug="carat-ai",
        base_url="https://carat.career.greetinghr.com/ko",
        homepage_url="https://carat.im",
        sector="ai_saas",
        connector_family="greeting",
        brand_tier_weight=3,
        tech_job_priority=4,
        expected_job_volume=2,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes="Official public Greeting careers listing and detail pages.",
    ),
    SeedSource(
        name="뤼튼테크놀로지스",
        slug="wrtn",
        base_url="https://wrtn.career.greetinghr.com/ko",
        homepage_url="https://wrtn.io",
        sector="ai_saas",
        connector_family="greeting",
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=3,
        non_tech_noise=2,
        notes="Official public Greeting careers listing and detail pages.",
    ),
    SeedSource(
        name="무신사",
        slug="musinsa",
        base_url="https://www.musinsacareers.com/ko",
        source_type=SourceType.GREETING,
        homepage_url="https://www.musinsa.com",
        sector="platform",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=1,
        notes=(
            "Official public Musinsa careers listing and detail pages; "
            "limited to technical role families exposed by Greeting."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="토스 커뮤니티",
        slug="toss",
        base_url=(
            "https://api-public.toss.im/api/v3/ipd-eggnog/career/job-groups"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://toss.im",
        sector="fintech",
        connector_family="toss_public_api",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=6,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Toss public career job-groups endpoint; only explicit "
            "engineering, data, security, infrastructure, QA, and ML "
            "categories are ingested."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="당근",
        slug="daangn",
        base_url="https://careers.daangn.com/sitemap-0.xml",
        source_type=SourceType.SITEMAP_DISCOVERY,
        homepage_url="https://www.daangn.com",
        sector="platform",
        connector_family="sitemap_jsonld_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Daangn careers sitemap and public schema.org JobPosting "
            "detail pages; only technical role titles are ingested."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="쿠팡",
        slug="coupang",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/"
            "coupang/jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.coupang.jobs/kr/",
        sector="commerce",
        connector_family="lever_greenhouse_korea_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=6,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Coupang public Greenhouse feed; limited to domestic "
            "software, data, infrastructure, QA, and security role titles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="Moloco",
        slug="moloco",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/"
            "moloco/jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.moloco.com/ko/careers",
        sector="ai_adtech",
        connector_family="lever_greenhouse_korea_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=4,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Moloco public Greenhouse feed; limited to domestic "
            "technical role titles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="Sendbird",
        slug="sendbird",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/"
            "sendbird/jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://sendbird.com/careers",
        sector="saas_ai",
        connector_family="lever_greenhouse_korea_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Sendbird public Greenhouse feed; limited to domestic "
            "technical role titles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="서울로보틱스",
        slug="seoul-robotics",
        base_url=(
            "https://boards-api.greenhouse.io/v1/boards/"
            "seoulrobotics/jobs?content=true"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://seoulrobotics.org",
        sector="autonomous_driving",
        connector_family="lever_greenhouse_korea_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=7,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=1,
        notes=(
            "Official Seoul Robotics public Greenhouse feed; limited to "
            "domestic software, ML, infrastructure, and QA roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="우아한형제들",
        slug="woowahan-brothers",
        base_url=(
            "https://career.woowahan.com/w1/recruits?page=0&size=100"
            "&sort=updateDate,desc&recruitCampaignSeq=0"
        ),
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://career.woowahan.com",
        sector="platform",
        connector_family="woowahan_public_api_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=4,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Woowahan careers public list and detail APIs; limited "
            "to software, data, infrastructure, QA, and security roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="카카오뱅크",
        slug="kakaobank",
        base_url="https://recruit.kakaobank.com/api/recruits",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://recruit.kakaobank.com",
        sector="fintech",
        connector_family="kakaobank_public_api_tech",
        request_method="POST",
        request_body={
            "pageNumber": 1,
            "pageSize": 100,
            "receiptFilterType": "ONGOING",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official KakaoBank careers public list and detail APIs; limited "
            "to software, data, infrastructure, QA, and security roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="쏘카",
        slug="socar",
        base_url="https://www.socarcorp.kr/careers/jobs",
        source_type=SourceType.GREETING,
        homepage_url="https://www.socarcorp.kr",
        sector="mobility",
        connector_family="corporate_greeting_links_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Socar corporate careers listing linked to public "
            "Greeting detail pages; limited to explicit technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="오늘의집",
        slug="bucketplace",
        base_url="https://www.bucketplace.com/careers/",
        source_type=SourceType.GREETING,
        homepage_url="https://www.bucketplace.com",
        sector="commerce_platform",
        connector_family="grouped_greeting_links_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Bucketplace careers listing linked to public Greeting "
            "detail pages; limited to explicit technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="두나무",
        slug="dunamu",
        base_url=(
            "https://careers.dunamu.com/api/job-boards/"
            "jd0wjv/job-notices?lang=ko"
        ),
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.dunamu.com",
        sector="fintech",
        connector_family="dunamu_official_api_proxy_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Dunamu public current-jobs API with canonical detail "
            "links; this endpoint supersedes HTML listings blocked from the "
            "production runner and is limited to explicit engineering and "
            "security roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="컬리",
        slug="kurly",
        base_url="https://kurly.career.greetinghr.com/ko",
        source_type=SourceType.GREETING,
        homepage_url="https://www.kurly.com",
        sector="commerce_platform",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Kurly Greeting careers listing and detail pages; "
            "limited to software, data, infrastructure, and security roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="하이퍼커넥트",
        slug="hyperconnect",
        base_url=(
            "https://api.lever.co/v0/postings/matchgroup?mode=json"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://career.hyperconnect.com",
        sector="consumer_tech_ai",
        connector_family="lever_greenhouse_korea_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Match Group Lever feed mirrored by Hyperconnect's "
            "careers page; limited to Seoul-based technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="하이브",
        slug="hybe",
        base_url="https://careers.hybecorp.com/ko/home",
        source_type=SourceType.GREETING,
        homepage_url="https://hybecorp.com",
        sector="content_platform",
        connector_family="greeting_hybe_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=4,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=6,
        notes=(
            "Official HYBE Greeting-powered careers listing and detail "
            "pages; limited to openings classified in HYBE's Technology "
            "job group, including Weverse and DRIMAGE affiliates."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="스푼랩스",
        slug="spoonlabs",
        base_url="https://career.spoonlabs.com/ko/recruiting",
        source_type=SourceType.GREETING,
        homepage_url="https://www.spoonlabs.com",
        sector="consumer_content_ai",
        connector_family="greeting_spoonlabs_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=1,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=5,
        notes=(
            "Official Spoon Labs Greeting-powered careers listing and "
            "detail pages; limited to openings in the Development job group."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="두잇",
        slug="doeat",
        base_url="https://career.doeat.io/ko/home",
        source_type=SourceType.GREETING,
        homepage_url="https://doeat.io",
        sector="consumer_delivery",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=1,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=4,
        notes=(
            "Official Doeat Greeting-powered careers listing and detail "
            "pages; limited to explicit software engineering roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="알세미",
        slug="alsemy",
        base_url="https://alsemy.career.greetinghr.com/ko/intro",
        source_type=SourceType.GREETING,
        homepage_url="https://www.alsemy.com",
        sector="semiconductor_ai",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=3,
        tech_job_priority=5,
        expected_job_volume=1,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=3,
        notes=(
            "Official Alsemy Greeting careers listing and detail pages; "
            "limited to explicit software and graphics engineering roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="피에프씨테크놀로지스",
        slug="pfct",
        base_url="https://pfct.career.greetinghr.com/ko/home",
        source_type=SourceType.GREETING,
        homepage_url="https://www.pfct.co.kr",
        sector="fintech_credit",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=5,
        notes=(
            "Official PFCT Greeting careers listing and detail pages; "
            "limited to explicit software, data, machine-learning, and "
            "infrastructure roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="리멤버앤컴퍼니",
        slug="remember",
        base_url="https://hello.remember.co.kr/recruit",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://corp.remember.co.kr",
        sector="professional_network",
        connector_family="ninehire_public_api_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=1,
        connector_reuse_score=5,
        policy_risk=0,
        non_tech_noise=5,
        notes=(
            "Official Remember careers site and its public Ninehire feed; "
            "limited to active technical roles and excludes the evergreen "
            "talent pool."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="마이리얼트립",
        slug="myrealtrip",
        base_url="https://myrealtrip.career.greetinghr.com/ko",
        source_type=SourceType.GREETING,
        homepage_url="https://www.myrealtrip.com",
        sector="travel_platform",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official MyRealTrip Greeting careers listing and detail pages; "
            "limited to explicit engineering, data, infrastructure, and "
            "security roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="와디즈",
        slug="wadiz",
        base_url="https://job.wadiz.kr/ko",
        source_type=SourceType.GREETING,
        homepage_url="https://www.wadiz.kr",
        sector="commerce_platform",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=2,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Wadiz Greeting careers listing and detail pages; "
            "limited to explicit technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="여기어때컴퍼니",
        slug="gccompany",
        base_url="https://gccompany.career.greetinghr.com/ko",
        source_type=SourceType.GREETING,
        homepage_url="https://gccompany.co.kr",
        sector="travel_platform",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=4,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official GC Company Greeting careers listing and detail pages; "
            "limited to explicit engineering, data, infrastructure, and "
            "security roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="스캐터랩",
        slug="scatterlab",
        base_url="https://www.scatterlab.co.kr/ko",
        source_type=SourceType.GREETING,
        homepage_url="https://www.scatterlab.co.kr",
        sector="consumer_ai",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Scatter Lab Greeting-powered careers listing and "
            "detail pages; limited to explicit technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="채널코퍼레이션",
        slug="channel-corporation",
        base_url="https://channel.io/kr/careers",
        source_type=SourceType.STATIC_NEXT_DATA,
        homepage_url="https://channel.io",
        sector="b2b_saas_ai",
        connector_family="channel_next_data_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=5,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Channel Corporation careers page with complete "
            "server-rendered job data; limited to Korea-based technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="핀다",
        slug="finda",
        base_url="https://finda.career.greetinghr.com/ko/career",
        source_type=SourceType.GREETING,
        homepage_url="https://finda.co.kr",
        sector="fintech",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Finda Greeting careers listing and detail pages; "
            "limited to explicit technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="딥노이드",
        slug="deepnoid",
        base_url="https://deepnoid.career.greetinghr.com/ko/intro",
        source_type=SourceType.GREETING,
        homepage_url="https://www.deepnoid.com",
        sector="medical_ai",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=6,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Deepnoid Greeting careers listing and detail pages; "
            "limited to explicit technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="에너자이",
        slug="enerzai",
        base_url="https://enerzai.career.greetinghr.com/ko/home",
        source_type=SourceType.GREETING,
        homepage_url="https://enerzai.com",
        sector="edge_ai",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Enerzai Greeting careers listing and detail pages; "
            "limited to explicit technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="퓨리오사AI",
        slug="furiosa-ai",
        base_url=(
            "https://api.ashbyhq.com/posting-api/job-board/furiosa-ai"
        ),
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://furiosa.ai",
        sector="ai_semiconductor",
        connector_family="ashby_public_api_korea_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=30,
        connector_reuse_score=5,
        policy_risk=0,
        non_tech_noise=5,
        notes=(
            "Official FuriosaAI Ashby feed; limited to listed Korea-based "
            "technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="에이블리코퍼레이션",
        slug="ably",
        base_url="https://ably.team/recruit",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://ably.team",
        sector="fashion_commerce",
        connector_family="ably_next_ninehire_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=7,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Ably careers page and linked Ninehire application "
            "details; limited to open technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        "네이버",
        "naver",
        (
            "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko"
            "&firstIndex=0&recordCountPerPage=500&sysCompanyCdArr=KR"
        ),
        SourceType.NAVER_JSON,
        "https://www.navercorp.com",
        "platform",
        "naver_company_json_tech",
        PolicyStatus.ALLOWED,
        6,
        6,
        1,
        5,
        0,
        4,
        (
            "Official NAVER recruitment JSON list, scoped to the NAVER "
            "company and its Tech-classified openings."
        ),
    ),
    SeedSource(
        name="네이버클라우드",
        slug="naver-cloud",
        base_url=(
            "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko"
            "&firstIndex=0&recordCountPerPage=500&sysCompanyCdArr=NB"
        ),
        source_type=SourceType.NAVER_JSON,
        homepage_url="https://www.navercloudcorp.com",
        sector="cloud_ai",
        connector_family="naver_company_json_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=1,
        connector_reuse_score=5,
        non_tech_noise=4,
        notes=(
            "Official NAVER recruitment JSON list scoped to NAVER Cloud; "
            "only Tech-classified openings are ingested."
        ),
    ),
    SeedSource(
        name="SNOW",
        slug="snow",
        base_url=(
            "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko"
            "&firstIndex=0&recordCountPerPage=500&sysCompanyCdArr=SN"
        ),
        source_type=SourceType.NAVER_JSON,
        homepage_url="https://snowcorp.com",
        sector="consumer_ai_content",
        connector_family="naver_company_json_tech",
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=2,
        notes=(
            "Official NAVER recruitment JSON list scoped to SNOW; only "
            "Tech-classified openings are ingested."
        ),
    ),
    SeedSource(
        name="네이버랩스",
        slug="naver-labs",
        base_url=(
            "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko"
            "&firstIndex=0&recordCountPerPage=500&sysCompanyCdArr=NL"
        ),
        source_type=SourceType.NAVER_JSON,
        homepage_url="https://www.naverlabs.com",
        sector="robotics_ai",
        connector_family="naver_company_json_tech",
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=5,
        non_tech_noise=1,
        notes=(
            "Official NAVER recruitment JSON list scoped to NAVER LABS; "
            "only Tech-classified openings are ingested."
        ),
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
        base_url="https://www.samsungcareers.com/hr/list.data#samsung-electronics",
        source_type=SourceType.HTML_LISTING_DETAIL,
        homepage_url="https://www.samsung.com/sec/",
        sector="enterprise_it",
        connector_family="html_listing_detail",
        request_method="POST",
        request_body={
            "currentPageNo": "1",
            "intNo": "0",
            "strVal": "",
            "strTxt": "",
            "strKey": "",
            "strCompany": ["C10CAA", "C10", "C10CAH", "C10"],
            "strType": "",
            "strOrderBy": "",
            "strEntity": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=4,
        notes=(
            "Official Samsung Careers HTML listing filtered to Samsung "
            "Electronics DX and DS company codes; currently returns an empty "
            "state when no postings are open."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="삼성SDS",
        slug="samsung-sds",
        base_url="https://www.samsungcareers.com/hr/list.data#samsung-sds",
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
        name="현대모비스",
        slug="hyundai-mobis",
        base_url="https://careers.mobis.com/jobs",
        source_type=SourceType.HTML_LISTING_DETAIL,
        homepage_url="https://www.mobis.com",
        sector="mobility_software",
        connector_family="hyundai_mobis_html_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=5,
        expected_job_volume=2,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=5,
        notes=(
            "Official Hyundai Mobis careers listing and detail pages; the "
            "complete declared listing is validated before retaining only "
            "roles in the official SW/Logic job group."
        ),
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
        base_url="https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=100",
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
        name="LG AI연구원",
        slug="lg-ai-research",
        base_url=(
            "https://www.lgresearch.ai/api/board/rcrt/list?pg=1&pgSz=100"
            "&schLangTp=KR&schExpsYn=Y&schJobtypeCd=&schGroupCd="
            "&schRlmCd=&schFld=career&schTxt="
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.lgresearch.ai",
        sector="ai_research",
        connector_family="lg_ai_research_public_api_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=6,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official LG AI Research public recruitment API; limited to "
            "visible AI Research and AI Engineering roles based in Seoul, "
            "excluding overseas openings and talent pools."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="LG유플러스",
        slug="lg-uplus",
        base_url=(
            "https://api.careers.lg.com/rmk/job/retrieveJobNoticesList"
            "#lg-uplus"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.lguplus.com",
        sector="telecommunications",
        connector_family="lg_careers_lguplus_tech",
        request_method="POST",
        request_body={
            "lnbSearch": "",
            "hashTagText": "",
            "recDate": "CREATION_DATE",
            "order": "DESC",
            "careerList": [],
            "companyCodeList": ["LGU"],
            "desireLocList": [],
            "jobGroupList": [],
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=5,
        expected_job_volume=2,
        connector_reuse_score=4,
        policy_risk=0,
        non_tech_noise=3,
        notes=(
            "Official LG Careers API filtered to LG Uplus; only explicit "
            "software, data, infrastructure, QA, and information-security "
            "roles are retained."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="SK하이닉스",
        slug="sk-hynix",
        base_url=(
            "https://www.skcareers.com/Recruit/GetRecruitList#sk-hynix"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.skhynix.com",
        sector="enterprise_it",
        connector_family="skcareers_hynix_tech",
        request_method="POST",
        request_body={
            "sort": "2",
            "searchText": "",
            "corpCode": "10004",
            "jobRole": "0",
            "recruitType": "",
            "workingType": "",
            "workingRegion": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official SK Careers JSON listing filtered to SK hynix with "
            "corpCode=10004; non-technical roles are excluded."
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
        name="티맵모빌리티",
        slug="tmap-mobility",
        base_url=(
            "https://www.skcareers.com/Recruit/GetRecruitList#tmap-mobility"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.tmapmobility.com",
        sector="mobility_platform",
        connector_family="enterprise_json",
        request_method="POST",
        request_body={
            "sort": "2",
            "searchText": "",
            "corpCode": "10084",
            "jobRole": "0",
            "recruitType": "",
            "workingType": "",
            "workingRegion": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=6,
        expected_job_volume=3,
        connector_reuse_score=4,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official SK Careers JSON listing filtered to Tmap Mobility "
            "with corpCode=10084; only technical roles are retained."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="SK실트론",
        slug="sk-siltron",
        base_url=(
            "https://www.skcareers.com/Recruit/GetRecruitList#sk-siltron"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.sksiltron.com",
        sector="semiconductor",
        connector_family="enterprise_json",
        request_method="POST",
        request_body={
            "sort": "2",
            "searchText": "",
            "corpCode": "10008",
            "jobRole": "0",
            "recruitType": "",
            "workingType": "",
            "workingRegion": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=2,
        connector_reuse_score=4,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official SK Careers JSON listing filtered to SK siltron with "
            "corpCode=10008; only technical roles are retained."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="SK시그넷",
        slug="sk-signet",
        base_url=(
            "https://www.skcareers.com/Recruit/GetRecruitList#sk-signet"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.sksignet.com",
        sector="ev_infrastructure",
        connector_family="enterprise_json",
        request_method="POST",
        request_body={
            "sort": "2",
            "searchText": "",
            "corpCode": "10042",
            "jobRole": "0",
            "recruitType": "",
            "workingType": "",
            "workingRegion": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=2,
        connector_reuse_score=4,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official SK Careers JSON listing filtered to SK signet with "
            "corpCode=10042; only technical roles are retained."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="SK인텔릭스",
        slug="sk-intellix",
        base_url=(
            "https://www.skcareers.com/Recruit/GetRecruitList#sk-intellix"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.skintellix.com",
        sector="ai_wellness_robotics",
        connector_family="skcareers_intellix_tech",
        request_method="POST",
        request_body={
            "sort": "2",
            "searchText": "",
            "corpCode": "10036",
            "jobRole": "0",
            "recruitType": "",
            "workingType": "",
            "workingRegion": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=2,
        connector_reuse_score=5,
        policy_risk=0,
        non_tech_noise=3,
        notes=(
            "Official SK Careers listing filtered to SK intellix with "
            "corpCode=10036; only its official IT job group and complete "
            "text detail pages are ingested."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="SK키파운드리",
        slug="sk-keyfoundry",
        base_url=(
            "https://www.skcareers.com/Recruit/GetRecruitList#sk-keyfoundry"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.skkeyfoundry.com",
        sector="semiconductor_ai",
        connector_family="skcareers_keyfoundry_tech",
        request_method="POST",
        request_body={
            "sort": "2",
            "searchText": "",
            "corpCode": "10164",
            "jobRole": "0",
            "recruitType": "",
            "workingType": "",
            "workingRegion": "",
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=3,
        connector_reuse_score=5,
        policy_risk=0,
        non_tech_noise=5,
        notes=(
            "Official SK Careers listing filtered to SK keyfoundry with "
            "corpCode=10164; only explicit DT and information-security "
            "roles with complete text detail pages are retained."
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
    SeedSource(
        name="넥슨",
        slug="nexon",
        base_url="https://careers.nexon.com/",
        source_type=SourceType.BROWSER_PUBLIC_RENDER,
        homepage_url="https://www.nexon.com",
        sector="game_content",
        connector_family="browser_public_render",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=1,
        policy_risk=1,
        non_tech_noise=3,
        notes=(
            "Official Nexon Careers page; direct HTTP preview returns a "
            "public anti-bot page, so keep as a browser-render candidate."
        ),
        status=SourceStatus.NEEDS_BROWSER,
    ),
    SeedSource(
        name="엔씨소프트",
        slug="ncsoft",
        base_url="https://careers.ncsoft.com/apply/list",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.ncsoft.com",
        sector="game_content",
        connector_family="ncsoft_session_html_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official NC Careers session-backed public list and detail "
            "endpoints; limited to programming, SRE, AI R&D, and QA roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="넷마블",
        slug="netmarble",
        base_url="https://career.netmarble.com/announce",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://company.netmarble.com",
        sector="game_content",
        connector_family="netmarble_public_api_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Netmarble careers public list and detail APIs; limited "
            "to game programming and technology/AI job groups."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="크래프톤",
        slug="krafton",
        base_url="https://boards-api.greenhouse.io/v1/boards/krafton/jobs?content=true",
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.krafton.com",
        sector="game_content",
        connector_family="lever_greenhouse",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=5,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=3,
        notes="Official KRAFTON Greenhouse jobs API.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="스마일게이트",
        slug="smilegate",
        base_url="https://careers.smilegate.com/api/apply/announce/guest",
        source_type=SourceType.ENTERPRISE_JSON,
        homepage_url="https://www.smilegate.com",
        sector="game_content",
        connector_family="smilegate_api",
        request_method="POST",
        request_body={
            "careerTypeCd": [],
            "companyCd": [],
            "gameGenreCd": [],
            "hireTypeCd": [],
            "jobDtlCd": [],
            "jobMainCd": [],
            "keyword": None,
            "pageIndex": 1,
            "pageSize": 150,
            "projectSeq": None,
            "usreId": None,
        },
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=4,
        expected_job_volume=4,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=3,
        notes="Official Smilegate Careers announcement JSON API.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="펄어비스",
        slug="pearl-abyss",
        base_url="https://www.pearlabyss.com/ko-KR/Company/Careers/List",
        source_type=SourceType.HTML_LISTING_DETAIL,
        homepage_url="https://www.pearlabyss.com",
        sector="game_content",
        connector_family="html_listing_detail",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=4,
        expected_job_volume=3,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=2,
        notes="Official Pearl Abyss careers HTML listing.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="네오위즈",
        slug="neowiz",
        base_url="https://api.lever.co/v0/postings/neowiz?mode=json",
        source_type=SourceType.LEVER_GREENHOUSE,
        homepage_url="https://www.neowiz.com",
        sector="game_content",
        connector_family="lever_greenhouse",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=3,
        tech_job_priority=4,
        expected_job_volume=3,
        connector_reuse_score=3,
        policy_risk=0,
        non_tech_noise=3,
        notes="Official NEOWIZ Lever postings API.",
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="카카오게임즈",
        slug="kakao-games",
        base_url="https://recruit.kakaogames.com/ko",
        source_type=SourceType.GREETING,
        homepage_url="https://www.kakaogamescorp.com",
        sector="game_content",
        connector_family="greeting",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=4,
        expected_job_volume=2,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official Kakao Games Greeting-powered custom careers page; "
            "listing redirects to /ko/homekr while detail pages resolve at "
            "/ko/o/{openingId}."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="위메이드",
        slug="wemade",
        base_url="https://recruit.wemade.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.wemade.com",
        sector="game_content",
        connector_family="ninehire_public_api_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=2,
        connector_reuse_score=5,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official Wemade recruitment site and its public Ninehire feed; "
            "limited to active technical roles with verified detail pages."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="컴투스",
        slug="com2us",
        base_url="https://com2us.recruiter.co.kr/career/career",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.com2us.com",
        sector="game_content",
        connector_family="com2us_jobflex_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=4,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Com2uS Jobflex list and detail APIs; limited to "
            "programming, data, AI, DB, security, infrastructure, and QA."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="데브시스터즈",
        slug="devsisters",
        base_url="https://careers.devsisters.com/ko/home",
        source_type=SourceType.GREETING,
        homepage_url="https://www.devsisters.com",
        sector="game_content",
        connector_family="greeting_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=3,
        tech_job_priority=4,
        expected_job_volume=2,
        connector_reuse_score=5,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official Devsisters Greeting-powered careers listing and detail "
            "pages; monitored through periods with no open technical roles."
        ),
        status=SourceStatus.ALLOWED,
    ),
    SeedSource(
        name="시프트업",
        slug="shiftup",
        base_url="https://shiftup.co.kr/recruit/recruit.php",
        source_type=SourceType.HTML_LISTING_DETAIL,
        homepage_url="https://shiftup.co.kr",
        sector="game_content",
        connector_family="shiftup_public_api_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=5,
        expected_job_volume=5,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        request_method="POST",
        request_body={
            "workType": "get_recruit_list",
            "code": "recruit",
            "cat_idx": "0",
            "searchkey": "",
        },
        notes=(
            "Official Shift Up recruit page and its public listing endpoint; "
            "limited to open Programmer and QA roles with full descriptions."
        ),
        status=SourceStatus.ALLOWED,
    ),
)

INITIAL_GREETING_SOURCES = tuple(
    item
    for item in INITIAL_SOURCE_CATALOG
    if item.source_type == SourceType.GREETING
)


SOURCE_URL_MIGRATIONS = {
    (
        "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko"
        "&firstIndex=0&recordCountPerPage=500&sysCompanyCdArr=KR"
    ): (
        "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko"
        "&firstIndex=0&recordCountPerPage=500",
        "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
    ),
    "https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=100": (
        "https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=20",
    ),
    "https://api.ashbyhq.com/posting-api/job-board/furiosa-ai": (
        "https://furiosa.ai/sitemap.xml",
    ),
    "https://www.skcareers.com/Recruit/GetRecruitList#sk-hynix": (
        "https://talent.skhynix.com/hub/en/apply/job",
    ),
}


RETIRED_SOURCE_URLS = {
    "https://talent.skhynix.com/hub/ko/apply/job",
}


def _apply_source_metadata(source: CareerSource, item: SeedSource) -> None:
    reverify_dunamu_transport = (
        item.slug == "dunamu"
        and item.connector_family == "dunamu_official_api_proxy_tech"
        and source.connector_family == "dunamu_server_html_tech"
        and source.status == SourceStatus.BLOCKED
        and source.policy_status == PolicyStatus.BLOCKED
        and source.last_error_code == "blocked"
        and source.last_success_at is None
    )
    source.source_type = item.source_type
    source.request_method = item.request_method
    source.request_body = item.request_body
    if reverify_dunamu_transport:
        source.status = item.status
        source.policy_status = item.policy_status
        source.last_error_code = None
        source.last_error_reason = None
    elif source.status not in {SourceStatus.BLOCKED, SourceStatus.STOPPED}:
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


def _migrate_source_url(
    session: Session,
    item: SeedSource,
) -> CareerSource | None:
    legacy_urls = SOURCE_URL_MIGRATIONS.get(item.base_url, ())
    if not legacy_urls:
        return None

    legacy_source = session.scalar(
        select(CareerSource).where(CareerSource.base_url.in_(legacy_urls))
    )
    if legacy_source is None:
        return None

    current_source = session.scalar(
        select(CareerSource).where(CareerSource.base_url == item.base_url)
    )
    if current_source is not None and current_source.id != legacy_source.id:
        has_postings = session.scalar(
            select(JobPosting.id)
            .where(JobPosting.source_id == current_source.id)
            .limit(1)
        )
        has_snapshots = session.scalar(
            select(RawSnapshot.id)
            .where(RawSnapshot.source_id == current_source.id)
            .limit(1)
        )
        if has_postings is not None or has_snapshots is not None:
            raise ValueError(
                "cannot replace a duplicate career source that already has data"
            )
        session.delete(current_source)
        session.flush()

    legacy_source.base_url = item.base_url
    if item.slug == "naver":
        # The legacy group-wide feed attributed affiliate and non-technical
        # openings to NAVER. Close those rows once while the scoped source is
        # introduced; the following crawl reopens only verified NAVER Tech
        # openings and the affiliate sources ingest their own jobs.
        for posting in session.scalars(
            select(JobPosting).where(JobPosting.source_id == legacy_source.id)
        ):
            posting.status = PostingStatus.CLOSED
            posting.missing_runs = 3
    return legacy_source


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

        source = _migrate_source_url(session, item)
        if source is None:
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

    retired_sources = session.scalars(
        select(CareerSource).where(
            CareerSource.base_url.in_(RETIRED_SOURCE_URLS)
        )
    ).all()
    for source in retired_sources:
        source.status = SourceStatus.STOPPED
        source.policy_status = PolicyStatus.STOPPED
        source.last_error_code = None
        source.last_error_reason = None
        for posting in session.scalars(
            select(JobPosting).where(JobPosting.source_id == source.id)
        ):
            posting.status = PostingStatus.CLOSED

    session.commit()
    return created
