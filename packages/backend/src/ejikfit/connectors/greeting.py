from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from ejikfit.connectors.next_data import extract_next_data
from ejikfit.connectors.technical_roles import is_technical_role
from ejikfit.connectors.types import OpeningRef, ParsedOpening
from ejikfit.html_text import structured_plain_text


def _queries(data: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        queries = data["props"]["pageProps"]["dehydratedState"]["queries"]
    except (KeyError, TypeError) as exc:
        raise ValueError("Greeting query data is missing") from exc

    if not isinstance(queries, list):
        raise ValueError("Greeting queries must be a list")
    return [query for query in queries if isinstance(query, dict)]


def _query_key(query: dict[str, Any]) -> list[Any]:
    key = query.get("queryKey", [])
    return key if isinstance(key, list) else []


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _unique_join(values: list[str]) -> str | None:
    unique_values = list(dict.fromkeys(value for value in values if value))
    return ", ".join(unique_values) or None


def _opening_role_names(opening: dict[str, Any]) -> list[str]:
    position_group = opening.get("openingJobPosition")
    if not isinstance(position_group, dict):
        return []
    positions = position_group.get("openingJobPositions")
    if not isinstance(positions, list):
        return []

    names: list[str] = []
    for position in positions:
        if not isinstance(position, dict):
            continue
        for container_key, value_keys in (
            ("workspaceJob", ("job", "name")),
            ("workspaceOccupation", ("occupation", "name")),
            ("workspaceField", ("field", "name")),
        ):
            container = position.get(container_key)
            if not isinstance(container, dict):
                continue
            for value_key in value_keys:
                value = container.get(value_key)
                if isinstance(value, str) and value:
                    names.append(value)
                    break
    return names


def discover_openings(
    html: str,
    page_url: str,
    *,
    technical_only: bool = False,
) -> list[OpeningRef]:
    data = extract_next_data(html)
    openings: list[dict[str, Any]] | None = None

    for query in _queries(data):
        key = _query_key(query)
        if key and key[0] == "openings":
            candidate = query.get("state", {}).get("data")
            if isinstance(candidate, list):
                openings = [
                    item for item in candidate if isinstance(item, dict)
                ]
                break

    if openings is None:
        raise ValueError("Greeting openings query is missing")

    refs: list[OpeningRef] = []
    seen: set[str] = set()
    for opening in openings:
        opening_id = opening.get("openingId")
        if opening_id is None:
            continue
        title = (
            opening.get("title")
            if isinstance(opening.get("title"), str)
            else None
        )
        if technical_only and not is_technical_role(
            title,
            *_opening_role_names(opening),
        ):
            continue
        external_id = str(opening_id)
        if external_id in seen:
            continue
        seen.add(external_id)
        refs.append(
            OpeningRef(
                external_id=external_id,
                url=f"{page_url.rstrip('/')}/o/{external_id}",
                title=title,
            )
        )
    return refs


def _as_non_negative_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _corporate_job_group_names(page_props: dict[str, Any]) -> dict[str, str]:
    code_list = page_props.get("codeList")
    job_group = code_list.get("jobGroup") if isinstance(code_list, dict) else None
    json_result = (
        job_group.get("jsonResult") if isinstance(job_group, dict) else None
    )
    rows = json_result.get("data") if isinstance(json_result, dict) else None
    if not isinstance(rows, list):
        return {}
    return {
        code: name
        for row in rows
        if isinstance(row, dict)
        if (code := row.get("code")) is not None
        if isinstance((name := row.get("code_name")), str) and name
    }


def _greeting_detail_id(raw_url: str) -> str | None:
    parsed_url = urlparse(raw_url)
    hostname = (parsed_url.hostname or "").casefold()
    segments = [segment for segment in parsed_url.path.split("/") if segment]
    if (
        parsed_url.scheme != "https"
        or not hostname.endswith(".career.greetinghr.com")
        or len(segments) < 2
        or segments[-2] != "o"
    ):
        return None
    return segments[-1] or None


def discover_corporate_greeting_openings(
    html: str,
    page_url: str,
    *,
    technical_only: bool = False,
) -> list[OpeningRef]:
    """Discover Greeting details exposed by a corporate Next.js careers page."""

    listing = urlparse(page_url)
    if listing.scheme not in {"http", "https"} or not listing.hostname:
        raise ValueError("corporate careers URL must be absolute")
    data = extract_next_data(html)
    try:
        page_props = data["props"]["pageProps"]
        job_list = page_props["jobList"]
        result = job_list["jsonResult"]
        rows = result["data"]
        declared_total = result["metaData"]["totalCount"]
    except (KeyError, TypeError) as error:
        raise ValueError("corporate Greeting job list is missing") from error
    if not isinstance(page_props, dict) or not isinstance(rows, list):
        raise ValueError("corporate Greeting job list must be an array")
    if _as_non_negative_int(job_list.get("statusCode")) != 200:
        raise ValueError("corporate Greeting job list did not return success")
    total = _as_non_negative_int(declared_total)
    if total is None or total != len(rows):
        raise ValueError("corporate Greeting job list is incomplete")

    group_names = _corporate_job_group_names(page_props)
    refs: list[OpeningRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = row.get("title")
        raw_url = row.get("notice_url")
        if not isinstance(title, str) or not title.strip():
            continue
        if not isinstance(raw_url, str):
            continue
        external_id = _greeting_detail_id(raw_url)
        if not external_id or external_id in seen:
            continue
        category = group_names.get(str(row.get("job_group_code")))
        if technical_only and not is_technical_role(title, category):
            continue
        seen.add(external_id)
        refs.append(
            OpeningRef(
                external_id=external_id,
                url=raw_url,
                title=title.strip(),
            )
        )
    return refs


def discover_grouped_greeting_openings(
    html: str,
    page_url: str,
    *,
    technical_only: bool = False,
) -> list[OpeningRef]:
    """Discover Greeting links grouped in server-rendered corporate HTML."""

    listing = urlparse(page_url)
    if listing.scheme not in {"http", "https"} or not listing.hostname:
        raise ValueError("corporate careers URL must be absolute")

    soup = BeautifulSoup(html.replace("\x00", ""), "lxml")
    if soup.select_one("a[rel='next']") is not None:
        raise ValueError("grouped corporate careers list has another page")

    all_refs: list[tuple[OpeningRef, str | None]] = []
    seen: set[str] = set()
    for link in soup.find_all("a", href=True):
        raw_url = link.get("href")
        if not isinstance(raw_url, str):
            continue
        external_id = _greeting_detail_id(raw_url)
        if external_id is None or external_id in seen:
            continue
        title = link.get_text(" ", strip=True)
        if not title:
            continue
        parent = link.parent
        heading = parent.find(("div", "h2", "h3"), recursive=False) if parent else None
        category = heading.get_text(" ", strip=True) if heading else None
        seen.add(external_id)
        all_refs.append(
            (
                OpeningRef(external_id=external_id, url=raw_url, title=title),
                category,
            )
        )

    if not all_refs:
        raise ValueError("grouped corporate careers list has no Greeting jobs")
    if not technical_only:
        return [ref for ref, _ in all_refs]
    return [
        ref
        for ref, category in all_refs
        if is_technical_role(ref.title, category)
    ]


def _opening_payload(data: dict[str, Any]) -> dict[str, Any]:
    for query in _queries(data):
        key = _query_key(query)
        if len(key) > 1 and key[1] == "getOpeningById":
            state_data = query.get("state", {}).get("data", {})
            payload = (
                state_data.get("data")
                if isinstance(state_data, dict)
                else None
            )
            if isinstance(payload, dict):
                return payload
    raise ValueError("Greeting opening detail query is missing")


def _career_summary(
    positions: list[dict[str, Any]],
) -> tuple[str | None, int | None, int | None]:
    career_types: set[str] = set()
    minimums: list[int] = []
    maximums: list[int] = []

    for position in positions:
        career = position.get("jobPositionCareer")
        if not isinstance(career, dict):
            continue

        career_type = career.get("careerType")
        if isinstance(career_type, str):
            career_types.add(career_type)

        career_from = career.get("careerFrom")
        career_to = career.get("careerTo")
        if isinstance(career_from, int) and not isinstance(career_from, bool):
            minimums.append(career_from)
        if isinstance(career_to, int) and not isinstance(career_to, bool):
            maximums.append(career_to)

    if {"NEW_COMER", "EXPERIENCED"} <= career_types:
        summary = "mixed"
    elif "NEW_COMER" in career_types:
        summary = "new_comer"
    elif "EXPERIENCED" in career_types:
        summary = "experienced"
    elif career_types:
        summary = ", ".join(sorted(value.lower() for value in career_types))
    else:
        summary = None

    return (
        summary,
        min(minimums) if minimums else None,
        max(maximums) if maximums else None,
    )


def parse_opening(html: str, page_url: str) -> ParsedOpening:
    payload = _opening_payload(extract_next_data(html))
    info = payload.get("openingsInfo")
    if not isinstance(info, dict):
        raise ValueError("Greeting openingsInfo is missing")

    settings = payload.get("jobPositionSetting", {})
    raw_positions = (
        settings.get("jobPositions", [])
        if isinstance(settings, dict)
        else []
    )
    positions = [
        position for position in raw_positions if isinstance(position, dict)
    ]

    career_type, career_min, career_max = _career_summary(positions)
    employment_types: list[str] = []
    locations: list[str] = []

    for position in positions:
        employment = position.get("jobPositionEmployment")
        if isinstance(employment, dict):
            employment_type = employment.get("employmentType")
            if isinstance(employment_type, str):
                employment_types.append(employment_type)

        place = position.get("workspacePlace")
        if isinstance(place, dict):
            for key in ("name", "place", "location"):
                location = place.get(key)
                if isinstance(location, str) and location:
                    locations.append(location)
                    break

    detail = info.get("detail")
    description_html = detail if isinstance(detail, str) else ""
    description_text = structured_plain_text(description_html)

    external_id = info.get("openingId")
    title = info.get("title")
    if external_id is None or not isinstance(title, str):
        raise ValueError("Greeting opening identity is missing")

    return ParsedOpening(
        external_id=str(external_id),
        url=page_url,
        title=title,
        status="open" if info.get("status") == "OPEN" else "closed",
        description_html=description_html,
        description_text=description_text,
        employment_type=_unique_join(employment_types),
        career_type=career_type,
        career_min=career_min,
        career_max=career_max,
        location=_unique_join(locations),
        opens_at=_parse_datetime(info.get("openDate")),
        closes_at=_parse_datetime(info.get("dueDate")),
    )
