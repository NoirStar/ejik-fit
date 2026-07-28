from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from ejikfit.connectors.naver import parse_naver_detail_opening
from ejikfit.connectors.types import ParsedOpening


NAVER_DETAIL_FAMILIES = frozenset(
    {
        "naver_company_json_tech",
        "naver_webtoon_json_tech",
    }
)


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

    del listing_url
    if connector_family in NAVER_DETAIL_FAMILIES:
        return OfficialDetailRequest(url=opening.url)
    return None


def parse_official_detail(
    raw_detail: str,
    response_url: str,
    connector_family: str | None,
    listing_url: str,
    listing_opening: ParsedOpening,
) -> ParsedOpening:
    """Parse a registered official detail response into one trusted opening."""

    del listing_url
    if connector_family in NAVER_DETAIL_FAMILIES:
        return parse_naver_detail_opening(
            raw_detail,
            response_url,
            listing_opening,
        )
    raise ValueError(
        f"Official detail parser is not registered for {connector_family}"
    )
