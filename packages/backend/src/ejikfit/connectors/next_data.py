import json
from datetime import datetime
from html import unescape
from typing import Any
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from ejikfit.connectors.types import ParsedOpening


KST = ZoneInfo("Asia/Seoul")
TITLE_KEYS = (
    "title",
    "jobTitle",
    "position",
    "positionName",
    "recruitTitle",
    "postingTitle",
    "announcementTitle",
    "jobNoticeName",
    "name",
)
ID_KEYS = (
    "id",
    "jobId",
    "jobNo",
    "postingId",
    "recruitId",
    "announcementId",
    "requisitionId",
    "reqId",
    "positionId",
    "jobNoticeId",
    "code",
)
URL_KEYS = (
    "url",
    "link",
    "href",
    "detailUrl",
    "detailURL",
    "applyUrl",
    "applyURL",
    "jobDetailUrl",
    "jobDetailURL",
)
LOCATION_KEYS = (
    "location",
    "locations",
    "workLocation",
    "workLocations",
    "workplace",
    "workplaces",
    "office",
)
EMPLOYMENT_KEYS = (
    "employmentType",
    "employeeType",
    "employment",
    "jobType",
    "contractType",
    "empType",
)
CAREER_KEYS = (
    "careerType",
    "career",
    "experience",
    "experienceType",
    "requiredExperience",
    "careerTypeName",
)
OPENS_AT_KEYS = (
    "startDate",
    "startAt",
    "openingDate",
    "openDate",
    "datePosted",
    "postedAt",
    "postCreateDtm",
)
CLOSES_AT_KEYS = (
    "endDate",
    "endAt",
    "deadline",
    "validThrough",
    "closeDate",
    "closedAt",
    "recEndDateTime",
)
DESCRIPTION_KEYS = (
    "content",
    "description",
    "jobCategory",
    "category",
    "departmentName",
    "department",
    "organization",
    "team",
    "jobGroup",
    "jobField",
    "companyName",
    "jobGroupName",
    "jobGroupName2",
    "hashtagText",
    "jobFamily",
    "corpCd",
    "corpType",
    "cntryNm",
)
SKILL_KEYS = (
    "skillTags",
    "skills",
    "techStacks",
    "requiredSkills",
    "keywords",
    "tags",
)
PRIVATE_FALSE_KEYS = (
    "isPublic",
    "is_public",
    "public",
    "publish",
    "published",
    "isPublished",
    "active",
    "live",
)
PRIVATE_TRUE_KEYS = (
    "private",
    "isPrivate",
    "hidden",
    "isHidden",
)
CLOSED_TRUE_KEYS = (
    "closed",
    "isClosed",
    "closeFlag",
    "expired",
    "isExpired",
)
STATUS_KEYS = (
    "status",
    "statusCode",
    "recruitStatus",
    "state",
    "displayStatus",
    "noticeStatus",
)
CLOSED_STATUSES = {
    "closed",
    "close",
    "end",
    "ended",
    "inactive",
    "expired",
    "finish",
    "finished",
    "마감",
}
NAVIGATION_TITLES = {
    "about",
    "about us",
    "career",
    "careers",
    "culture",
    "faq",
    "hiring process",
    "jobs",
    "privacy",
    "top",
}

def extract_next_data(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", id="__NEXT_DATA__")
    if script is None or not script.string:
        raise ValueError("__NEXT_DATA__ script is missing")

    data = json.loads(script.string)
    if not isinstance(data, dict):
        raise ValueError("__NEXT_DATA__ must contain a JSON object")
    return data


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = _clean_text(value)
        return stripped or None
    return None


def _scalar_text(value: Any) -> str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return str(value)
    return _text(value)


def _first_text(item: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        if key not in item:
            continue
        value = _scalar_text(item[key])
        if value:
            return value
    return None


def _first_value(item: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in item:
            return item[key]
    return None


def _names(value: Any) -> list[str]:
    if isinstance(value, str):
        text = _text(value)
        return [text] if text else []
    if isinstance(value, list):
        names: list[str] = []
        for item in value:
            names.extend(_names(item))
        return list(dict.fromkeys(names))
    if isinstance(value, dict):
        for key in ("name", "title", "label", "displayName", "value"):
            name = _text(value.get(key))
            if name:
                return [name]
    return []


def _first_names(item: dict[str, Any], keys: tuple[str, ...]) -> list[str]:
    for key in keys:
        if key in item:
            names = _names(item[key])
            if names:
                return names
    return []


def _unique_join(values: list[str | None]) -> str:
    return " ".join(dict.fromkeys(value for value in values if value))


def _markup_text(value: Any) -> str | None:
    text = _scalar_text(value)
    if text is None:
        return None
    if "<" not in text and "&" not in text:
        return text
    soup = BeautifulSoup(unescape(text), "lxml")
    return _text(soup.get_text(" "))


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, list) and 3 <= len(value) <= 7:
        try:
            parts = [int(part) for part in value]
            return datetime(*parts[:6], tzinfo=KST)
        except (TypeError, ValueError):
            return None

    raw = _text(value)
    if raw is None:
        return None

    normalized = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        for date_format in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y.%m.%d %H:%M:%S",
            "%Y.%m.%d %H:%M",
            "%Y.%m.%d",
            "%Y/%m/%d",
        ):
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
    text = " ".join(
        value
        for value in (
            _scalar_text(value)
            for value in values
        )
        if value
    ).lower()
    has_newcomer = "신입" in text or "newcomer" in text or "entry" in text
    has_experienced = "경력" in text or "experienced" in text
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _payload(raw: str) -> Any:
    stripped = raw.strip()
    if not stripped:
        raise ValueError("static Next data payload is empty")

    if "__NEXT_DATA__" in stripped:
        return extract_next_data(stripped)

    try:
        return json.loads(stripped)
    except json.JSONDecodeError as exc:
        raise ValueError("static Next data payload is not valid JSON") from exc


def _walk(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        candidates = [value]
        for child in value.values():
            candidates.extend(_walk(child))
        return candidates
    if isinstance(value, list):
        candidates: list[dict[str, Any]] = []
        for item in value:
            candidates.extend(_walk(item))
        return candidates
    return []


def _is_public_open(item: dict[str, Any]) -> bool:
    for key in PRIVATE_FALSE_KEYS:
        if item.get(key) is False:
            return False
    for key in PRIVATE_TRUE_KEYS + CLOSED_TRUE_KEYS:
        if item.get(key) is True:
            return False
    for key in STATUS_KEYS:
        status = _text(item.get(key))
        if status and status.lower() in CLOSED_STATUSES:
            return False
    return True


def _url(item: dict[str, Any], listing_url: str) -> str | None:
    raw_url = _first_text(item, URL_KEYS)
    if raw_url is None:
        external_id = _first_text(item, ID_KEYS)
        parsed = urlparse(listing_url)
        if (
            parsed.netloc == "globalcareers.lge.com"
            and parsed.path.rstrip("/") == "/api/job/v1/jobs"
            and external_id
        ):
            return urljoin(listing_url, f"/jobs/{external_id}")
        if (
            parsed.netloc == "api.careers.lg.com"
            and parsed.path.rstrip("/") == "/rmk/job/retrieveJobNoticesList"
            and external_id
        ):
            return f"https://careers.lg.com/apply/detail?id={external_id}"
        return None
    if raw_url.startswith(("#", "mailto:", "tel:", "javascript:")):
        return None
    return urljoin(listing_url, raw_url)


def _external_id(item: dict[str, Any], url: str) -> str:
    explicit_id = _first_text(item, ID_KEYS)
    if explicit_id:
        return explicit_id

    parsed = urlparse(url)
    path_tail = parsed.path.rstrip("/").rsplit("/", maxsplit=1)[-1]
    if path_tail:
        return path_tail
    return parsed.query or url


def _description_text(item: dict[str, Any]) -> str:
    values = [_markup_text(item[key]) for key in DESCRIPTION_KEYS if key in item]
    for key in SKILL_KEYS:
        values.extend(_names(item.get(key)))
    return _unique_join(values)


def _opening_from_item(
    item: dict[str, Any],
    listing_url: str,
) -> ParsedOpening | None:
    title = _first_text(item, TITLE_KEYS)
    if title is None or title.lower() in NAVIGATION_TITLES:
        return None
    if not _is_public_open(item):
        return None

    url = _url(item, listing_url)
    if url is None:
        return None

    return ParsedOpening(
        external_id=_external_id(item, url),
        url=url,
        title=title,
        status="open",
        description_html="",
        description_text=_description_text(item),
        employment_type=_first_text(item, EMPLOYMENT_KEYS),
        career_type=_career_type(title, _first_text(item, CAREER_KEYS)),
        career_min=None,
        career_max=None,
        location=", ".join(_first_names(item, LOCATION_KEYS)) or _first_text(
            item,
            LOCATION_KEYS,
        ),
        opens_at=_parse_datetime(_first_value(item, OPENS_AT_KEYS)),
        closes_at=_parse_datetime(_first_value(item, CLOSES_AT_KEYS)),
    )


def parse_static_next_data_openings(
    raw: str,
    listing_url: str,
) -> list[ParsedOpening]:
    return parse_static_payload_openings(_payload(raw), listing_url)


def parse_static_payload_openings(
    data: Any,
    listing_url: str,
) -> list[ParsedOpening]:
    openings: list[ParsedOpening] = []
    seen_urls: set[str] = set()

    for item in _walk(data):
        opening = _opening_from_item(item, listing_url)
        if opening is None or opening.url in seen_urls:
            continue
        seen_urls.add(opening.url)
        openings.append(opening)

    return openings
