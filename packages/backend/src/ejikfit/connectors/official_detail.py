from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping
from urllib.parse import urlsplit

from ejikfit.connectors.line_gatsby import parse_line_gatsby_detail_opening
from ejikfit.connectors.naver import parse_naver_detail_opening
from ejikfit.connectors.types import ParsedOpening


NAVER_DETAIL_FAMILIES = frozenset(
    {
        "naver_company_json_tech",
        "naver_webtoon_json_tech",
    }
)
LINE_DETAIL_FAMILY = "line_gatsby"


@dataclass(frozen=True)
class OfficialDetailRequest:
    url: str
    method: str = "GET"
    json_body: Mapping[str, Any] | None = None
    headers: Mapping[str, str] | None = None


def official_detail_request(
    connector_family: str | None,
    listing_url: str,
    opening: ParsedOpening,
) -> OfficialDetailRequest | None:
    """Return the official detail request registered for a listing parser."""

    if connector_family in NAVER_DETAIL_FAMILIES:
        return OfficialDetailRequest(url=opening.url)
    if connector_family == LINE_DETAIL_FAMILY:
        listing = urlsplit(listing_url)
        opening_url = urlsplit(opening.url)
        if (
            listing.scheme != "https"
            or listing.hostname != "careers.linecorp.com"
            or listing.path.rstrip("/")
            != "/page-data/jobs/page-data.json"
            or opening_url.scheme != "https"
            or opening_url.hostname != "careers.linecorp.com"
            or opening_url.path.rstrip("/")
            != f"/ko/jobs/{opening.external_id}"
            or re.fullmatch(r"\d{1,12}", opening.external_id) is None
        ):
            raise ValueError("LINE detail URL identity is invalid")
        return OfficialDetailRequest(
            url=(
                "https://careers.linecorp.com/page-data/ko/jobs/"
                f"{opening.external_id}/page-data.json"
            )
        )
    return None


def parse_official_detail(
    raw_detail: str,
    response_url: str,
    connector_family: str | None,
    listing_url: str,
    listing_opening: ParsedOpening,
) -> ParsedOpening:
    """Parse a registered official detail response into one trusted opening."""

    if connector_family in NAVER_DETAIL_FAMILIES:
        return parse_naver_detail_opening(
            raw_detail,
            response_url,
            listing_opening,
        )
    if connector_family == LINE_DETAIL_FAMILY:
        request = official_detail_request(
            connector_family,
            listing_url,
            listing_opening,
        )
        if request is None or response_url != request.url:
            raise ValueError("LINE detail response URL is invalid")
        return parse_line_gatsby_detail_opening(
            raw_detail,
            response_url,
            listing_opening,
        )
    raise ValueError(
        f"Official detail parser is not registered for {connector_family}"
    )
