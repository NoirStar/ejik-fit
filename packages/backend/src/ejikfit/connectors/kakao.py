import json
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


KST = ZoneInfo("Asia/Seoul")


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _parse_datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None

    normalized = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        for date_format in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(raw, date_format)
                break
            except ValueError:
                continue
        else:
            return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=KST)
    return parsed


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


def _html_fields(item: dict[str, Any]) -> list[str]:
    fields = (
        "introduction",
        "workContentDesc",
        "qualification",
        "jobOfferProcessDesc",
        "krewComment",
        "workTypeDesc",
    )
    return [value for key in fields if isinstance((value := item.get(key)), str)]


def _skills(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    names: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            names.append(item.strip())
        elif isinstance(item, dict):
            name = _text(item.get("name") or item.get("skillName"))
            if name:
                names.append(name)
    return list(dict.fromkeys(names))


def _openings(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        candidate = data.get("jobList", data.get("list", []))
    else:
        candidate = data
    if not isinstance(candidate, list):
        raise ValueError("Kakao job list must be a list")
    return [item for item in candidate if isinstance(item, dict)]


def _status(item: dict[str, Any]) -> str:
    raw_status = (_text(item.get("statusCode")) or "").upper()
    if item.get("closeFlag") is True or raw_status in {"END", "CLOSED", "CLOSE"}:
        return "closed"
    return "open"


def parse_kakao_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]:
    data = json.loads(raw_json)
    openings: list[ParsedOpening] = []

    for item in _openings(data):
        external_id = _text(item.get("realId")) or _text(item.get("jobOfferId"))
        title = _text(item.get("jobOfferTitle"))
        if external_id is None or title is None:
            continue

        description_html = "\n".join(_html_fields(item))
        description_parts = [structured_plain_text(description_html)]
        skill_text = " ".join(_skills(item.get("skillSetList")))
        if skill_text:
            description_parts.append(skill_text)

        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=f"https://careers.kakao.com/jobs/{external_id}",
                title=title,
                status=_status(item),
                description_html=description_html,
                description_text="\n".join(
                    part for part in description_parts if part
                ),
                employment_type=_text(item.get("employeeTypeName")),
                career_type=_career_type(title, item.get("careerTypeName")),
                career_min=None,
                career_max=None,
                location=_text(item.get("locationName")),
                opens_at=_parse_datetime(item.get("regDate")),
                closes_at=_parse_datetime(item.get("endDate")),
            )
        )

    return openings
