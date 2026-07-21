from __future__ import annotations

import re
from dataclasses import replace
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.jsonld import parse_jsonld_openings
from ejikfit.connectors.technical_roles import is_technical_role
from ejikfit.connectors.types import ParsedOpening


_BREEZY_ID_PATTERN = re.compile(r"^/p/(?P<id>[a-z0-9]{8,})(?:-|/|$)", re.I)
_KOREA_LOCATION_PATTERN = re.compile(r"(?:^|[\s,])KR(?:$|[\s,])", re.I)
_KOREA_LOCATION_MARKERS = (
    "korea",
    "대한민국",
    "서울",
    "seoul",
    "창원",
    "changwon",
    "판교",
    "pangyo",
    "성남",
    "seongnam",
    "수원",
    "suwon",
    "대전",
    "daejeon",
    "부산",
    "busan",
)


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _meta_text(row: Tag, class_name: str) -> str | None:
    node = row.select_one(f".meta .{class_name}")
    if not isinstance(node, Tag):
        return None
    values = [
        _clean_text(span.get_text(" ", strip=True))
        for span in node.find_all("span")
        if isinstance(span, Tag)
        and (text := _clean_text(span.get_text(" ", strip=True)))
        and not text.startswith("%")
    ]
    if not values:
        value = _clean_text(node.get_text(" ", strip=True))
        return value if value and not value.startswith("%") else None
    return " ".join(dict.fromkeys(values))


def _is_domestic_location(value: str | None) -> bool:
    normalized = (value or "").casefold()
    return bool(_KOREA_LOCATION_PATTERN.search(value or "")) or any(
        marker in normalized for marker in _KOREA_LOCATION_MARKERS
    )


def _external_id_from_url(value: str) -> str | None:
    match = _BREEZY_ID_PATTERN.match(urlparse(value).path)
    return match.group("id") if match is not None else None


def _career_type(title: str) -> str | None:
    normalized = title.casefold()
    has_newcomer = any(marker in normalized for marker in ("신입", "junior", "intern"))
    has_experienced = any(
        marker in normalized for marker in ("경력", "senior", "staff", "lead")
    )
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def parse_breezy_listing_openings(
    html: str,
    listing_url: str,
) -> list[ParsedOpening]:
    soup = BeautifulSoup(html, "lxml")
    if soup.select_one(".positions-container") is None:
        raise ValueError("Breezy listing does not contain a positions container")
    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()

    for row in soup.select("li.position"):
        if not isinstance(row, Tag):
            continue
        link = row.select_one("a[href]")
        title_node = row.select_one("h2")
        if not isinstance(link, Tag) or not isinstance(title_node, Tag):
            continue
        href = str(link.get("href") or "").strip()
        url = urljoin(listing_url, href)
        external_id = _external_id_from_url(url)
        title = _clean_text(title_node.get_text(" ", strip=True))
        location = _meta_text(row, "location")
        department = _meta_text(row, "department")
        if (
            not external_id
            or external_id in seen_ids
            or not title
            or not _is_domestic_location(location)
            or not is_technical_role(title, department)
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
                description_text=department or "",
                employment_type=_meta_text(row, "type"),
                career_type=_career_type(title),
                career_min=None,
                career_max=None,
                location=location,
                opens_at=None,
                closes_at=None,
            )
        )

    return openings


def parse_breezy_detail_opening(
    html: str,
    page_url: str,
    listing_opening: ParsedOpening,
) -> ParsedOpening:
    page_external_id = _external_id_from_url(page_url)
    if page_external_id != listing_opening.external_id:
        raise ValueError("Breezy detail URL does not match its listing job")

    candidates = parse_jsonld_openings(html, page_url)
    if not candidates:
        raise ValueError("Breezy detail does not contain JobPosting JSON-LD")
    candidate = next(
        (
            opening
            for opening in candidates
            if opening.title.casefold() == listing_opening.title.casefold()
        ),
        candidates[0],
    )
    if not candidate.description_text:
        raise ValueError("Breezy JobPosting description is empty")

    return replace(
        candidate,
        external_id=listing_opening.external_id,
        url=page_url,
        title=listing_opening.title,
        employment_type=(
            candidate.employment_type or listing_opening.employment_type
        ),
        career_type=candidate.career_type or listing_opening.career_type,
        location=candidate.location or listing_opening.location,
    )
