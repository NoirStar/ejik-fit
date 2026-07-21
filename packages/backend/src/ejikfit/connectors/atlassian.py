from __future__ import annotations

import json
from html import unescape
from typing import Any

from ejikfit.connectors.technical_roles import is_korea_technical_role
from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = " ".join(value.split())
    return normalized or None


def _career_type(title: str) -> str | None:
    normalized = title.casefold()
    has_newcomer = any(marker in normalized for marker in ("entry", "junior", "intern"))
    has_experienced = any(
        marker in normalized for marker in ("senior", "staff", "principal", "lead")
    )
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _description_html(item: dict[str, Any]) -> str:
    sections = (
        ("Overview", item.get("overview")),
        ("Responsibilities", item.get("responsibilities")),
        ("Qualifications", item.get("qualifications")),
    )
    return "".join(
        f"<h2>{heading}</h2>{value}"
        for heading, value in sections
        if isinstance(value, str) and value.strip()
    )


def parse_atlassian_korea_technical_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as error:
        raise ValueError("Atlassian careers payload is not valid JSON") from error
    if not isinstance(payload, list):
        raise ValueError("Atlassian careers payload must be a root array")

    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            continue
        posting_id = item.get("id")
        title = _text(item.get("title"))
        raw_locations = item.get("locations")
        locations = (
            [value for value in raw_locations if isinstance(value, str) and value.strip()]
            if isinstance(raw_locations, list)
            else []
        )
        location = ", ".join(dict.fromkeys(locations)) or None
        url = _text(item.get("applyUrl"))
        if url is None:
            portal_post = item.get("portalJobPost")
            if isinstance(portal_post, dict):
                url = _text(portal_post.get("portalUrl"))
        external_id = str(posting_id) if posting_id is not None else ""
        if (
            not external_id
            or external_id in seen_ids
            or title is None
            or url is None
            or not is_korea_technical_role(title, location)
        ):
            continue
        description_html = _description_html(item)
        if not description_html:
            continue
        seen_ids.add(external_id)
        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=url,
                title=unescape(title),
                status="open",
                description_html=description_html,
                description_text=structured_plain_text(description_html),
                employment_type=None,
                career_type=_career_type(title),
                career_min=None,
                career_max=None,
                location=location,
                opens_at=None,
                closes_at=None,
            )
        )

    return openings
