import json
import re
from datetime import datetime
from typing import Any
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from ejikfit.connectors.types import ParsedOpening


KST = ZoneInfo("Asia/Seoul")
ODATA_DATE_PATTERN = re.compile(r"/Date\((?P<millis>-?\d+)\)/")
CLOSED_STATUSES = {"closed", "inactive", "deleted", "filled", "cancelled"}


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = " ".join(value.split())
        return stripped or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None


def _html_text(value: Any) -> str | None:
    raw = _text(value)
    if raw is None:
        return None
    return BeautifulSoup(raw, "lxml").get_text(" ", strip=True) or None


def _unique_join(values: list[str | None]) -> str:
    return " ".join(dict.fromkeys(value for value in values if value))


def _parse_datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None

    match = ODATA_DATE_PATTERN.fullmatch(raw)
    if match is not None:
        return datetime.fromtimestamp(int(match.group("millis")) / 1000, tz=KST)

    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        for date_format in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
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


def _is_open(item: dict[str, Any]) -> bool:
    if item.get("active") is False or item.get("deleted") is True:
        return False
    status = _text(item.get("status") or item.get("jobStatus"))
    return status is None or status.lower() not in CLOSED_STATUSES


def _first_text(item: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = _text(item.get(key))
        if value:
            return value
    return None


def _url(item: dict[str, Any], listing_url: str) -> str | None:
    raw_url = _first_text(
        item,
        (
            "jobDetailsUrl",
            "externalApplyUrl",
            "applyUrl",
            "externalUrl",
            "url",
        ),
    )
    if raw_url is None:
        return None
    return urljoin(listing_url, raw_url)


def _location(item: dict[str, Any]) -> str | None:
    explicit = _first_text(item, ("location", "locationName"))
    if explicit:
        return explicit
    return ", ".join(
        value
        for value in (
            _text(item.get("city")),
            _text(item.get("country")),
        )
        if value
    ) or None


def _description_text(item: dict[str, Any]) -> str:
    return _unique_join(
        [
            _first_text(item, ("jobFunction", "businessUnit", "department")),
            _text(item.get("department")),
            _html_text(
                item.get("jobDescription")
                or item.get("description")
                or item.get("externalJobDescription")
            ),
        ]
    )


def _opening_from_item(
    item: dict[str, Any],
    listing_url: str,
) -> ParsedOpening | None:
    if not _is_open(item):
        return None

    external_id = _first_text(
        item,
        ("jobReqId", "jobId", "requisitionId", "id"),
    )
    title = _first_text(
        item,
        ("externalTitle", "jobTitle", "title", "positionTitle"),
    )
    url = _url(item, listing_url)
    if external_id is None or title is None or url is None:
        return None

    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status="open",
        description_html=_text(
            item.get("jobDescription")
            or item.get("description")
            or item.get("externalJobDescription")
        ) or "",
        description_text=_description_text(item),
        employment_type=_first_text(
            item,
            ("employmentType", "jobType", "employeeClass"),
        ),
        career_type=None,
        career_min=None,
        career_max=None,
        location=_location(item),
        opens_at=_parse_datetime(
            item.get("postedDate")
            or item.get("postingDate")
            or item.get("lastModifiedDateTime")
        ),
        closes_at=_parse_datetime(item.get("endDate") or item.get("closeDate")),
    )


def _items(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        nested = data.get("d")
        if isinstance(nested, dict) and isinstance(nested.get("results"), list):
            return [item for item in nested["results"] if isinstance(item, dict)]
        for key in ("results", "value", "jobs", "jobRequisitions"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    raise ValueError("SAP SuccessFactors job feed is missing")


def parse_successfactors_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    data = json.loads(raw_json)
    return [
        opening
        for item in _items(data)
        for opening in [_opening_from_item(item, listing_url)]
        if opening is not None
    ]
