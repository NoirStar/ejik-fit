import re
from datetime import datetime
from html import escape
from typing import Any
from urllib.parse import urljoin, urlsplit

from ejikfit.connectors.next_data import extract_next_data
from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


LABLUP_TECH_CATEGORY_IDS = {
    "CORE",
    "FRONTEND",
    "RESEARCH",
    "SOLUTION",
    "TRP",
    "software-engineer",
}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _career_type(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    label = " ".join(
        part
        for part in (_text(value.get("id")), _text(value.get("name")))
        if part is not None
    ).casefold()
    if "신입" in label or "newbie" in label or "junior" in label:
        return "new_comer"
    if "경력" in label or "experienced" in label or "senior" in label:
        return "experienced"
    return None


def _listing_page_props(raw_html: str) -> dict[str, Any]:
    page_props = extract_next_data(raw_html).get("props", {}).get(
        "pageProps"
    )
    if not isinstance(page_props, dict) or page_props.get("locale") != "ko":
        raise ValueError("Lablup Korean careers page data is missing")
    return page_props


def _validate_listing_url(listing_url: str) -> None:
    parsed = urlsplit(listing_url)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "www.lablup.com"
        or parsed.path.rstrip("/") != "/ko/careers"
    ):
        raise ValueError("Lablup listing URL must be its official Korean page")


def parse_lablup_listing_openings(
    raw_html: str,
    listing_url: str,
) -> list[ParsedOpening]:
    _validate_listing_url(listing_url)
    positions = _listing_page_props(raw_html).get("positions")
    if not isinstance(positions, dict):
        raise ValueError("Lablup careers positions are missing")
    meta = positions.get("meta")
    rows = positions.get("contents")
    if not isinstance(meta, dict) or not isinstance(rows, list):
        raise ValueError("Lablup careers positions page is incomplete")
    total = meta.get("total")
    slice_number = meta.get("sliceNumber")
    if (
        isinstance(total, bool)
        or not isinstance(total, int)
        or total != len(rows)
        or isinstance(slice_number, bool)
        or not isinstance(slice_number, int)
        or slice_number < len(rows)
    ):
        raise ValueError("Lablup careers positions response is incomplete")

    openings: list[ParsedOpening] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Lablup careers contains an invalid position")
        external_id = _text(row.get("positionId"))
        title = _text(row.get("title"))
        category = row.get("category")
        category_name = (
            _text(category.get("name")) if isinstance(category, dict) else None
        )
        category_id = (
            _text(category.get("categoryId"))
            if isinstance(category, dict)
            else None
        )
        if (
            external_id is None
            or re.fullmatch(r"[A-Za-z0-9_-]{3,120}", external_id) is None
            or title is None
            or category_name is None
            or category_id is None
        ):
            raise ValueError("Lablup open position identity is missing")
        if external_id in seen:
            raise ValueError("Lablup careers contains a duplicate position")
        seen.add(external_id)
        if category_id not in LABLUP_TECH_CATEGORY_IDS:
            continue
        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=urljoin(listing_url.rstrip("/") + "/", external_id),
                title=title,
                status="open",
                description_html="",
                description_text=category_name,
                employment_type=None,
                career_type=_career_type(row.get("experienced")),
                career_min=None,
                career_max=None,
                location=None,
                opens_at=None,
                closes_at=None,
            )
        )
    return openings


def _career_minimum(description_text: str) -> int | None:
    for pattern in (
        r"(\d+)\s*년\s*이상",
        r"(\d+)\+?\s*years?",
    ):
        match = re.search(pattern, description_text, flags=re.IGNORECASE)
        if match is not None:
            return int(match.group(1))
    return None


def _parse_datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def parse_lablup_detail_opening(
    raw_html: str,
    detail_url: str,
    listing_opening: ParsedOpening,
) -> ParsedOpening:
    parsed_url = urlsplit(detail_url)
    if (
        parsed_url.scheme != "https"
        or parsed_url.hostname != "www.lablup.com"
        or not parsed_url.path.startswith("/ko/careers/")
        or parsed_url.path.rstrip("/").rsplit("/", 1)[-1]
        != listing_opening.external_id
    ):
        raise ValueError("Lablup detail URL does not match its listing")

    detail = _listing_page_props(raw_html).get("positionDetail")
    if not isinstance(detail, dict):
        raise ValueError("Lablup position detail is missing")
    external_id = _text(detail.get("positionId"))
    title = _text(detail.get("title"))
    if (
        external_id != listing_opening.external_id
        or title != listing_opening.title
    ):
        raise ValueError("Lablup position detail identity does not match")

    raw_sections = detail.get("jobDescriptions")
    if not isinstance(raw_sections, list) or not raw_sections:
        raise ValueError("Lablup position detail content is missing")
    sections: list[str] = []
    for raw_section in raw_sections:
        if not isinstance(raw_section, dict):
            raise ValueError("Lablup position detail section is invalid")
        heading = _text(raw_section.get("title"))
        body = _text(raw_section.get("body"))
        if heading is None or body is None:
            raise ValueError("Lablup position detail section is incomplete")
        sections.append(
            f"<section><h3>{escape(heading)}</h3>"
            f"<p>{escape(body).replace(chr(10), '<br>')}</p></section>"
        )
    description_html = "".join(sections)
    description_text = structured_plain_text(description_html)
    career_min = _career_minimum(description_text)
    return ParsedOpening(
        external_id=external_id,
        url=detail_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_text,
        employment_type=None,
        career_type=(
            _career_type(detail.get("experienced"))
            or listing_opening.career_type
        ),
        career_min=career_min,
        career_max=None,
        location=None,
        opens_at=_parse_datetime(detail.get("datePosted")),
        closes_at=None,
    )
