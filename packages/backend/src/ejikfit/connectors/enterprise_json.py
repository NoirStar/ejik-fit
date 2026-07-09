import json
from datetime import datetime
from html import unescape
from typing import Any

from ejikfit.connectors.next_data import parse_static_payload_openings
from ejikfit.connectors.types import ParsedOpening


def _posco_recruit_payload(data: dict[str, Any]) -> dict[str, Any] | None:
    recu_list = data.get("recuList")
    if not isinstance(recu_list, list):
        return None

    jobs: list[dict[str, Any]] = []
    for item in recu_list:
        if not isinstance(item, dict):
            continue
        posting_id = item.get("HR_AFTC_MRG_ADOP_NTIC_ID")
        title = item.get("HR_AFTC_MRG_ADOP_NTIC_SUJX")
        if posting_id is None or not isinstance(title, str):
            continue
        jobs.append(
            {
                "id": str(posting_id),
                "title": unescape(title),
                "jobDetailUrl": f"/h22a01-front/H22A1001.html?id={posting_id}",
                "employmentType": item.get("HR_AFTC_MRG_ADOP_CLTA_TP_TP_NM"),
                "careerTypeName": item.get("HR_AFTC_MRG_ADOP_CLTA_TP_TP_NM"),
                "closeDate": item.get("END_ACTIVE_DATE"),
                "department": item.get("COMPANY_NAME"),
                "jobGroup": item.get("RECU_FIELD"),
                "hashtagText": item.get("HR_ADOP_CDDT_ELCN_GRD_NM"),
            }
        )
    return {"jobs": jobs}


def _sk_date(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    date_text = value.split("(", maxsplit=1)[0].strip()
    try:
        return datetime.strptime(date_text, "%B %d, %Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def _sk_career_type(value: Any) -> str | None:
    if value == "New":
        return "신입"
    if value == "Experienced":
        return "경력"
    return value if isinstance(value, str) else None


def _sk_careers_payload(data: dict[str, Any]) -> dict[str, Any] | None:
    recruit_list = data.get("list")
    if not isinstance(recruit_list, list):
        return None

    jobs: list[dict[str, Any]] = []
    for item in recruit_list:
        if not isinstance(item, dict):
            continue
        posting_id = item.get("noticeID") or item.get("jobNoticeNo")
        title = item.get("title")
        if posting_id is None or not isinstance(title, str):
            continue
        jobs.append(
            {
                "id": str(posting_id),
                "title": unescape(title),
                "jobDetailUrl": f"/Recruit/Detail/{posting_id}",
                "employmentType": item.get("workingType"),
                "careerTypeName": _sk_career_type(item.get("recruitType")),
                "location": item.get("workingArea"),
                "startDate": _sk_date(item.get("start")),
                "closeDate": _sk_date(item.get("end")),
                "department": item.get("corpName"),
                "jobGroup": item.get("jobRole"),
            }
        )
    return {"jobs": jobs}


def _kt_sector_names(value: Any) -> str:
    if not isinstance(value, list):
        return ""
    names: list[str] = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("recruitSectorName"), str):
            names.append(item["recruitSectorName"])
    return " ".join(dict.fromkeys(names))


def _kt_recruit_payload(data: dict[str, Any]) -> dict[str, Any] | None:
    recruit_list = data.get("data")
    if not isinstance(recruit_list, list):
        return None

    jobs: list[dict[str, Any]] = []
    for item in recruit_list:
        if not isinstance(item, dict) or "recruitNoticeSn" not in item:
            continue
        posting_id = item.get("recruitNoticeSn")
        title = item.get("recruitNoticeName") or item.get("title")
        if posting_id is None or not isinstance(title, str):
            continue
        jobs.append(
            {
                "id": str(posting_id),
                "title": unescape(title),
                "jobDetailUrl": item.get("recruitNoticeUrl"),
                "employmentType": item.get("recruitClassName"),
                "careerTypeName": item.get("recruitClassName"),
                "startDate": item.get("receiveStartDatetime"),
                "closeDate": item.get("receiveEndDatetime"),
                "department": item.get("company"),
                "jobGroup": _kt_sector_names(item.get("recruitSectorList")),
                "active": item.get("isPost"),
                "live": item.get("isInProgress"),
            }
        )
    return {"jobs": jobs}


def parse_enterprise_json_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    data = json.loads(raw_json)
    if isinstance(data, dict):
        posco_payload = _posco_recruit_payload(data)
        if posco_payload is not None:
            return parse_static_payload_openings(posco_payload, listing_url)
        sk_payload = _sk_careers_payload(data)
        if sk_payload is not None:
            return parse_static_payload_openings(sk_payload, listing_url)
        kt_payload = _kt_recruit_payload(data)
        if kt_payload is not None:
            return parse_static_payload_openings(kt_payload, listing_url)
    return parse_static_payload_openings(data, listing_url)
