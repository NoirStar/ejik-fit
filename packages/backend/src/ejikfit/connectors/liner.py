from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from ejikfit.connectors.next_data import extract_next_data
from ejikfit.connectors.technical_roles import is_technical_role
from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


LINER_LISTING_URL = "https://liner.com/careers/jobs"


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _integer(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _parse_datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _query_data(raw_html: str, expected_key: list[str]) -> Any:
    page_props = extract_next_data(raw_html).get("props", {}).get(
        "pageProps"
    )
    if not isinstance(page_props, dict):
        raise ValueError("Liner careers page data is missing")
    dehydrated_state = page_props.get("dehydratedState")
    queries = (
        dehydrated_state.get("queries")
        if isinstance(dehydrated_state, dict)
        else None
    )
    if not isinstance(queries, list):
        raise ValueError("Liner careers queries are missing")

    for query in queries:
        if not isinstance(query, dict):
            continue
        query_key = query.get("queryKey")
        if not isinstance(query_key, list) or [
            str(part) for part in query_key[: len(expected_key)]
        ] != expected_key:
            continue
        state = query.get("state")
        if isinstance(state, dict) and "data" in state:
            return state["data"]
    raise ValueError("Liner careers query data is missing")


def _validate_listing_url(listing_url: str) -> None:
    parsed = urlsplit(listing_url)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "liner.com"
        or parsed.path.rstrip("/") != "/careers/jobs"
    ):
        raise ValueError("Liner listing URL must be its official careers page")


def _positions(payload: dict[str, Any]) -> list[dict[str, Any]]:
    position_info = payload.get("openingJobPositionInfo")
    rows = (
        position_info.get("openingJobPositions")
        if isinstance(position_info, dict)
        else None
    )
    if not isinstance(rows, list) or not rows:
        raise ValueError("Liner opening position data is missing")
    if not all(isinstance(row, dict) for row in rows):
        raise ValueError("Liner opening contains an invalid position")
    return rows


def _unique_join(values: list[str], separator: str = " / ") -> str | None:
    unique = list(dict.fromkeys(value for value in values if value))
    return separator.join(unique) if unique else None


def _position_labels(positions: list[dict[str, Any]]) -> list[str]:
    labels: list[str] = []
    for position in positions:
        for key, value_key in (
            ("jobPositionField", "field"),
            ("jobPositionOccupation", "occupation"),
            ("jobPositionJob", "job"),
        ):
            value = position.get(key)
            label = _text(value.get(value_key)) if isinstance(value, dict) else None
            if label is not None:
                labels.append(label)
    return list(dict.fromkeys(labels))


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
        career_type = _text(career.get("careerType"))
        if career_type is not None:
            career_types.add(career_type.upper())
        career_from = _integer(career.get("careerFrom"))
        career_to = _integer(career.get("careerTo"))
        if career_from is not None:
            minimums.append(career_from)
        if career_to is not None:
            maximums.append(career_to)

    unrestricted = {
        "IRRELEVANT",
        "NEW_COMER_AND_EXPERIENCED",
        "NOT_MATTER",
    }
    if career_types & unrestricted or {
        "NEW_COMER",
        "EXPERIENCED",
    } <= career_types:
        summary = "mixed"
    elif "NEW_COMER" in career_types:
        summary = "new_comer"
    elif "EXPERIENCED" in career_types:
        summary = "experienced"
    else:
        summary = None
    return (
        summary,
        min(minimums) if minimums else None,
        max(maximums) if maximums else None,
    )


def _employment_summary(positions: list[dict[str, Any]]) -> str | None:
    values: list[str] = []
    for position in positions:
        employment = position.get("jobPositionEmployment")
        value = (
            _text(employment.get("employment"))
            if isinstance(employment, dict)
            else None
        )
        if value is not None:
            values.append(value)
    return _unique_join(values)


def _location_summary(positions: list[dict[str, Any]]) -> str | None:
    values: list[str] = []
    for position in positions:
        place = position.get("jobPositionPlace")
        if not isinstance(place, dict):
            continue
        primary = _text(place.get("place")) or _text(place.get("location"))
        detail = _text(place.get("detailPlace"))
        if primary is not None:
            values.append(" ".join(part for part in (primary, detail) if part))
    return _unique_join(values)


def _opening_from_payload(
    payload: dict[str, Any],
    *,
    external_id: str,
    title: str,
    url: str,
    status: str,
    description_html: str,
    opens_at: datetime | None,
    closes_at: datetime | None,
) -> ParsedOpening:
    positions = _positions(payload)
    career_type, career_min, career_max = _career_summary(positions)
    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status=status,
        description_html=description_html,
        description_text=(
            structured_plain_text(description_html)
            if description_html
            else _unique_join(_position_labels(positions), " · ") or ""
        ),
        employment_type=_employment_summary(positions),
        career_type=career_type,
        career_min=career_min,
        career_max=career_max,
        location=_location_summary(positions),
        opens_at=opens_at,
        closes_at=closes_at,
    )


def parse_liner_listing_openings(
    raw_html: str,
    listing_url: str,
) -> list[ParsedOpening]:
    _validate_listing_url(listing_url)
    rows = _query_data(raw_html, ["careers", "getOpenings"])
    if not isinstance(rows, list) or not rows:
        raise ValueError("Liner careers openings are missing")

    openings: list[ParsedOpening] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Liner careers contains an invalid opening")
        raw_external_id = row.get("id")
        external_id = (
            str(raw_external_id)
            if isinstance(raw_external_id, int)
            and not isinstance(raw_external_id, bool)
            else None
        )
        title = _text(row.get("title"))
        if external_id is None or title is None:
            raise ValueError("Liner opening identity is missing")
        if external_id in seen:
            raise ValueError("Liner careers contains a duplicate opening")
        seen.add(external_id)
        positions = _positions(row)
        if row.get("activatedAtCareerPage") is not True or not is_technical_role(
            title,
            *_position_labels(positions),
        ):
            continue
        openings.append(
            _opening_from_payload(
                row,
                external_id=external_id,
                title=title,
                url=f"{LINER_LISTING_URL}/{external_id}",
                status="open",
                description_html="",
                opens_at=None,
                closes_at=_parse_datetime(row.get("dueDate")),
            )
        )
    return openings


def parse_liner_detail_opening(
    raw_html: str,
    detail_url: str,
    listing_opening: ParsedOpening,
) -> ParsedOpening:
    parsed = urlsplit(detail_url)
    external_id = parsed.path.rstrip("/").rsplit("/", 1)[-1]
    if (
        parsed.scheme != "https"
        or parsed.hostname != "liner.com"
        or not parsed.path.startswith("/careers/jobs/")
        or external_id != listing_opening.external_id
    ):
        raise ValueError("Liner detail URL does not match its listing")

    payload = _query_data(
        raw_html,
        ["careers", "getOpeningDetail", external_id],
    )
    if not isinstance(payload, dict):
        raise ValueError("Liner opening detail is missing")
    info = payload.get("openingInfo")
    if not isinstance(info, dict):
        raise ValueError("Liner opening info is missing")
    raw_opening_id = info.get("openingId")
    opening_id = (
        str(raw_opening_id)
        if isinstance(raw_opening_id, int)
        and not isinstance(raw_opening_id, bool)
        else None
    )
    title = _text(info.get("title"))
    description_html = _text(info.get("detail"))
    if (
        opening_id != external_id
        or title != listing_opening.title
        or description_html is None
    ):
        raise ValueError("Liner opening detail identity or content does not match")

    return _opening_from_payload(
        payload,
        external_id=external_id,
        title=title,
        url=detail_url,
        status="open" if info.get("deploy") is True else "closed",
        description_html=description_html,
        opens_at=_parse_datetime(info.get("openDate")),
        closes_at=_parse_datetime(info.get("dueDate")),
    )
