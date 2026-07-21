from __future__ import annotations

import re
from dataclasses import replace
from datetime import datetime
from html import unescape
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.jsonld import parse_jsonld_openings
from ejikfit.connectors.technical_roles import is_korea_technical_role
from ejikfit.connectors.types import ParsedOpening


SYNOPSYS_CONNECTOR_FAMILY = "synopsys_talentbrew_korea_tech"
KST = ZoneInfo("Asia/Seoul")
POSTED_DATE_PATTERN = re.compile(
    r"(?P<month>\d{1,2})\s*[./-]\s*(?P<day>\d{1,2})\s*[./-]\s*"
    r"(?P<year>20\d{2})"
)
EXPERIENCE_RANGE_PATTERN = re.compile(
    r"(?<!\d)(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:\+\s*)?years?",
    re.IGNORECASE,
)
EXPERIENCE_PLUS_PATTERN = re.compile(
    r"(?<!\d)(\d{1,2})\s*\+\s*years?",
    re.IGNORECASE,
)


def _text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = " ".join(unescape(value).split())
    return normalized or None


def _posted_at(value: str) -> datetime | None:
    match = POSTED_DATE_PATTERN.search(value)
    if match is None:
        return None
    return datetime(
        int(match.group("year")),
        int(match.group("month")),
        int(match.group("day")),
        tzinfo=KST,
    )


def _external_id(link: Tag, url: str) -> str | None:
    value = _text(link.get("data-job-id"))
    if value is not None:
        return value
    tail = urlparse(url).path.rstrip("/").rsplit("/", maxsplit=1)[-1]
    return tail if tail.isdigit() else None


def parse_synopsys_korea_listing_openings(
    html: str,
    page_url: str,
) -> list[ParsedOpening]:
    soup = BeautifulSoup(html, "lxml")
    results = soup.select_one("section#search-results")
    if not isinstance(results, Tag):
        raise ValueError("Synopsys search results container is missing")

    raw_total = _text(results.get("data-total-job-results"))
    try:
        expected_total = int(raw_total) if raw_total is not None else None
    except ValueError as error:
        raise ValueError("Synopsys search result count is invalid") from error
    if expected_total is None:
        raise ValueError("Synopsys search result count is missing")

    links = [
        link
        for link in results.select("#search-results-list a.sr-job-link[href]")
        if isinstance(link, Tag)
    ]
    if len(links) != expected_total:
        raise ValueError(
            "Synopsys listing is incomplete: "
            f"expected {expected_total}, found {len(links)}"
        )

    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()
    for link in links:
        title_node = link.select_one("h2")
        location_node = link.select_one(".job-location")
        raw_url = _text(link.get("href"))
        title = (
            _text(title_node.get_text(" ", strip=True))
            if isinstance(title_node, Tag)
            else None
        )
        location = (
            _text(location_node.get_text(" ", strip=True))
            if isinstance(location_node, Tag)
            else None
        )
        if title is None or location is None or raw_url is None:
            raise ValueError("Synopsys listing contains an incomplete job row")

        url = urljoin(page_url, raw_url)
        external_id = _external_id(link, url)
        if external_id is None:
            raise ValueError("Synopsys listing job id is missing")
        if external_id in seen_ids:
            raise ValueError("Synopsys listing repeated a job id")
        seen_ids.add(external_id)

        if not is_korea_technical_role(title, location):
            continue

        description_text = _text(link.get_text(" ", strip=True)) or title
        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=url,
                title=title,
                status="open",
                description_html="",
                description_text=description_text,
                employment_type=None,
                career_type=None,
                career_min=None,
                career_max=None,
                location=location,
                opens_at=_posted_at(description_text),
                closes_at=None,
            )
        )

    return openings


def _experience_bounds(text: str) -> tuple[int | None, int | None]:
    ranges = [
        (int(match.group(1)), int(match.group(2)))
        for match in EXPERIENCE_RANGE_PATTERN.finditer(text)
    ]
    minimums = [lower for lower, _ in ranges]
    maximums = [upper for _, upper in ranges]
    plus_values = [
        int(match.group(1))
        for match in EXPERIENCE_PLUS_PATTERN.finditer(text)
    ]
    minimums.extend(plus_values)
    return (
        min(minimums) if minimums else None,
        None if plus_values else (max(maximums) if maximums else None),
    )


def parse_synopsys_detail_opening(
    html: str,
    page_url: str,
    listing: ParsedOpening,
) -> ParsedOpening:
    candidates = parse_jsonld_openings(html, page_url)
    matching = next(
        (
            candidate
            for candidate in candidates
            if candidate.title.casefold() == listing.title.casefold()
            or candidate.url.rstrip("/") == listing.url.rstrip("/")
        ),
        None,
    )
    if matching is None:
        raise ValueError("Synopsys detail JobPosting metadata is missing")

    career_min, career_max = _experience_bounds(matching.description_text)
    career_type = matching.career_type
    if career_type is None and career_min is not None:
        career_type = "experienced" if career_min > 0 else "new_comer"

    return replace(
        matching,
        external_id=listing.external_id,
        url=listing.url,
        title=listing.title,
        location=matching.location or listing.location,
        career_type=career_type,
        career_min=career_min,
        career_max=career_max,
    )
