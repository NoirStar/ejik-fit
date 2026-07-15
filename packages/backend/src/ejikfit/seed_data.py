from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ejikfit.models import (
    CareerSource,
    Company,
    JobPosting,
    PolicyStatus,
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
        base_url="https://www.dunamu.com/careers/jobs",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        homepage_url="https://www.dunamu.com",
        sector="fintech",
        connector_family="dunamu_server_html_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=2,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official Dunamu current-jobs list and server-rendered detail "
            "pages; limited to explicit engineering and security roles."
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
        base_url="https://furiosa.ai/sitemap.xml",
        source_type=SourceType.SITEMAP_DISCOVERY,
        homepage_url="https://furiosa.ai",
        sector="ai_semiconductor",
        connector_family="furiosa_webflow_korea_tech",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=6,
        expected_job_volume=6,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=0,
        notes=(
            "Official FuriosaAI sitemap and Webflow careers detail pages; "
            "limited to Korea-based technical roles."
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
        name="SK하이닉스",
        slug="sk-hynix",
        base_url="https://talent.skhynix.com/hub/en/apply/job",
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
            "Official SK hynix Talent Hub jobs page; the current English-path "
            "endpoint responds with the Korean-localized server-rendered listing."
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
        source_type=SourceType.STATIC_NEXT_DATA,
        homepage_url="https://www.wemade.com",
        sector="game_content",
        connector_family="ninehire_next_data",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=4,
        tech_job_priority=4,
        expected_job_volume=2,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official Wemade recruitment site embeds Ninehire job links in "
            "Next data; needs a Ninehire-aware parser."
        ),
        status=SourceStatus.NEEDS_CONNECTOR,
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
        source_type=SourceType.STATIC_NEXT_DATA,
        homepage_url="https://www.devsisters.com",
        sector="game_content",
        connector_family="greeting_embedded_next_data",
        policy_status=PolicyStatus.ALLOWED,
        brand_tier_weight=3,
        tech_job_priority=4,
        expected_job_volume=2,
        connector_reuse_score=2,
        policy_risk=0,
        non_tech_noise=2,
        notes=(
            "Official Devsisters Greeting-powered custom careers page; "
            "currently exposes no open postings, so detail mapping is pending."
        ),
        status=SourceStatus.NEEDS_CONNECTOR,
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
    "https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=100": (
        "https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=20",
    ),
}


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

    session.commit()
    return created
