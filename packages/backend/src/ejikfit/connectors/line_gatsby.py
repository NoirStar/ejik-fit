import json
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from ejikfit.connectors.types import ParsedOpening


KST = ZoneInfo("Asia/Seoul")


def _parse_date(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").replace(tzinfo=KST)
    except ValueError:
        return None


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _names(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    names: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            names.append(item.strip())
        elif isinstance(item, dict):
            name = _text(item.get("name") or item.get("title"))
            if name:
                names.append(name)
    return list(dict.fromkeys(names))


def _unique_join(values: list[str]) -> str:
    return " ".join(dict.fromkeys(value for value in values if value))


def _edges(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        raise ValueError("LINE Gatsby page data must be an object")

    try:
        candidate = data["result"]["data"]["allStrapiJobs"]["edges"]
    except (KeyError, TypeError) as exc:
        raise ValueError("LINE Gatsby jobs edges are missing") from exc

    if not isinstance(candidate, list):
        raise ValueError("LINE Gatsby jobs edges must be a list")
    return [item for item in candidate if isinstance(item, dict)]


def _public_node(edge: dict[str, Any]) -> dict[str, Any] | None:
    node = edge.get("node")
    if not isinstance(node, dict):
        return None
    if node.get("publish") is not True:
        return None
    if node.get("is_public") is False or node.get("is_filters_public") is False:
        return None
    return node


def parse_line_gatsby_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    data = json.loads(raw_json)
    openings: list[ParsedOpening] = []

    for edge in _edges(data):
        node = _public_node(edge)
        if node is None:
            continue

        external_id = node.get("strapiId")
        title = _text(node.get("title"))
        if external_id is None or title is None:
            continue

        employment_type = ", ".join(_names(node.get("employment_type"))) or None
        locations = _names(node.get("cities")) + _names(node.get("regions"))
        description_text = _unique_join(
            _names(node.get("job_unit"))
            + _names(node.get("job_fields"))
            + _names(node.get("companies"))
            + locations
        )

        openings.append(
            ParsedOpening(
                external_id=str(external_id),
                url=f"https://careers.linecorp.com/ko/jobs/{external_id}",
                title=title,
                status="open",
                description_html="",
                description_text=description_text,
                employment_type=employment_type,
                career_type=None,
                career_min=None,
                career_max=None,
                location=", ".join(locations) or None,
                opens_at=_parse_date(node.get("start_date")),
                closes_at=(
                    None
                    if node.get("until_filled") is True
                    else _parse_date(node.get("end_date"))
                ),
            )
        )

    return openings
