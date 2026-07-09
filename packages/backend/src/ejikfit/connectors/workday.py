import json
from datetime import datetime
from typing import Any
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from ejikfit.connectors.types import ParsedOpening


KST = ZoneInfo("Asia/Seoul")
CLOSED_STATUSES = {"closed", "inactive", "filled", "unposted"}


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
    if item.get("inactive") is True or item.get("active") is False:
        return False
    status = _text(item.get("status") or item.get("jobPostingStatus"))
    return status is None or status.lower() not in CLOSED_STATUSES


def _external_id(item: dict[str, Any], url: str) -> str | None:
    for key in ("jobReqId", "id", "requisitionId", "jobId"):
        value = _text(item.get(key))
        if value:
            return value
    path_tail = urlparse(url).path.rstrip("/").rsplit("/", maxsplit=1)[-1]
    return path_tail or None


def _url(item: dict[str, Any], listing_url: str) -> str | None:
    raw_url = _text(
        item.get("externalUrl")
        or item.get("externalPath")
        or item.get("jobPostingUrl")
        or item.get("url")
    )
    if raw_url is None:
        return None
    return urljoin(listing_url, raw_url)


def _location(item: dict[str, Any]) -> str | None:
    return _text(
        item.get("locationsText")
        or item.get("location")
        or item.get("primaryLocation")
    )


def _description_text(item: dict[str, Any]) -> str:
    return _unique_join(
        [
            _text(item.get("jobFamilyGroup")),
            _text(item.get("jobFamily")),
            _text(item.get("workerSubType")),
            _html_text(item.get("jobDescription")),
            _text(item.get("description")),
        ]
    )


def _opening_from_item(
    item: dict[str, Any],
    listing_url: str,
) -> ParsedOpening | None:
    if not _is_open(item):
        return None

    title = _text(item.get("title") or item.get("jobTitle"))
    url = _url(item, listing_url)
    if title is None or url is None:
        return None

    external_id = _external_id(item, url)
    if external_id is None:
        return None

    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status="open",
        description_html=_text(item.get("jobDescription")) or "",
        description_text=_description_text(item),
        employment_type=_text(item.get("timeType") or item.get("workerSubType")),
        career_type=None,
        career_min=None,
        career_max=None,
        location=_location(item),
        opens_at=_parse_datetime(item.get("startDate") or item.get("postedDate")),
        closes_at=_parse_datetime(item.get("endDate")),
    )


def _items(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        for key in ("jobPostings", "jobs", "postings"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        value = data.get("jobPostingInfo")
        if isinstance(value, dict):
            return [value]
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    raise ValueError("Workday job feed is missing")


def parse_workday_openings(
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
