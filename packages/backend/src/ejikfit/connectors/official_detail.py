from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping
from urllib.parse import parse_qs, urlsplit

from ejikfit.connectors.enterprise_detail import (
    enterprise_detail_request,
    parse_enterprise_detail,
)
from ejikfit.connectors.line_gatsby import parse_line_gatsby_detail_opening
from ejikfit.connectors.naver import parse_naver_detail_opening
from ejikfit.connectors.types import ParsedOpening


NAVER_DETAIL_FAMILIES = frozenset(
    {
        "naver_company_json_tech",
        "naver_webtoon_json_tech",
    }
)
NAVER_DETAIL_HOSTS = frozenset(
    {
        "recruit.kreamcorp.com",
        "recruit.navercorp.com",
        "recruit.webtoonscorp.com",
    }
)
LINE_DETAIL_FAMILY = "line_gatsby"


@dataclass(frozen=True)
class OfficialDetailRequest:
    url: str
    method: str = "GET"
    json_body: Mapping[str, Any] | None = None
    headers: Mapping[str, str] | None = None


def _validate_naver_detail_url(
    listing_url: str,
    detail_url: str,
    external_id: str,
) -> None:
    try:
        listing = urlsplit(listing_url)
        detail = urlsplit(detail_url)
        detail_identity = parse_qs(detail.query).get("annoId")
        valid = (
            listing.scheme == "https"
            and listing.hostname in NAVER_DETAIL_HOSTS
            and listing.path.rstrip("/") == "/rcrt/loadJobList.do"
            and listing.username is None
            and listing.password is None
            and listing.port is None
            and detail.scheme == "https"
            and detail.hostname == listing.hostname
            and detail.path.rstrip("/") == "/rcrt/view.do"
            and detail.username is None
            and detail.password is None
            and detail.port is None
            and not detail.fragment
            and re.fullmatch(r"\d{1,12}", external_id) is not None
            and detail_identity == [external_id]
        )
    except (TypeError, ValueError):
        valid = False
    if not valid:
        raise ValueError("NAVER detail URL identity is invalid")


def official_detail_request(
    connector_family: str | None,
    listing_url: str,
    opening: ParsedOpening,
) -> OfficialDetailRequest | None:
    """Return the official detail request registered for a listing parser."""

    if connector_family in NAVER_DETAIL_FAMILIES:
        _validate_naver_detail_url(
            listing_url,
            opening.url,
            opening.external_id,
        )
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
    enterprise_request = enterprise_detail_request(
        connector_family,
        listing_url,
        opening,
    )
    if enterprise_request is not None:
        return OfficialDetailRequest(
            url=enterprise_request.url,
            method=enterprise_request.method,
            json_body=enterprise_request.json_body,
            headers=enterprise_request.headers,
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
        try:
            _validate_naver_detail_url(
                listing_url,
                response_url,
                listing_opening.external_id,
            )
        except ValueError as error:
            raise ValueError(
                "NAVER detail response URL is invalid"
            ) from error
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
    enterprise_request = enterprise_detail_request(
        connector_family,
        listing_url,
        listing_opening,
    )
    if enterprise_request is not None:
        return parse_enterprise_detail(
            raw_detail,
            response_url,
            connector_family,
            listing_url,
            listing_opening,
        )
    raise ValueError(
        f"Official detail parser is not registered for {connector_family}"
    )
