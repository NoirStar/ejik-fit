import json
from datetime import datetime
from typing import Any
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from ejikfit.connectors.types import ParsedOpening


KST = ZoneInfo("Asia/Seoul")


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), "%Y.%m.%d %H:%M").replace(
            tzinfo=KST
        )
    except ValueError:
        return None


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _unique_join(values: list[str | None]) -> str:
    return " ".join(dict.fromkeys(value for value in values if value))


def _career_type(*values: Any) -> str | None:
    text = " ".join(value for value in (_text(value) for value in values) if value)
    has_newcomer = "신입" in text
    has_experienced = "경력" in text
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _openings(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        candidate = data.get("list", [])
    else:
        candidate = data
    if not isinstance(candidate, list):
        raise ValueError("Naver job list must be a list")
    return [item for item in candidate if isinstance(item, dict)]


def parse_naver_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]:
    data = json.loads(raw_json)
    openings: list[ParsedOpening] = []

    for item in _openings(data):
        external_id = item.get("annoId")
        title = _text(item.get("annoSubject"))
        if external_id is None or title is None:
            continue

        raw_url = _text(item.get("jobDetailLink"))
        url = urljoin(listing_url, raw_url) if raw_url else (
            f"https://recruit.navercorp.com/rcrt/view.do?annoId={external_id}"
        )
        description_text = _unique_join(
            [
                _text(item.get("classCdNm")),
                _text(item.get("subJobCdNm")),
                _text(item.get("annoKeyword")),
                _text(item.get("sysCompanyCdNm")),
            ]
        )

        openings.append(
            ParsedOpening(
                external_id=str(external_id),
                url=url,
                title=title,
                status="open",
                description_html="",
                description_text=description_text,
                employment_type=_text(item.get("empTypeCdNm")),
                career_type=_career_type(item.get("entTypeCdNm"), title),
                career_min=None,
                career_max=None,
                location=None,
                opens_at=_parse_datetime(item.get("staYmdTime")),
                closes_at=_parse_datetime(item.get("endYmdTime")),
            )
        )

    return openings
