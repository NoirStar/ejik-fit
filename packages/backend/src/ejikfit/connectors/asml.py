from __future__ import annotations

import re
from datetime import datetime
from html import unescape
from typing import Any
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.next_data import extract_next_data
from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


ASML_CONNECTOR_FAMILY = "asml_sitecore_browser_korea_tech"
KST = ZoneInfo("Asia/Seoul")
EXPERIENCE_RANGE_PATTERN = re.compile(r"(\d+)\s*[-–]\s*(\d+)")
EXPERIENCE_PLUS_PATTERN = re.compile(r"(\d+)\s*\+")
JOB_ID_PATTERN = re.compile(r"j-?(\d{8})", re.IGNORECASE)


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = " ".join(unescape(value).split())
    return normalized or None


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for item in value if (text := _text(item)) is not None]


def _job_id(card: Tag, url: str) -> str | None:
    id_node = card.select_one("[data-job-id]")
    if isinstance(id_node, Tag):
        external_id = _text(id_node.get("data-job-id"))
        if external_id is not None:
            return external_id.upper()
    match = JOB_ID_PATTERN.search(url)
    return f"J-{match.group(1)}" if match is not None else None


def parse_asml_korea_listing_openings(
    html: str,
    page_url: str,
) -> list[ParsedOpening]:
    soup = BeautifulSoup(html, "lxml")
    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()

    for card in soup.select("a.search-results__item[href]"):
        if not isinstance(card, Tag):
            continue
        title_node = card.select_one(".search-results-title-text")
        title = _text(title_node.get_text(" ", strip=True)) if title_node else None
        raw_url = _text(card.get("href"))
        if title is None or raw_url is None:
            continue
        url = urljoin(page_url, raw_url)
        external_id = _job_id(card, url)
        fields = [
            text
            for node in card.select(".search-results__fields li")
            if (text := _text(node.get_text(" ", strip=True))) is not None
        ]
        location = fields[0] if fields else None
        if (
            external_id is None
            or external_id in seen_ids
            or location is None
            or "korea" not in location.casefold()
        ):
            continue
        seen_ids.add(external_id)
        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=url,
                title=title,
                status="open",
                description_html="",
                description_text=" · ".join([title, *fields]),
                employment_type=None,
                career_type=None,
                career_min=None,
                career_max=None,
                location=location,
                opens_at=None,
                closes_at=None,
            )
        )

    return openings


def _parse_date(value: Any) -> datetime | None:
    text = _text(value)
    if text is None:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=KST)


def _experience_bounds(values: list[str]) -> tuple[int | None, int | None]:
    lower_bounds: list[int] = []
    upper_bounds: list[int] = []
    has_open_upper_bound = False
    for value in values:
        range_match = EXPERIENCE_RANGE_PATTERN.search(value)
        if range_match is not None:
            lower_bounds.append(int(range_match.group(1)))
            upper_bounds.append(int(range_match.group(2)))
            continue
        plus_match = EXPERIENCE_PLUS_PATTERN.search(value)
        if plus_match is not None:
            lower_bounds.append(int(plus_match.group(1)))
            has_open_upper_bound = True
    return (
        min(lower_bounds) if lower_bounds else None,
        None
        if has_open_upper_bound
        else (max(upper_bounds) if upper_bounds else None),
    )


def _career_type(
    experience_levels: list[str],
    career_min: int | None,
) -> str | None:
    normalized = " ".join(experience_levels).casefold()
    newcomer = any(
        marker in normalized
        for marker in ("entry", "graduate", "intern", "student")
    )
    experienced = career_min is not None and career_min > 0
    if newcomer and experienced:
        return "mixed"
    if newcomer:
        return "new_comer"
    if experienced:
        return "experienced"
    return None


def _employment_type(job_type: Any, time_type: Any) -> str | None:
    normalized = " ".join(
        value for item in (job_type, time_type) if (value := _text(item))
    ).casefold()
    if "intern" in normalized:
        return "intern"
    if "contract" in normalized or "temporary" in normalized:
        return "contract"
    if "fix" in normalized or "full time" in normalized:
        return "regular"
    return None


def parse_asml_detail_opening(html: str, page_url: str) -> ParsedOpening:
    payload = extract_next_data(html)
    page_props = payload.get("props", {}).get("pageProps", {})
    job = page_props.get("jobData") if isinstance(page_props, dict) else None
    if not isinstance(job, dict):
        raise ValueError("ASML job data is missing")

    external_id = _text(job.get("id"))
    title = _text(job.get("displayJobTitle"))
    description_html = job.get("descriptionExternal")
    if (
        external_id is None
        or title is None
        or not isinstance(description_html, str)
        or not description_html.strip()
    ):
        raise ValueError("ASML job data is incomplete")

    experience_levels = _string_list(job.get("experienceLevel"))
    career_min, career_max = _experience_bounds(experience_levels)
    programming_languages = _string_list(job.get("programmingLanguages"))
    technical_fields = _string_list(job.get("technicalField"))
    teams = _string_list(job.get("team"))
    description_parts = [structured_plain_text(description_html)]
    if programming_languages:
        description_parts.append(
            f"Programming languages: {', '.join(programming_languages)}"
        )
    if technical_fields:
        description_parts.append(
            f"Technical fields: {', '.join(technical_fields)}"
        )
    if teams:
        description_parts.append(f"Teams: {', '.join(teams)}")

    return ParsedOpening(
        external_id=external_id,
        url=page_url,
        title=title,
        status=(
            "open"
            if (_text(job.get("status")) or "").casefold() == "open"
            else "closed"
        ),
        description_html=description_html,
        description_text="\n".join(part for part in description_parts if part),
        employment_type=_employment_type(
            job.get("jobType"),
            job.get("timeType"),
        ),
        career_type=_career_type(experience_levels, career_min),
        career_min=career_min,
        career_max=career_max,
        location=_text(job.get("location")),
        opens_at=_parse_date(job.get("datePosted")),
        closes_at=_parse_date(job.get("postingExpirationDate")),
    )
