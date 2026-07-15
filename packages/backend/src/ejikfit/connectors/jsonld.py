import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Iterator

from bs4 import BeautifulSoup

from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


def _walk_json(value: Any) -> Iterator[dict[str, Any]]:
    if isinstance(value, list):
        for item in value:
            yield from _walk_json(item)
        return

    if not isinstance(value, dict):
        return

    yield value
    graph = value.get("@graph")
    if graph is not None:
        yield from _walk_json(graph)


def _is_job_posting(value: dict[str, Any]) -> bool:
    node_type = value.get("@type")
    if isinstance(node_type, str):
        return node_type == "JobPosting"
    return isinstance(node_type, list) and "JobPosting" in node_type


def _identifier(value: Any, page_url: str) -> str:
    if isinstance(value, str) and value:
        return value
    if isinstance(value, dict):
        for key in ("value", "name", "propertyID"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate:
                return candidate
    return hashlib.sha256(page_url.encode()).hexdigest()[:32]


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None and "T" not in value:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _career_type(title: str) -> str | None:
    has_newcomer = "신입" in title
    has_experienced = "경력" in title
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _employment_type(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        entries = list(
            dict.fromkeys(item for item in value if isinstance(item, str))
        )
        return ", ".join(entries) or None
    return None


def _location(value: Any) -> str | None:
    locations = value if isinstance(value, list) else [value]
    names: list[str] = []

    for location in locations:
        if not isinstance(location, dict):
            continue
        address = location.get("address")
        if isinstance(address, str):
            names.append(address)
            continue
        if not isinstance(address, dict):
            continue
        for key in ("addressLocality", "addressRegion", "streetAddress"):
            candidate = address.get(key)
            if isinstance(candidate, str) and candidate:
                names.append(candidate)
                break

    return ", ".join(dict.fromkeys(names)) or None


def _parse_job(node: dict[str, Any], page_url: str) -> ParsedOpening | None:
    title = node.get("title")
    if not isinstance(title, str) or not title:
        return None

    canonical_url = node.get("url")
    if not isinstance(canonical_url, str) or not canonical_url:
        canonical_url = page_url

    description = node.get("description")
    description_html = description if isinstance(description, str) else ""
    description_text = structured_plain_text(description_html)

    return ParsedOpening(
        external_id=_identifier(node.get("identifier"), canonical_url),
        url=canonical_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_text,
        employment_type=_employment_type(node.get("employmentType")),
        career_type=_career_type(title),
        career_min=None,
        career_max=None,
        location=_location(node.get("jobLocation")),
        opens_at=_parse_datetime(node.get("datePosted")),
        closes_at=_parse_datetime(node.get("validThrough")),
    )


def parse_jsonld_openings(html: str, page_url: str) -> list[ParsedOpening]:
    soup = BeautifulSoup(html, "lxml")
    openings: list[ParsedOpening] = []

    for script in soup.find_all("script", type="application/ld+json"):
        raw_json = script.string
        if not raw_json:
            continue
        try:
            data = json.loads(raw_json)
        except json.JSONDecodeError:
            continue

        for node in _walk_json(data):
            if not _is_job_posting(node):
                continue
            opening = _parse_job(node, page_url)
            if opening is not None:
                openings.append(opening)

    return openings
