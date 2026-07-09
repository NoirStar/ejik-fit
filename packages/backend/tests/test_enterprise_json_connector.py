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
