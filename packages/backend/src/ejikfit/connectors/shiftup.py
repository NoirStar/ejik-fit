import json
import re
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


KST = ZoneInfo("Asia/Seoul")
SHIFTUP_LISTING_API = "https://shiftup.co.kr/comm/lib/client_lib.php"
SHIFTUP_LISTING_FORM = {
    "workType": "get_recruit_list",
    "code": "recruit",
    "cat_idx": "0",
    "searchkey": "",
}
TECHNICAL_GROUPS = {"programmer", "qa"}
CAREER_RANGE_PATTERN = re.compile(r"(?P<minimum>\d+)\s*~\s*(?P<maximum>\d+)\s*년")
CAREER_MIN_PATTERN = re.compile(r"(?P<minimum>\d+)\s*년\s*이상")
CAREER_MAX_PATTERN = re.compile(r"(?P<maximum>\d+)\s*년\s*이하")


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _career_range(value: str | None) -> tuple[int | None, int | None]:
    if value is None:
        return None, None
    range_match = CAREER_RANGE_PATTERN.search(value)
    if range_match is not None:
        return (
            int(range_match.group("minimum")),
            int(range_match.group("maximum")),
        )
    minimum_match = CAREER_MIN_PATTERN.search(value)
    if minimum_match is not None:
        return int(minimum_match.group("minimum")), None
    maximum_match = CAREER_MAX_PATTERN.search(value)
    if maximum_match is not None:
        return None, int(maximum_match.group("maximum"))
    return None, None


def _career_type(
    title: str,
    career_label: str | None,
    career_min: int | None,
    career_max: int | None,
) -> str | None:
    searchable = f"{title} {career_label or ''}"
    has_newcomer = "신입" in searchable
    has_experienced = (
        "경력" in searchable
        or career_min is not None
        or career_max is not None
    )
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _employment_type(value: str | None) -> str | None:
    if value is None:
        return None
    if "정규" in value:
        return "regular"
    if "계약" in value:
        return "contract"
    if "인턴" in value:
        return "intern"
    return None


def _published_at(value: Any) -> datetime | None:
    try:
        timestamp = int(value)
    except (TypeError, ValueError):
        return None
    if timestamp <= 0:
        return None
    try:
        return datetime.fromtimestamp(timestamp, tz=KST)
    except (OverflowError, OSError, ValueError):
        return None


def _public_detail_url(value: str | None) -> tuple[str, str] | None:
    if value is None:
        return None
    parsed = urlsplit(value)
    segments = [segment for segment in parsed.path.split("/") if segment]
    if (
        parsed.scheme != "https"
        or parsed.hostname != "career.shiftup.co.kr"
        or "o" not in segments
    ):
        return None
    opening_marker = segments.index("o")
    if opening_marker not in {0, 1} or len(segments) <= opening_marker + 1:
        return None
    if opening_marker == 1 and segments[0] not in {"ko", "en"}:
        return None
    external_id = segments[opening_marker + 1]
    if not external_id or not external_id.isdigit():
        return None
    public_path = "/" + "/".join(segments[: opening_marker + 2])
    public_url = urlunsplit((parsed.scheme, parsed.netloc, public_path, "", ""))
    return external_id, public_url


def parse_shiftup_openings(raw_json: str) -> list[ParsedOpening]:
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as error:
        raise ValueError("Shift Up listing payload is invalid") from error
    if not isinstance(payload, dict) or payload.get("result") != "000":
        raise ValueError("Shift Up listing did not return a success envelope")
    rows = payload.get("list")
    if not isinstance(rows, list):
        raise ValueError("Shift Up listing is missing its job list")

    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()
    for row in rows:
        if not isinstance(row, dict) or str(row.get("status")) != "1":
            continue
        group = (_text(row.get("addinfo7")) or "").casefold()
        if group not in TECHNICAL_GROUPS:
            continue

        title = _text(row.get("subject"))
        description_html = _text(row.get("content"))
        detail = _public_detail_url(_text(row.get("addinfo6")))
        if title is None or description_html is None:
            raise ValueError("Shift Up open technical job content is missing")
        if detail is None:
            raise ValueError("Shift Up job URL is not its official Shift Up detail")
        external_id, public_url = detail
        if external_id in seen_ids:
            continue
        seen_ids.add(external_id)

        career_label = _text(row.get("addinfo4"))
        career_min, career_max = _career_range(career_label)
        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=public_url,
                title=title,
                status="open",
                description_html=description_html,
                description_text=structured_plain_text(description_html),
                employment_type=_employment_type(_text(row.get("addinfo5"))),
                career_type=_career_type(
                    title,
                    career_label,
                    career_min,
                    career_max,
                ),
                career_min=career_min,
                career_max=career_max,
                location=None,
                opens_at=_published_at(row.get("wdate")),
                closes_at=None,
            )
        )

    return openings
