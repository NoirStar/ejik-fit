from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit import seed_data
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PolicyStatus,
    SourceStatus,
    SourceType,
)


def test_initial_sources_include_existing_greeting_pages_and_official_json_sources() -> None:
    greeting_slugs = {item.slug for item in seed_data.INITIAL_GREETING_SOURCES}
    catalog_by_slug = {item.slug: item for item in seed_data.INITIAL_SOURCE_CATALOG}

    assert {
        "kakaopay",
        "kakaomobility",
        "hyundai-autoever",
        "nextsecurities",
        "s2w",
        "makinarocks",
        "rebellions",
        "korbit",
        "lambda256",
        "upstage",
        "nota-ai",
        "portone",
        "carat-ai",
        "wrtn",
        "myrealtrip",
        "wadiz",
        "gccompany",
        "scatterlab",
        "finda",
        "deepnoid",
        "enerzai",
    } <= greeting_slugs
    assert len(seed_data.INITIAL_GREETING_SOURCES) == 36
    assert all(
        item.source_type == SourceType.GREETING
        for item in seed_data.INITIAL_GREETING_SOURCES
    )

    assert catalog_by_slug["naver"].source_type == SourceType.NAVER_JSON
    assert catalog_by_slug["kakao"].source_type == SourceType.KAKAO_JSON
    assert catalog_by_slug["line-plus"].source_type == SourceType.LINE_GATSBY
    assert len({item.slug for item in seed_data.INITIAL_SOURCE_CATALOG}) == len(
        seed_data.INITIAL_SOURCE_CATALOG
    )
    assert len({item.base_url for item in seed_data.INITIAL_SOURCE_CATALOG}) == len(
        seed_data.INITIAL_SOURCE_CATALOG
    )
    assert all(
        item.base_url.startswith("https://")
        for item in seed_data.INITIAL_SOURCE_CATALOG
    )


def test_initial_sources_include_phase_two_enterprise_sources_with_lg_api_enabled() -> None:
    enterprise_slugs = {
        "samsung-electronics",
        "samsung-sds",
        "hyundai-motor",
        "kia",
        "lg-electronics",
        "lg-cns",
        "sk-hynix",
        "sk-telecom",
        "kt",
        "posco-dx",
        "cj-olivenetworks",
        "hanwha-systems",
    }
    catalog_by_slug = {item.slug: item for item in seed_data.INITIAL_SOURCE_CATALOG}

    assert enterprise_slugs <= set(catalog_by_slug)
    assert len(seed_data.INITIAL_SOURCE_CATALOG) >= 30
    blocked_enterprise_slugs: set[str] = set()
    non_runnable_enterprise_slugs = enterprise_slugs - {
        "lg-cns",
        "lg-electronics",
        "sk-hynix",
        "posco-dx",
        "sk-telecom",
        "kt",
        "hyundai-motor",
        "kia",
        "cj-olivenetworks",
        "hanwha-systems",
        "samsung-sds",
        "samsung-electronics",
        *blocked_enterprise_slugs,
    }
    assert all(
        catalog_by_slug[slug].status
        in {SourceStatus.NEEDS_CONNECTOR, SourceStatus.NEEDS_BROWSER}
        for slug in non_runnable_enterprise_slugs
    )
    assert all(
        catalog_by_slug[slug].policy_status == PolicyStatus.ALLOWED
        for slug in enterprise_slugs - blocked_enterprise_slugs
    )
    assert catalog_by_slug["lg-electronics"].source_type == (
        SourceType.ENTERPRISE_JSON
    )
    assert catalog_by_slug["lg-electronics"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["lg-cns"].source_type == SourceType.ENTERPRISE_JSON
    assert catalog_by_slug["lg-cns"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["posco-dx"].source_type == SourceType.ENTERPRISE_JSON
    assert catalog_by_slug["posco-dx"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["sk-telecom"].source_type == SourceType.ENTERPRISE_JSON
    assert catalog_by_slug["sk-telecom"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["kt"].source_type == SourceType.ENTERPRISE_JSON
    assert catalog_by_slug["kt"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["sk-hynix"].source_type == (
        SourceType.HTML_LISTING_DETAIL
    )
    assert catalog_by_slug["sk-hynix"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["samsung-electronics"].source_type == (
        SourceType.HTML_LISTING_DETAIL
    )
    assert catalog_by_slug["samsung-electronics"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["samsung-electronics"].policy_status == (
        PolicyStatus.ALLOWED
    )
    assert catalog_by_slug["samsung-sds"].source_type == (
        SourceType.HTML_LISTING_DETAIL
    )
    assert catalog_by_slug["samsung-sds"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["hyundai-motor"].source_type == SourceType.ENTERPRISE_JSON
    assert catalog_by_slug["hyundai-motor"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["kia"].source_type == SourceType.BROWSER_PUBLIC_RENDER
    assert catalog_by_slug["kia"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["cj-olivenetworks"].source_type == (
        SourceType.ENTERPRISE_JSON
    )
    assert catalog_by_slug["cj-olivenetworks"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["hanwha-systems"].source_type == (
        SourceType.ENTERPRISE_JSON
    )
    assert catalog_by_slug["hanwha-systems"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["lg-cns"].connector_family == "enterprise_json"


def test_initial_sources_include_phase_three_game_content_sources() -> None:
    game_content_slugs = {
        "nexon",
        "ncsoft",
        "netmarble",
        "krafton",
        "smilegate",
        "pearl-abyss",
        "neowiz",
        "kakao-games",
        "wemade",
        "com2us",
        "devsisters",
        "shiftup",
    }
    catalog_by_slug = {item.slug: item for item in seed_data.INITIAL_SOURCE_CATALOG}

    assert game_content_slugs <= set(catalog_by_slug)
    assert len(seed_data.INITIAL_SOURCE_CATALOG) == 74
    assert all(
        catalog_by_slug[slug].sector == "game_content"
        for slug in game_content_slugs
    )
    assert all(
        catalog_by_slug[slug].policy_status == PolicyStatus.ALLOWED
        for slug in game_content_slugs
    )

    runnable_slugs = {
        "krafton",
        "neowiz",
        "pearl-abyss",
        "smilegate",
        "kakao-games",
        "shiftup",
    }
    assert all(
        catalog_by_slug[slug].status
        in {SourceStatus.NEEDS_BROWSER, SourceStatus.NEEDS_CONNECTOR}
        for slug in game_content_slugs - runnable_slugs
    )

    assert catalog_by_slug["krafton"].source_type == SourceType.LEVER_GREENHOUSE
    assert catalog_by_slug["krafton"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["krafton"].connector_family == "lever_greenhouse"
    assert catalog_by_slug["krafton"].base_url == (
        "https://boards-api.greenhouse.io/v1/boards/krafton/jobs?content=true"
    )

    assert catalog_by_slug["neowiz"].source_type == SourceType.LEVER_GREENHOUSE
    assert catalog_by_slug["neowiz"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["neowiz"].base_url == (
        "https://api.lever.co/v0/postings/neowiz?mode=json"
    )

    assert catalog_by_slug["pearl-abyss"].source_type == (
        SourceType.HTML_LISTING_DETAIL
    )
    assert catalog_by_slug["pearl-abyss"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["pearl-abyss"].base_url == (
        "https://www.pearlabyss.com/ko-KR/Company/Careers/List"
    )

    assert catalog_by_slug["smilegate"].source_type == SourceType.ENTERPRISE_JSON
    assert catalog_by_slug["smilegate"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["smilegate"].base_url == (
        "https://careers.smilegate.com/api/apply/announce/guest"
    )
    assert catalog_by_slug["smilegate"].request_method == "POST"
    assert catalog_by_slug["smilegate"].request_body == {
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
    }

    assert catalog_by_slug["kakao-games"].source_type == SourceType.GREETING
    assert catalog_by_slug["kakao-games"].status == SourceStatus.ALLOWED
    assert catalog_by_slug["kakao-games"].base_url == (
        "https://recruit.kakaogames.com/ko"
    )
    assert catalog_by_slug["kakao-games"].connector_family == "greeting"

    assert catalog_by_slug["nexon"].source_type == SourceType.BROWSER_PUBLIC_RENDER
    assert catalog_by_slug["nexon"].status == SourceStatus.NEEDS_BROWSER

    shiftup = catalog_by_slug["shiftup"]
    assert shiftup.source_type == SourceType.HTML_LISTING_DETAIL
    assert shiftup.connector_family == "shiftup_public_api_tech"
    assert shiftup.request_method == "POST"
    assert shiftup.request_body == {
        "workType": "get_recruit_list",
        "code": "recruit",
        "cat_idx": "0",
        "searchkey": "",
    }
    assert shiftup.status == SourceStatus.ALLOWED


def test_initial_sources_include_verified_fintech_and_ai_greeting_sources() -> None:
    verified_sources = {
        "makinarocks": "https://makinarocks.career.greetinghr.com/ko",
        "rebellions": "https://rebellions.career.greetinghr.com/ko",
        "korbit": "https://korbit.career.greetinghr.com/ko",
        "lambda256": "https://lambda256.career.greetinghr.com/ko",
        "upstage": "https://careers.upstage.ai/ko",
        "nota-ai": "https://career.nota.ai/ko",
        "portone": "https://portone.career.greetinghr.com/ko",
        "carat-ai": "https://carat.career.greetinghr.com/ko",
        "wrtn": "https://wrtn.career.greetinghr.com/ko",
    }
    catalog_by_slug = {item.slug: item for item in seed_data.INITIAL_SOURCE_CATALOG}

    assert len(seed_data.INITIAL_SOURCE_CATALOG) == 74
    assert verified_sources.keys() <= catalog_by_slug.keys()
    assert all(
        catalog_by_slug[slug].base_url == url
        for slug, url in verified_sources.items()
    )
    assert all(
        catalog_by_slug[slug].source_type == SourceType.GREETING
        and catalog_by_slug[slug].status == SourceStatus.ALLOWED
        and catalog_by_slug[slug].policy_status == PolicyStatus.ALLOWED
        for slug in verified_sources
    )


def test_initial_sources_include_verified_high_volume_platform_sources() -> None:
    catalog_by_slug = {item.slug: item for item in seed_data.INITIAL_SOURCE_CATALOG}

    assert catalog_by_slug["toss"].base_url == (
        "https://api-public.toss.im/api/v3/ipd-eggnog/career/job-groups"
    )
    assert catalog_by_slug["toss"].source_type == SourceType.ENTERPRISE_JSON
    assert catalog_by_slug["toss"].status == SourceStatus.ALLOWED

    assert catalog_by_slug["musinsa"].base_url == (
        "https://www.musinsacareers.com/ko"
    )
    assert catalog_by_slug["musinsa"].source_type == SourceType.GREETING
    assert catalog_by_slug["musinsa"].connector_family == "greeting_tech"
    assert catalog_by_slug["musinsa"].status == SourceStatus.ALLOWED

    assert catalog_by_slug["daangn"].base_url == (
        "https://careers.daangn.com/sitemap-0.xml"
    )
    assert catalog_by_slug["daangn"].source_type == SourceType.SITEMAP_DISCOVERY
    assert catalog_by_slug["daangn"].connector_family == "sitemap_jsonld_tech"
    assert catalog_by_slug["daangn"].status == SourceStatus.ALLOWED

    for slug, board in {
        "coupang": "coupang",
        "moloco": "moloco",
        "sendbird": "sendbird",
    }.items():
        source = catalog_by_slug[slug]
        assert source.base_url == (
            "https://boards-api.greenhouse.io/v1/boards/"
            f"{board}/jobs?content=true"
        )
        assert source.source_type == SourceType.LEVER_GREENHOUSE
        assert source.connector_family == "lever_greenhouse_korea_tech"
        assert source.status == SourceStatus.ALLOWED

    woowahan = catalog_by_slug["woowahan-brothers"]
    assert woowahan.source_type == SourceType.PUBLIC_JSON_DETAIL
    assert woowahan.connector_family == "woowahan_public_api_tech"
    assert woowahan.status == SourceStatus.ALLOWED
    assert woowahan.base_url == (
        "https://career.woowahan.com/w1/recruits?page=0&size=100"
        "&sort=updateDate,desc&recruitCampaignSeq=0"
    )

    kakaobank = catalog_by_slug["kakaobank"]
    assert kakaobank.source_type == SourceType.PUBLIC_JSON_DETAIL
    assert kakaobank.connector_family == "kakaobank_public_api_tech"
    assert kakaobank.status == SourceStatus.ALLOWED
    assert kakaobank.request_method == "POST"
    assert kakaobank.request_body == {
        "pageNumber": 1,
        "pageSize": 100,
        "receiptFilterType": "ONGOING",
    }

    socar = catalog_by_slug["socar"]
    assert socar.base_url == "https://www.socarcorp.kr/careers/jobs"
    assert socar.source_type == SourceType.GREETING
    assert socar.connector_family == "corporate_greeting_links_tech"
    assert socar.status == SourceStatus.ALLOWED

    bucketplace = catalog_by_slug["bucketplace"]
    assert bucketplace.base_url == "https://www.bucketplace.com/careers/"
    assert bucketplace.source_type == SourceType.GREETING
    assert bucketplace.connector_family == "grouped_greeting_links_tech"
    assert bucketplace.status == SourceStatus.ALLOWED

    dunamu = catalog_by_slug["dunamu"]
    assert dunamu.base_url == "https://www.dunamu.com/careers/jobs"
    assert dunamu.source_type == SourceType.PUBLIC_JSON_DETAIL
    assert dunamu.connector_family == "dunamu_server_html_tech"
    assert dunamu.status == SourceStatus.ALLOWED

    kurly = catalog_by_slug["kurly"]
    assert kurly.base_url == "https://kurly.career.greetinghr.com/ko"
    assert kurly.source_type == SourceType.GREETING
    assert kurly.connector_family == "greeting_tech"
    assert kurly.status == SourceStatus.ALLOWED

    hyperconnect = catalog_by_slug["hyperconnect"]
    assert hyperconnect.base_url == (
        "https://api.lever.co/v0/postings/matchgroup?mode=json"
    )
    assert hyperconnect.source_type == SourceType.LEVER_GREENHOUSE
    assert hyperconnect.connector_family == "lever_greenhouse_korea_tech"
    assert hyperconnect.status == SourceStatus.ALLOWED

    for slug, base_url in {
        "myrealtrip": "https://myrealtrip.career.greetinghr.com/ko",
        "wadiz": "https://job.wadiz.kr/ko",
        "gccompany": "https://gccompany.career.greetinghr.com/ko",
        "scatterlab": "https://www.scatterlab.co.kr/ko",
    }.items():
        source = catalog_by_slug[slug]
        assert source.base_url == base_url
        assert source.source_type == SourceType.GREETING
        assert source.connector_family == "greeting_tech"
        assert source.status == SourceStatus.ALLOWED

    channel = catalog_by_slug["channel-corporation"]
    assert channel.base_url == "https://channel.io/kr/careers"
    assert channel.source_type == SourceType.STATIC_NEXT_DATA
    assert channel.connector_family == "channel_next_data_tech"
    assert channel.status == SourceStatus.ALLOWED

    for slug, base_url in {
        "finda": "https://finda.career.greetinghr.com/ko/career",
        "deepnoid": "https://deepnoid.career.greetinghr.com/ko/intro",
        "enerzai": "https://enerzai.career.greetinghr.com/ko/home",
    }.items():
        source = catalog_by_slug[slug]
        assert source.base_url == base_url
        assert source.source_type == SourceType.GREETING
        assert source.connector_family == "greeting_tech"
        assert source.status == SourceStatus.ALLOWED

    furiosa = catalog_by_slug["furiosa-ai"]
    assert furiosa.base_url == "https://furiosa.ai/sitemap.xml"
    assert furiosa.source_type == SourceType.SITEMAP_DISCOVERY
    assert furiosa.connector_family == "furiosa_webflow_korea_tech"
    assert furiosa.status == SourceStatus.ALLOWED

    ably = catalog_by_slug["ably"]
    assert ably.base_url == "https://ably.team/recruit"
    assert ably.source_type == SourceType.PUBLIC_JSON_DETAIL
    assert ably.connector_family == "ably_next_ninehire_tech"
    assert ably.status == SourceStatus.ALLOWED


def test_seeding_sources_is_idempotent_and_persists_catalog_source_types() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        assert seed_data.seed_sources(session) == len(seed_data.INITIAL_SOURCE_CATALOG)
        assert seed_data.seed_sources(session) == 0
        assert len(session.scalars(select(Company)).all()) == len(
            seed_data.INITIAL_SOURCE_CATALOG
        )

        sources = session.scalars(select(CareerSource)).all()
        assert len(sources) == len(seed_data.INITIAL_SOURCE_CATALOG)
        actual_types = {source.company.slug: source.source_type for source in sources}
        assert actual_types["naver"] == SourceType.NAVER_JSON
        assert actual_types["kakao"] == SourceType.KAKAO_JSON
        assert actual_types["line-plus"] == SourceType.LINE_GATSBY

        sources_by_slug = {source.company.slug: source for source in sources}
        naver = sources_by_slug["naver"]
        assert naver.connector_family == "naver_json"
        assert naver.policy_status == PolicyStatus.ALLOWED
        assert naver.sector == "platform"
        assert naver.brand_tier_weight == 6
        assert naver.tech_job_priority == 5
        assert naver.expected_job_volume == 5
        assert naver.priority_score > sources_by_slug["deepauto-ai"].priority_score

        samsung = sources_by_slug["samsung-electronics"]
        assert samsung.status == SourceStatus.ALLOWED
        assert samsung.policy_status == PolicyStatus.ALLOWED
        assert samsung.connector_family == "html_listing_detail"
        assert samsung.sector == "enterprise_it"
        assert samsung.base_url == (
            "https://www.samsungcareers.com/hr/list.data#samsung-electronics"
        )
        assert samsung.request_method == "POST"
        assert samsung.request_body == {
            "currentPageNo": "1",
            "intNo": "0",
            "strVal": "",
            "strTxt": "",
            "strKey": "",
            "strCompany": ["C10CAA", "C10", "C10CAH", "C10"],
            "strType": "",
            "strOrderBy": "",
            "strEntity": "",
        }

        samsung_sds = sources_by_slug["samsung-sds"]
        assert samsung_sds.status == SourceStatus.ALLOWED
        assert samsung_sds.connector_family == "html_listing_detail"
        assert samsung_sds.base_url == (
            "https://www.samsungcareers.com/hr/list.data#samsung-sds"
        )
        assert samsung_sds.request_method == "POST"
        assert samsung_sds.request_body == {
            "currentPageNo": "1",
            "intNo": "0",
            "strVal": "",
            "strTxt": "",
            "strKey": "",
            "strCompany": "C60",
            "strType": "",
            "strOrderBy": "",
            "strEntity": "",
        }

        lg_electronics = sources_by_slug["lg-electronics"]
        assert lg_electronics.status == SourceStatus.ALLOWED
        assert lg_electronics.connector_family == "enterprise_json"
        assert lg_electronics.base_url == (
            "https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=100"
        )

        lg_cns = sources_by_slug["lg-cns"]
        assert lg_cns.status == SourceStatus.ALLOWED
        assert lg_cns.connector_family == "enterprise_json"
        assert lg_cns.base_url == (
            "https://api.careers.lg.com/rmk/job/retrieveJobNoticesList"
        )
        assert lg_cns.request_method == "POST"
        assert lg_cns.request_body == {
            "lnbSearch": "",
            "hashTagText": "",
            "recDate": "CREATION_DATE",
            "order": "DESC",
            "careerList": [],
            "companyCodeList": ["CNS"],
            "desireLocList": [],
            "jobGroupList": [],
        }

        sk_hynix = sources_by_slug["sk-hynix"]
        assert sk_hynix.status == SourceStatus.ALLOWED
        assert sk_hynix.connector_family == "html_listing_detail"
        assert sk_hynix.base_url == "https://talent.skhynix.com/hub/en/apply/job"

        posco_dx = sources_by_slug["posco-dx"]
        assert posco_dx.status == SourceStatus.ALLOWED
        assert posco_dx.connector_family == "enterprise_json"
        assert posco_dx.base_url == (
            "https://recruit.posco.com/h22a01-recruit/H22A1000/list"
            "?rowCount=20&pageSize=10&currPage=1&offset=0&SEARCH_TYPE="
            "&SEARCH_ORDER=s1&SEARCH_KEYWORD=&SEARCH_COMP=01&SEARCH_VALUE="
        )

        sk_telecom = sources_by_slug["sk-telecom"]
        assert sk_telecom.status == SourceStatus.ALLOWED
        assert sk_telecom.connector_family == "enterprise_json"
        assert sk_telecom.base_url == (
            "https://www.skcareers.com/Recruit/GetRecruitList"
        )
        assert sk_telecom.request_method == "POST"
        assert sk_telecom.request_body == {
            "sort": "2",
            "searchText": "",
            "corpCode": "10005",
            "jobRole": "0",
            "recruitType": "",
            "workingType": "",
            "workingRegion": "",
        }

        kt = sources_by_slug["kt"]
        assert kt.status == SourceStatus.ALLOWED
        assert kt.connector_family == "enterprise_json"
        assert kt.base_url == (
            "https://recruit.kt.com/api/recruit?isPost=1&isInprogress=1"
            "&isContainsContents=0"
        )

        hyundai = sources_by_slug["hyundai-motor"]
        assert hyundai.status == SourceStatus.ALLOWED
        assert hyundai.connector_family == "enterprise_json"
        assert hyundai.base_url == (
            "https://talent.hyundai.com/api/rec/AP-HM-FO-02700?hgrCd=1"
            "&lang=en&page=1&pageblock=100&searchFieldList=&searchOccupList="
            "&searchPlaceList=&searchSectorList=&searchText=&jdSec=&srcOrd="
        )

        kia = sources_by_slug["kia"]
        assert kia.status == SourceStatus.ALLOWED
        assert kia.connector_family == "browser_public_render"
        assert kia.base_url == "https://career.kia.com/apply/applyList.kc"

        cj = sources_by_slug["cj-olivenetworks"]
        assert cj.status == SourceStatus.ALLOWED
        assert cj.connector_family == "enterprise_json"
        assert cj.base_url == (
            "https://recruit.cj.net/recruit/ko/common/common/jobListInfo.fo"
            "?COMPANY=E10&BUSINESS_UNIT=E10BU&ZZ_TARGET_1=Z&ROWNO=100"
            "&PAGENO=1&TOTAL_COUNT=1&ZZ_TITLE=&callback=list"
        )

        hanwha = sources_by_slug["hanwha-systems"]
        assert hanwha.status == SourceStatus.ALLOWED
        assert hanwha.connector_family == "enterprise_json"
        assert hanwha.base_url == (
            "https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/"
            "search-rcrt"
        )
        assert hanwha.request_method == "POST"
        assert hanwha.request_body == {
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
        }


def test_seeding_migrates_lg_source_url_without_losing_existing_postings() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="LG전자", slug="lg-electronics")
        legacy_source = CareerSource(
            company=company,
            base_url=(
                "https://globalcareers.lge.com/api/job/v1/jobs/"
                "?page=1&size=20"
            ),
            source_type=SourceType.ENTERPRISE_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        duplicate_source = CareerSource(
            company=company,
            base_url=(
                "https://globalcareers.lge.com/api/job/v1/jobs/"
                "?page=1&size=100"
            ),
            source_type=SourceType.ENTERPRISE_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=legacy_source,
            external_id="existing-lge-job",
            url="https://globalcareers.lge.com/jobs/existing-lge-job",
            title="Existing LG Engineer",
        )
        session.add_all([legacy_source, duplicate_source, posting])
        session.commit()
        legacy_source_id = legacy_source.id

        seed_data.seed_sources(session)

        lg_sources = session.scalars(
            select(CareerSource)
            .join(Company)
            .where(Company.slug == "lg-electronics")
        ).all()
        assert len(lg_sources) == 1
        assert lg_sources[0].id == legacy_source_id
        assert lg_sources[0].base_url.endswith("?page=1&size=100")
        assert posting.source_id == legacy_source_id


def test_seeding_sources_does_not_clear_blocked_policy_state() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        seed_data.seed_sources(session)
        source = session.scalar(
            select(CareerSource).join(Company).where(Company.slug == "naver")
        )
        assert source is not None
        source.status = SourceStatus.BLOCKED
        source.policy_status = PolicyStatus.BLOCKED
        source.last_error_code = "blocked"
        session.commit()

        assert seed_data.seed_sources(session) == 0

        assert source.status == SourceStatus.BLOCKED
        assert source.policy_status == PolicyStatus.BLOCKED
        assert source.last_error_code == "blocked"


def test_seeding_sources_does_not_clear_stopped_source_status() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        seed_data.seed_sources(session)
        source = session.scalar(
            select(CareerSource).join(Company).where(Company.slug == "hyundai-motor")
        )
        assert source is not None
        source.status = SourceStatus.STOPPED
        source.policy_status = PolicyStatus.STOPPED
        session.commit()

        assert seed_data.seed_sources(session) == 0

        assert source.status == SourceStatus.STOPPED
        assert source.policy_status == PolicyStatus.STOPPED
