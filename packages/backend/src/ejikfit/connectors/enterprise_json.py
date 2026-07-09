import json
import re
from datetime import datetime
from html import unescape
from typing import Any
from urllib.parse import urlencode

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


def _loads_json_or_jsonp(raw_json: str) -> Any:
    try:
        return json.loads(raw_json)
    except json.JSONDecodeError as json_error:
        match = re.match(r"\s*[\w$.]+\((.*)\)\s*;?\s*$", raw_json, re.DOTALL)
        if match is None:
            raise json_error
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            raise json_error


def _parse_int(value: Any) -> int | None:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _cj_target_name(value: Any) -> str:
    return {
        "A": "신입",
        "B": "경력",
        "C": "인턴",
        "D": "산학실습",
        "E": "신입/경력",
        "K": "리턴십",
    }.get(value, "신입")


def _cj_active(item: dict[str, Any]) -> bool:
    row_number = _parse_int(item.get("RNUM"))
    active_count = _parse_int(item.get("ACTIVE_CNT"))
    if row_number is None or active_count is None:
        return True
    return row_number <= active_count


def _cj_recruit_payload(data: list[Any]) -> dict[str, Any] | None:
    if not any(isinstance(item, dict) and "ZZ_JO_NUM" in item for item in data):
        return None

    jobs: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        posting_id = item.get("ZZ_JO_NUM")
        title = item.get("ZZ_TITLE")
        if posting_id is None or not isinstance(title, str):
            continue
        posting_id_text = str(posting_id)
        detail_file = "detail.fo" if posting_id_text.isdigit() else "bestDetail.fo"
        target_name = _cj_target_name(item.get("ZZ_TARGET_1"))
        jobs.append(
            {
                "id": posting_id_text,
                "title": unescape(title),
                "jobDetailUrl": (
                    "https://recruit.cj.net/recruit/ko/recruit/recruit/"
                    f"{detail_file}?{urlencode({'zz_jo_num': posting_id_text})}"
                ),
                "employmentType": target_name,
                "careerTypeName": target_name,
                "startDate": item.get("ZZ_STR_DT"),
                "closeDate": item.get("ZZ_END_DT"),
                "companyName": "CJ OliveNetworks",
                "jobGroupName": target_name,
                "active": _cj_active(item),
                "live": _cj_active(item),
            }
        )
    return {"jobs": jobs}


def _hyundai_datetime(date_value: Any, time_value: Any) -> str | None:
    if not isinstance(date_value, str):
        return None
    date_text = date_value.strip()
    if not date_text:
        return None
    time_text = time_value.strip() if isinstance(time_value, str) else "0000"
    try:
        parsed = datetime.strptime(f"{date_text}{time_text}", "%Y%m%d%H%M")
    except ValueError:
        return None
    return parsed.strftime("%Y-%m-%d %H:%M")


def _hyundai_apply_payload(data: dict[str, Any]) -> dict[str, Any] | None:
    payload = data.get("data")
    if not isinstance(payload, dict):
        return None
    recruit_list = payload.get("list")
    if not isinstance(recruit_list, list):
        return None
    if "listCnt" not in payload and not any(
        isinstance(item, dict)
        and "recuYy" in item
        and "recuNoticeNm" in item
        for item in recruit_list
    ):
        return None

    jobs: list[dict[str, Any]] = []
    for item in recruit_list:
        if not isinstance(item, dict):
            continue
        recu_yy = item.get("recuYy")
        recu_type = item.get("recuType")
        recu_cls = item.get("recuCls")
        title = item.get("recuNoticeNm")
        if (
            recu_yy is None
            or recu_type is None
            or recu_cls is None
            or not isinstance(title, str)
        ):
            continue
        query = urlencode(
            {
                "recuYy": str(recu_yy),
                "recuType": str(recu_type),
                "recuCls": str(recu_cls),
            }
        )
        jobs.append(
            {
                "id": f"{recu_yy}-{recu_type}-{recu_cls}",
                "title": unescape(title),
                "jobDetailUrl": (
                    f"https://talent.hyundai.com/eng/apply/applyView.hc?{query}"
                ),
                "employmentType": item.get("channelCodeNm"),
                "careerTypeName": item.get("channelCodeNm"),
                "location": item.get("workPlaceCodeNm"),
                "startDate": _hyundai_datetime(
                    item.get("applyStartDt"),
                    item.get("applyStartTm"),
                ),
                "closeDate": _hyundai_datetime(
                    item.get("applyEndDt"),
                    item.get("applyEndTm"),
                ),
                "department": item.get("secCodeNm"),
                "jobGroup": item.get("fldCodeNm"),
                "hashtagText": item.get("hashTag"),
                "active": True,
                "live": True,
            }
        )
    return {"jobs": jobs}


def _flag_names(item: dict[str, Any], mapping: tuple[tuple[str, str], ...]) -> str:
    return " | ".join(label for key, label in mapping if item.get(key) == "Y")


def _hanwha_tag_names(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    names: list[str] = []
    for item in value:
        if isinstance(item, str):
            name = item.strip()
        elif isinstance(item, dict):
            name = str(
                item.get("tagNm")
                or item.get("tagName")
                or item.get("name")
                or item.get("label")
                or ""
            ).strip()
        else:
            name = ""
        if name:
            names.append(name)
    return list(dict.fromkeys(names))


def _hanwha_recruit_payload(data: dict[str, Any]) -> dict[str, Any] | None:
    payload = data.get("data")
    if not isinstance(payload, dict):
        return None
    recruit_list = payload.get("list")
    if not isinstance(recruit_list, list):
        return None
    if not any(
        isinstance(item, dict) and "rtSeq" in item and "rtNm" in item
        for item in recruit_list
    ):
        return None

    jobs: list[dict[str, Any]] = []
    for item in recruit_list:
        if not isinstance(item, dict):
            continue
        posting_id = item.get("rtSeq")
        title = item.get("rtNm")
        if posting_id is None or not isinstance(title, str):
            continue

        career_type_name = _flag_names(
            item,
            (
                ("rtNrcrtYn", "신입"),
                ("rtCarrYn", "경력"),
                ("rtIntnYn", "인턴"),
            ),
        )
        employment_type = _flag_names(
            item,
            (
                ("rtPermanentWorkYn", "정규직"),
                ("rtTempWorkYn", "계약직"),
            ),
        )
        posting_id_text = str(posting_id)
        jobs.append(
            {
                "id": posting_id_text,
                "title": unescape(title),
                "jobDetailUrl": (
                    "https://www.hanwhain.com/portal/apply/recruit/detail?"
                    f"{urlencode({'rtSeq': posting_id_text})}"
                ),
                "employmentType": employment_type or career_type_name,
                "careerTypeName": career_type_name,
                "startDate": item.get("rtAcptStrtDttm"),
                "closeDate": item.get("rtAcptEndDttm"),
                "companyName": item.get("sdNm"),
                "jobGroupName": employment_type,
                "skills": _hanwha_tag_names(item.get("tagList")),
                "active": True,
                "live": True,
            }
        )
    return {"jobs": jobs}


def parse_enterprise_json_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    data = _loads_json_or_jsonp(raw_json)
    if isinstance(data, list):
        cj_payload = _cj_recruit_payload(data)
        if cj_payload is not None:
            return parse_static_payload_openings(cj_payload, listing_url)
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
        hyundai_payload = _hyundai_apply_payload(data)
        if hyundai_payload is not None:
            return parse_static_payload_openings(hyundai_payload, listing_url)
        hanwha_payload = _hanwha_recruit_payload(data)
        if hanwha_payload is not None:
            return parse_static_payload_openings(hanwha_payload, listing_url)
    return parse_static_payload_openings(data, listing_url)
