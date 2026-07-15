import json
import re
from datetime import datetime
from html import escape
from typing import Any
from urllib.parse import quote, urlencode, urlparse

from ejikfit.connectors.types import ParsedOpening


HYDRATION_PATTERN = re.compile(
    r"window\.__staticRouterHydrationData\s*=\s*"
    r"JSON\.parse\((\"(?:\\.|[^\"\\])*\")\)",
    re.DOTALL,
)
CAREER_YEARS_PATTERN = re.compile(
    r"(?<!\d)(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?",
    re.IGNORECASE,
)


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = " ".join(value.split())
    return stripped or None


def _extract_hydration_data(html: str) -> dict[str, Any]:
    match = HYDRATION_PATTERN.search(html)
    if match is None:
        raise ValueError("Apple page is missing hydration data")
    try:
        serialized_payload = json.loads(match.group(1))
        payload = json.loads(serialized_payload)
    except (json.JSONDecodeError, TypeError) as error:
        raise ValueError("Apple hydration data is invalid") from error
    if not isinstance(payload, dict):
        raise ValueError("Apple hydration data is invalid")
    return payload


def parse_apple_search_page(html: str) -> tuple[list[dict[str, Any]], int]:
    payload = _extract_hydration_data(html)
    loader_data = payload.get("loaderData")
    search = loader_data.get("search") if isinstance(loader_data, dict) else None
    rows = search.get("searchResults") if isinstance(search, dict) else None
    total = search.get("totalRecords") if isinstance(search, dict) else None
    if not isinstance(rows, list) or not isinstance(total, int) or total < 0:
        raise ValueError("Apple search page has an invalid result envelope")
    if not all(isinstance(row, dict) for row in rows):
        raise ValueError("Apple search page contains an invalid job")
    return rows, total


def _parse_datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _location(value: Any) -> str | None:
    if isinstance(value, list):
        location = next((item for item in value if isinstance(item, dict)), None)
    elif isinstance(value, dict):
        location = value
    else:
        location = None
    if location is None:
        return None

    name = _text(location.get("name") or location.get("city"))
    country = _text(location.get("countryName"))
    parts = list(dict.fromkeys(part for part in (name, country) if part))
    return " · ".join(parts) or None


def _detail_url(item: dict[str, Any], listing_url: str) -> str | None:
    raw_id = _text(item.get("id") or item.get("reqId"))
    position_id = _text(item.get("positionId"))
    slug = _text(item.get("transformedPostingTitle"))
    if raw_id is None or slug is None:
        return None
    detail_id = position_id if raw_id.startswith("PIPE-") and position_id else raw_id

    parsed = urlparse(listing_url)
    locale = parsed.path.strip("/").split("/", maxsplit=1)[0] or "en-us"
    path = "/".join(
        (
            "",
            quote(locale, safe="-"),
            "details",
            quote(detail_id, safe="-"),
            quote(slug, safe="-"),
        )
    )
    team = item.get("team")
    team_code = _text(team.get("teamCode")) if isinstance(team, dict) else None
    query = f"?{urlencode({'team': team_code})}" if team_code else ""
    return f"{parsed.scheme}://{parsed.netloc}{path}{query}"


def _listing_opening(
    item: dict[str, Any],
    listing_url: str,
) -> ParsedOpening | None:
    if item.get("postExternal") is False:
        return None
    external_id = _text(item.get("id") or item.get("reqId"))
    title = _text(item.get("postingTitle"))
    url = _detail_url(item, listing_url)
    if external_id is None or title is None or url is None:
        return None

    summary = _text(item.get("jobSummary")) or ""
    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status="open",
        description_html=f"<p>{escape(summary)}</p>" if summary else "",
        description_text=summary,
        employment_type=None,
        career_type=None,
        career_min=None,
        career_max=None,
        location=_location(item.get("locations")),
        opens_at=_parse_datetime(item.get("postDateInGMT")),
        closes_at=None,
    )


def parse_apple_listing_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    data = json.loads(raw_json)
    jobs = data.get("jobs") if isinstance(data, dict) else None
    if not isinstance(jobs, list):
        raise ValueError("Apple merged listing is missing jobs")
    return [
        opening
        for item in jobs
        if isinstance(item, dict)
        for opening in [_listing_opening(item, listing_url)]
        if opening is not None
    ]


def _description_sections(job: dict[str, Any]) -> list[tuple[str, str]]:
    fields = (
        ("About the role", "jobSummary"),
        ("What you'll do", "description"),
        ("Responsibilities", "responsibilities"),
        ("Minimum qualifications", "minimumQualifications"),
        ("Preferred qualifications", "preferredQualifications"),
    )
    return [
        (label, text)
        for label, key in fields
        if (text := _text(job.get(key))) is not None
    ]


def _description_html(sections: list[tuple[str, str]]) -> str:
    return "".join(
        f"<h2>{escape(label)}</h2><p>{escape(text)}</p>"
        for label, text in sections
    )


def _employment_type(value: Any) -> str | None:
    normalized = (_text(value) or "").casefold()
    return {
        "standard": "정규직",
        "fixed term": "계약직",
        "part time": "파트타임",
        "part-time": "파트타임",
        "internship": "인턴",
    }.get(normalized, _text(value))


def _career_min(job: dict[str, Any]) -> int | None:
    qualifications = _text(job.get("minimumQualifications")) or ""
    years = [int(match) for match in CAREER_YEARS_PATTERN.findall(qualifications)]
    return min(years) if years else None


def parse_apple_detail_opening(html: str, detail_url: str) -> ParsedOpening:
    payload = _extract_hydration_data(html)
    loader_data = payload.get("loaderData")
    details = (
        loader_data.get("jobDetails") if isinstance(loader_data, dict) else None
    )
    job = details.get("jobsData") if isinstance(details, dict) else None
    if not isinstance(job, dict):
        raise ValueError("Apple detail page is missing job data")

    external_id = _text(job.get("jobNumber") or job.get("id") or job.get("reqId"))
    title = _text(job.get("postingTitle"))
    if external_id is None or title is None:
        raise ValueError("Apple detail page is missing job identity")

    sections = _description_sections(job)
    description_text = " ".join(text for _label, text in sections)
    team_names = job.get("teamNames")
    if isinstance(team_names, list):
        team_text = " ".join(
            value for item in team_names if (value := _text(item)) is not None
        )
        if team_text:
            description_text = f"{team_text} {description_text}".strip()

    career_min = _career_min(job)
    return ParsedOpening(
        external_id=external_id,
        url=detail_url,
        title=title,
        status="open",
        description_html=_description_html(sections),
        description_text=description_text,
        employment_type=_employment_type(job.get("employmentType")),
        career_type="경력" if career_min is not None else None,
        career_min=career_min,
        career_max=None,
        location=_location(job.get("selectedLocation") or job.get("locations")),
        opens_at=_parse_datetime(job.get("postDateInGMT") or job.get("longPostingDate")),
        closes_at=None,
    )
