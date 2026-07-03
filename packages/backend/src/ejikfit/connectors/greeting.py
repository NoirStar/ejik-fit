from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup

from ejikfit.connectors.next_data import extract_next_data
from ejikfit.connectors.types import OpeningRef, ParsedOpening


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


def discover_openings(html: str, page_url: str) -> list[OpeningRef]:
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
        external_id = str(opening_id)
        if external_id in seen:
            continue
        seen.add(external_id)
        refs.append(
            OpeningRef(
                external_id=external_id,
                url=f"{page_url.rstrip('/')}/o/{external_id}",
            )
        )
    return refs


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
    description_text = BeautifulSoup(
        description_html,
        "lxml",
    ).get_text(" ", strip=True)

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
