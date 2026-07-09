import json

from ejikfit.connectors.enterprise_json import parse_enterprise_json_openings


def test_parse_enterprise_json_openings_maps_public_job_objects() -> None:
    payload = {
        "data": {
            "recruitments": [
                {
                    "postingId": "ENT-100",
                    "postingTitle": "AI Platform Engineer",
                    "jobDetailUrl": "/jobs/ENT-100",
                    "workLocations": ["서울", "판교"],
                    "employmentType": "정규직",
                    "requiredExperience": "신입/경력",
                    "department": "AI Platform",
                    "skills": [{"name": "Python"}, {"name": "Kubernetes"}],
                    "datePosted": "2026-07-09T09:00:00+09:00",
                    "validThrough": "2026-08-09",
                    "public": True,
                },
                {
                    "postingId": "ENT-private",
                    "postingTitle": "Private Engineer",
                    "jobDetailUrl": "/jobs/ENT-private",
                    "public": False,
                },
                {
                    "postingId": "ENT-closed",
                    "postingTitle": "Closed Engineer",
                    "jobDetailUrl": "/jobs/ENT-closed",
                    "status": "closed",
                },
            ]
        }
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://careers.example.com/api/jobs",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "ENT-100"
    assert opening.url == "https://careers.example.com/jobs/ENT-100"
    assert opening.title == "AI Platform Engineer"
    assert opening.status == "open"
    assert opening.employment_type == "정규직"
    assert opening.career_type == "mixed"
    assert opening.location == "서울, 판교"
    assert opening.description_text == "AI Platform Python Kubernetes"
    assert opening.opens_at is not None
    assert opening.closes_at is not None


def test_parse_enterprise_json_openings_maps_lg_electronics_jobs_api() -> None:
    payload = {
        "successOrNot": "Y",
        "statusCode": "SUCCESS",
        "data": {
            "total": 2,
            "list": [
                {
                    "id": "5309557008",
                    "title": "Data Platform Engineer",
                    "content": "<p>Build Python and SQL data services.</p>",
                    "corpCd": "LGEKR",
                    "corpType": "R&D",
                    "cntryCd": "KR",
                    "cntryNm": "South Korea",
                    "jobFamily": "EN",
                    "location": "Seoul",
                    "empType": "Full-Time",
                    "status": "OPEN",
                    "active": True,
                    "live": True,
                    "postCreateDtm": [2026, 7, 8, 13, 8, 5],
                },
                {
                    "id": "2920",
                    "title": "Inactive Sales Manager",
                    "location": "Riyadh",
                    "status": "OPEN",
                    "active": False,
                    "live": False,
                },
            ],
        },
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=20",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "5309557008"
    assert opening.url == "https://globalcareers.lge.com/jobs/5309557008"
    assert opening.title == "Data Platform Engineer"
    assert opening.employment_type == "Full-Time"
    assert opening.location == "Seoul"
    assert opening.description_text == (
        "Build Python and SQL data services. EN LGEKR R&D South Korea"
    )
    assert opening.opens_at is not None
    assert opening.opens_at.isoformat() == "2026-07-08T13:08:05+09:00"


def test_parse_enterprise_json_openings_maps_lg_cns_job_notice_api() -> None:
    payload = {
        "status": "S",
        "msg": "Success",
        "data": {
            "jobNoticeList": [
                {
                    "jobNoticeId": 1001706,
                    "careerTypeName": "경력",
                    "companyCode": "CNS",
                    "companyName": "LG CNS",
                    "jobNoticeName": "[LG CNS] AWS 클라우드 아키텍트 모집 (경력)",
                    "recEndDateTime": "2026.07.31 23:00",
                    "noticeStatus": "POSTING",
                    "hashtagText": "AWS,Cloud",
                    "jobGroupName": "IT서비스",
                    "jobGroupName2": "",
                },
                {
                    "jobNoticeId": 1001707,
                    "careerTypeName": "경력",
                    "companyCode": "CNS",
                    "companyName": "LG CNS",
                    "jobNoticeName": "[LG CNS] Closed Engineer",
                    "noticeStatus": "CLOSED",
                },
            ],
        },
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://api.careers.lg.com/rmk/job/retrieveJobNoticesList",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "1001706"
    assert opening.url == "https://careers.lg.com/apply/detail?id=1001706"
    assert opening.title == "[LG CNS] AWS 클라우드 아키텍트 모집 (경력)"
    assert opening.career_type == "experienced"
    assert opening.description_text == "LG CNS IT서비스 AWS,Cloud"
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-31T23:00:00+09:00"


def test_parse_enterprise_json_openings_maps_posco_recruit_list_api() -> None:
    payload = {
        "summary": [{"TOT_CNT": 1, "CNT": 1, "S_NM": "경력"}],
        "recuList": [
            {
                "HR_AFTC_MRG_ADOP_CLTA_TP_TP": "B",
                "COMPANY_NAME": "포스코DX",
                "RECU_FIELD": "경력_SW개발,경력_AI Agent",
                "END_ACTIVE_DATE": "2026.07.12",
                "DDAY": 3,
                "HR_AFTC_MRG_ADOP_CLTA_TP_TP_NM": "전문경력",
                "HR_ADOP_CDDT_ELCN_GRD_NM": (
                    "SW개발,정보보안,수학/통계,Big Data/AI"
                ),
                "HR_AFTC_MRG_ADOP_NTIC_ID": 653001,
                "HR_AFTC_MRG_ADOP_NTIC_SUJX": (
                    "(포항/광양) IT&amp;AI 분야 경력사원 채용 [정규직]"
                ),
            }
        ],
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://recruit.posco.com/h22a01-recruit/H22A1000/list"
        "?rowCount=20&pageSize=10&currPage=1&offset=0&SEARCH_TYPE="
        "&SEARCH_ORDER=s1&SEARCH_KEYWORD=&SEARCH_COMP=01&SEARCH_VALUE=",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "653001"
    assert opening.url == (
        "https://recruit.posco.com/h22a01-front/H22A1001.html?id=653001"
    )
    assert opening.title == "(포항/광양) IT&AI 분야 경력사원 채용 [정규직]"
    assert opening.employment_type == "전문경력"
    assert opening.career_type == "experienced"
    assert opening.location is None
    assert opening.description_text == (
        "포스코DX 경력_SW개발,경력_AI Agent "
        "SW개발,정보보안,수학/통계,Big Data/AI"
    )
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-12T00:00:00+09:00"


def test_parse_enterprise_json_openings_maps_sk_careers_recruit_list_api() -> None:
    payload = {
        "success": True,
        "totalCount": 1,
        "list": [
            {
                "jobNoticeNo": 5936,
                "noticeID": "R261484",
                "title": "SKT 뉴스룸 운영 지원 담당자",
                "jobRole": "기술/현장지원/디자인/콘텐츠제작",
                "recruitType": "Experienced",
                "workingType": "Contract",
                "workingArea": "Seoul",
                "remainDay": 3,
                "corpName": "SK telecom",
                "start": "July 03, 2026(Fri)",
                "end": "July 12, 2026(Sun)",
            }
        ],
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://www.skcareers.com/Recruit/GetRecruitList",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "R261484"
    assert opening.url == "https://www.skcareers.com/Recruit/Detail/R261484"
    assert opening.title == "SKT 뉴스룸 운영 지원 담당자"
    assert opening.employment_type == "Contract"
    assert opening.career_type == "experienced"
    assert opening.location == "Seoul"
    assert opening.description_text == (
        "SK telecom 기술/현장지원/디자인/콘텐츠제작"
    )
    assert opening.opens_at is not None
    assert opening.opens_at.isoformat() == "2026-07-03T00:00:00+09:00"
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-12T00:00:00+09:00"


def test_parse_enterprise_json_openings_maps_smilegate_announce_api() -> None:
    payload = {
        "count": 2,
        "announceCount": 2,
        "announce": [
            {
                "announceSeq": 6142,
                "title": "[글로벌운영] 리스크관리 담당",
                "companyNm": "스마일게이트",
                "jobMainNm": "게임제작",
                "jobDtlNm": "운영서비스",
                "careerTypeNm": "신입/경력",
                "hireTypeNm": "정규직",
                "gameGenreNm": "",
                "projectNm": None,
                "endDate": "20260731",
            },
            {
                "announceSeq": 6141,
                "title": "[글로벌운영] 운영기획 담당",
                "companyNm": "스마일게이트",
                "jobMainNm": "게임제작",
                "jobDtlNm": "운영서비스",
                "careerTypeNm": "경력",
                "hireTypeNm": "계약직",
                "gameGenreNm": "Crossfire",
                "projectNm": "Crossfire",
                "endDate": "20260731",
            },
        ],
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://careers.smilegate.com/api/apply/announce/guest",
    )

    assert len(openings) == 2
    opening = openings[0]
    assert opening.external_id == "6142"
    assert opening.url == "https://careers.smilegate.com/apply/announce/view?seq=6142"
    assert opening.title == "[글로벌운영] 리스크관리 담당"
    assert opening.employment_type == "정규직"
    assert opening.career_type == "mixed"
    assert opening.description_text == "스마일게이트 게임제작 운영서비스"
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-31T00:00:00+09:00"

    second = openings[1]
    assert second.external_id == "6141"
    assert second.career_type == "experienced"
    assert second.description_text == (
        "스마일게이트 게임제작 운영서비스 Crossfire"
    )


def test_parse_enterprise_json_openings_maps_kt_recruit_api() -> None:
    payload = {
        "isSuccess": True,
        "errorMessage": None,
        "data": [
            {
                "recruitNoticeSn": 258054,
                "recruitNoticeName": "[KT] 2026년 경력채용 (AX기술연구 및 개발)",
                "recruitSectorList": [
                    {
                        "recruitSectorSn": 716082,
                        "recruitSectorName": "AI Foundation 모델 개발",
                    },
                    {"recruitSectorSn": 716083, "recruitSectorName": "Data Governance"},
                    {"recruitSectorSn": 716084, "recruitSectorName": "AI Engineering"},
                ],
                "recruitNoticeUrl": "https://kt.recruiter.co.kr/career/jobs/119898",
                "isPost": True,
                "isInProgress": True,
                "recruitTypeName": "일반채용",
                "recruitClassName": "경력",
                "receiveStartDatetime": "2026-06-25 00:00:00",
                "receiveEndDatetime": "2026-07-12 23:55:59",
                "company": "KT",
                "title": "2026년 경력채용 (AX기술연구 및 개발)",
                "dday": 3,
            }
        ],
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://recruit.kt.com/api/recruit?isPost=1&isInprogress=1"
        "&isContainsContents=0",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "258054"
    assert opening.url == "https://kt.recruiter.co.kr/career/jobs/119898"
    assert opening.title == "[KT] 2026년 경력채용 (AX기술연구 및 개발)"
    assert opening.employment_type == "경력"
    assert opening.career_type == "experienced"
    assert opening.description_text == (
        "KT AI Foundation 모델 개발 Data Governance AI Engineering"
    )
    assert opening.opens_at is not None
    assert opening.opens_at.isoformat() == "2026-06-25T00:00:00+09:00"
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-12T23:55:59+09:00"


def test_parse_enterprise_json_openings_maps_cj_recruit_jsonp_api() -> None:
    payload = [
        {
            "RNUM": "9",
            "ACTIVE_CNT": "40",
            "TOTAL_COUNT": "41",
            "COMPANY": "E10",
            "BUSINESS_UNIT": "E10BU",
            "ZZ_TARGET_1": "B",
            "ZZ_TITLE": "[경력] CJ ONE 회원 서비스 백엔드 개발자",
            "ZZ_STR_DT": "2026-06-16 11:00",
            "ZZ_END_DT": "2026-07-31 23:59",
            "ZZ_REMOVE_DT": "2026-07-31",
            "ZZ_JO_NUM": "J20260616038263",
        },
        {
            "RNUM": "41",
            "ACTIVE_CNT": "40",
            "TOTAL_COUNT": "41",
            "ZZ_TARGET_1": "A",
            "ZZ_TITLE": "[계약] 영상 콘텐츠 가공 및 유통",
            "ZZ_STR_DT": "2026-06-24 00:00",
            "ZZ_END_DT": "2026-07-06 18:10",
            "ZZ_REMOVE_DT": "2026-07-09",
            "ZZ_JO_NUM": "J20260112037655",
        },
    ]

    openings = parse_enterprise_json_openings(
        f"list({json.dumps(payload, ensure_ascii=False)})",
        "https://recruit.cj.net/recruit/ko/common/common/jobListInfo.fo"
        "?COMPANY=E10&BUSINESS_UNIT=E10BU&ZZ_TARGET_1=Z&ROWNO=100"
        "&PAGENO=1&TOTAL_COUNT=1&ZZ_TITLE=&callback=list",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "J20260616038263"
    assert opening.url == (
        "https://recruit.cj.net/recruit/ko/recruit/recruit/bestDetail.fo"
        "?zz_jo_num=J20260616038263"
    )
    assert opening.title == "[경력] CJ ONE 회원 서비스 백엔드 개발자"
    assert opening.employment_type == "경력"
    assert opening.career_type == "experienced"
    assert opening.description_text == "CJ OliveNetworks 경력"
    assert opening.opens_at is not None
    assert opening.opens_at.isoformat() == "2026-06-16T11:00:00+09:00"
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-31T23:59:00+09:00"


def test_parse_enterprise_json_openings_maps_hyundai_motor_apply_list_api() -> None:
    payload = {
        "status": 200,
        "message": "OK",
        "data": {
            "listCnt": 1,
            "list": [
                {
                    "recuYy": "2026",
                    "recuType": "N2",
                    "recuCls": 261,
                    "recuNoticeNm": (
                        "[Security] Service Security Engineer - Application Security"
                    ),
                    "applyStartDt": "20260615",
                    "applyStartTm": "0900",
                    "applyEndDt": "20260714",
                    "applyEndTm": "1705",
                    "secCodeNm": "IT",
                    "fldCodeNm": "Security Engineering",
                    "workPlaceCodeNm": "HQ(Seoul)",
                    "channelCodeNm": "Experienced",
                    "hashTag": None,
                    "collectMark": "Experienced Recruitment - June",
                }
            ],
        },
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://talent.hyundai.com/api/rec/AP-HM-FO-02700?hgrCd=1"
        "&lang=en&page=1&pageblock=100&searchFieldList=&searchOccupList="
        "&searchPlaceList=&searchSectorList=&searchText=&jdSec=&srcOrd=",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "2026-N2-261"
    assert opening.url == (
        "https://talent.hyundai.com/eng/apply/applyView.hc"
        "?recuYy=2026&recuType=N2&recuCls=261"
    )
    assert (
        opening.title
        == "[Security] Service Security Engineer - Application Security"
    )
    assert opening.employment_type == "Experienced"
    assert opening.career_type == "experienced"
    assert opening.location == "HQ(Seoul)"
    assert opening.description_text == "IT Security Engineering"
    assert opening.opens_at is not None
    assert opening.opens_at.isoformat() == "2026-06-15T09:00:00+09:00"
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-14T17:05:00+09:00"


def test_parse_enterprise_json_openings_maps_hanwha_recruit_api() -> None:
    payload = {
        "success": True,
        "code": "SUCCESS",
        "message": "채용공고 목록 조회 성공",
        "data": {
            "filteredCount": 1,
            "size": 100,
            "hasNext": False,
            "page": 0,
            "list": [
                {
                    "sdNm": "한화시스템/ICT",
                    "rtNm": "금융프로젝트 PM(프로젝트매니저) 경력사원 채용",
                    "rtAcptStrtDttm": "2026.07.02 09:00",
                    "rtAcptEndDttm": "2026.07.12 23:59",
                    "rtSeq": 19162,
                    "rtNrcrtYn": "N",
                    "rtCarrYn": "Y",
                    "rtIntnYn": "N",
                    "rtPermanentWorkYn": "Y",
                    "rtTempWorkYn": "N",
                    "tagList": [{"tagNm": "PM"}, {"tagNm": "금융"}],
                }
            ],
        },
    }

    openings = parse_enterprise_json_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/search-rcrt",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "19162"
    assert opening.url == (
        "https://www.hanwhain.com/portal/apply/recruit/detail?rtSeq=19162"
    )
    assert opening.title == "금융프로젝트 PM(프로젝트매니저) 경력사원 채용"
    assert opening.employment_type == "정규직"
    assert opening.career_type == "experienced"
    assert opening.description_text == "한화시스템/ICT 정규직 PM 금융"
    assert opening.opens_at is not None
    assert opening.opens_at.isoformat() == "2026-07-02T09:00:00+09:00"
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-12T23:59:00+09:00"
