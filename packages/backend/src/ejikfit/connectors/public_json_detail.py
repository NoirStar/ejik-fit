import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


KST = ZoneInfo("Asia/Seoul")


@dataclass(frozen=True)
class PublicJsonDetailRef:
    external_id: str
    detail_url: str
    public_url: str
    title: str
    category: str | None = None


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _positive_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _parse_datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.year >= 2999:
        return None
    return parsed.replace(tzinfo=KST) if parsed.tzinfo is None else parsed


def _origin(listing_url: str) -> str:
    parsed = urlsplit(listing_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("public JSON listing URL must be absolute")
    return f"{parsed.scheme}://{parsed.netloc}"


def _decode_object(raw_json: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as error:
        raise ValueError("public JSON payload is invalid") from error
    if not isinstance(payload, dict):
        raise ValueError("public JSON payload must be an object")
    return payload


def _woowahan_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    if str(payload.get("code")) != "2000":
        raise ValueError("Woowahan listing did not return a success envelope")
    data = payload.get("data")
    rows = data.get("list") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        raise ValueError("Woowahan listing is missing its recruit list")

    origin = _origin(listing_url)
    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        if (
            row.get("recruitDeleteYn") is True
            or row.get("isHidden") is True
            or row.get("isTemporaryStatus") is True
            or row.get("isAfterOrEqualEndDay") is True
            or row.get("isAfterOrEqualOpenDay") is False
        ):
            continue
        external_id = _text(row.get("recruitNumber"))
        title = _text(row.get("recruitName"))
        if external_id is None or title is None or external_id in seen:
            continue
        seen.add(external_id)
        job_group = row.get("jobGroup")
        category = (
            _text(job_group.get("recruitItemCode"))
            if isinstance(job_group, dict)
            else None
        )
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=f"{origin}/w1/recruits/{external_id}",
                public_url=f"{origin}/recruitment/{external_id}/detail",
                title=title,
                category=category,
            )
        )
    return refs


def _kakaobank_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    rows = payload.get("list")
    if not isinstance(rows, list):
        raise ValueError("KakaoBank listing is missing its recruit list")

    origin = _origin(listing_url)
    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        raw_id = row.get("recruitNoticeSn")
        title = _text(row.get("recruitNoticeName"))
        if raw_id is None or isinstance(raw_id, bool) or title is None:
            continue
        external_id = str(raw_id)
        if external_id in seen:
            continue
        seen.add(external_id)
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=f"{origin}/api/recruits/{external_id}",
                public_url=f"{origin}/jobs/{external_id}",
                title=title,
                category=_text(row.get("recruitClassName")),
            )
        )
    return refs


def discover_public_json_detail_refs(
    raw_json: str,
    listing_url: str,
    connector_family: str,
) -> list[PublicJsonDetailRef]:
    payload = _decode_object(raw_json)
    if connector_family == "woowahan_public_api_tech":
        return _woowahan_refs(payload, listing_url)
    if connector_family == "kakaobank_public_api_tech":
        return _kakaobank_refs(payload, listing_url)
    raise ValueError(f"unsupported public JSON detail family: {connector_family}")


def _nested_code(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    return _text(value.get("recruitItemCode")) if isinstance(value, dict) else None


def _woowahan_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    if str(payload.get("code")) != "2000":
        raise ValueError("Woowahan detail did not return a success envelope")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("Woowahan detail is missing its recruit data")
    external_id = _text(data.get("recruitNumber"))
    title = _text(data.get("recruitName"))
    if external_id != ref.external_id or title is None:
        raise ValueError("Woowahan detail identity does not match its listing")

    description_html = _text(data.get("recruitContents")) or ""
    career_type = {
        "BA003001": "new_comer",
        "BA003002": "experienced",
        "BA003003": "mixed",
    }.get(_nested_code(data, "careerType"))
    employment_type = {
        "BA002001": "regular",
        "BA002002": "contract",
        "BA002003": "intern",
    }.get(_nested_code(data, "employmentType"))
    is_closed = (
        data.get("recruitDeleteYn") is True
        or data.get("isAfterOrEqualEndDay") is True
        or data.get("isHidden") is True
    )
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="closed" if is_closed else "open",
        description_html=description_html,
        description_text=structured_plain_text(description_html),
        employment_type=employment_type,
        career_type=career_type,
        career_min=_positive_int(data.get("careerRestrictionMinYears")),
        career_max=_positive_int(data.get("careerRestrictionMaxYears")),
        location=None,
        opens_at=_parse_datetime(data.get("recruitOpenDate")),
        closes_at=_parse_datetime(data.get("recruitEndDate")),
    )


def _career_type_from_title(title: str) -> str | None:
    has_newcomer = "신입" in title
    has_experienced = "경력" in title
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _employment_type_from_title(title: str) -> str:
    if "인턴" in title:
        return "intern"
    if "계약직" in title:
        return "contract"
    return "regular"


def _kakaobank_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    raw_id = payload.get("recruitNoticeSn")
    external_id = None if raw_id is None or isinstance(raw_id, bool) else str(raw_id)
    title = _text(payload.get("recruitNoticeName"))
    if external_id != ref.external_id or title is None:
        raise ValueError("KakaoBank detail identity does not match its listing")

    description_html = _text(payload.get("contents")) or ""
    closes_at = _parse_datetime(payload.get("receiveEndDatetime"))
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=structured_plain_text(description_html),
        employment_type=_employment_type_from_title(title),
        career_type=_career_type_from_title(title),
        career_min=None,
        career_max=None,
        location=None,
        opens_at=_parse_datetime(payload.get("receiveStartDatetime")),
        closes_at=closes_at,
    )


def parse_public_json_detail(
    raw_json: str,
    ref: PublicJsonDetailRef,
    connector_family: str,
) -> ParsedOpening:
    payload = _decode_object(raw_json)
    if connector_family == "woowahan_public_api_tech":
        return _woowahan_opening(payload, ref)
    if connector_family == "kakaobank_public_api_tech":
        return _kakaobank_opening(payload, ref)
    raise ValueError(f"unsupported public JSON detail family: {connector_family}")
