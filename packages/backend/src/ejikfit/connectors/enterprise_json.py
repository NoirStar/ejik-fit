import json
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


def parse_enterprise_json_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    data = json.loads(raw_json)
    if isinstance(data, dict):
        posco_payload = _posco_recruit_payload(data)
        if posco_payload is not None:
            return parse_static_payload_openings(posco_payload, listing_url)
    return parse_static_payload_openings(data, listing_url)
