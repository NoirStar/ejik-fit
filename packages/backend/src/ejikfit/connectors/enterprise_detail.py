from __future__ import annotations

import json
import re
from dataclasses import dataclass, replace
from html import escape, unescape
from typing import Any, Mapping
from urllib.parse import parse_qs, urlencode, urlsplit

from bs4 import BeautifulSoup
from bs4.element import Comment, NavigableString, Tag

from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text
from ejikfit.posting_content import require_substantive_posting_content


CJ_PROVIDER = "cj"
HYUNDAI_PROVIDER = "hyundai"
LG_PROVIDER = "lg"
HANWHA_PROVIDER = "hanwha"
SMILEGATE_PROVIDER = "smilegate"

LG_DETAIL_URL = (
    "https://api.careers.lg.com/rmk/job/retrieveJobNoticesDetail"
)
HANWHA_DETAIL_URL = (
    "https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/get-rcrt"
)


@dataclass(frozen=True)
class EnterpriseDetailRequest:
    provider: str
    url: str
    method: str = "GET"
    json_body: Mapping[str, Any] | None = None
    headers: Mapping[str, str] | None = None


def _url(value: str):
    try:
        return urlsplit(value)
    except ValueError as error:
        raise ValueError("Enterprise detail URL is not official") from error


def _query_value(value: str, name: str) -> str | None:
    values = parse_qs(_url(value).query).get(name)
    if values is None or len(values) != 1:
        return None
    return values[0]


def _provider(
    connector_family: str | None,
    listing_url: str,
) -> str | None:
    listing = _url(listing_url)
    if listing.scheme != "https":
        return None
    if connector_family == "enterprise_json":
        if (
            listing.hostname == "recruit.cj.net"
            and listing.path.endswith("/common/common/jobListInfo.fo")
        ):
            return CJ_PROVIDER
        if (
            listing.hostname == "talent.hyundai.com"
            and listing.path == "/api/rec/AP-HM-FO-02700"
        ):
            return HYUNDAI_PROVIDER
        if (
            listing.hostname == "api.careers.lg.com"
            and listing.path == "/rmk/job/retrieveJobNoticesList"
        ):
            return LG_PROVIDER
        if (
            listing.hostname == "hwadm.hanwhain.com"
            and listing.path.endswith("/rcRecruit/search-rcrt")
        ):
            return HANWHA_PROVIDER
    if (
        connector_family == "lg_careers_lguplus_tech"
        and listing.hostname == "api.careers.lg.com"
        and listing.path == "/rmk/job/retrieveJobNoticesList"
    ):
        return LG_PROVIDER
    if (
        connector_family == "smilegate_api"
        and listing.hostname == "careers.smilegate.com"
        and listing.path.rstrip("/") == "/api/apply/announce/guest"
    ):
        return SMILEGATE_PROVIDER
    return None


def _validate_public_opening(
    provider: str,
    opening: ParsedOpening,
) -> dict[str, str]:
    parsed = _url(opening.url)
    if parsed.scheme != "https":
        raise ValueError("Enterprise opening URL is not official")

    if provider == CJ_PROVIDER:
        expected_path = (
            "/recruit/ko/recruit/recruit/detail.fo"
            if opening.external_id.isdigit()
            else "/recruit/ko/recruit/recruit/bestDetail.fo"
        )
        if (
            parsed.hostname != "recruit.cj.net"
            or parsed.path != expected_path
            or re.fullmatch(r"[A-Za-z0-9_-]{1,40}", opening.external_id)
            is None
            or _query_value(opening.url, "zz_jo_num")
            != opening.external_id
        ):
            raise ValueError("CJ opening URL is not official")
        return {"external_id": opening.external_id}

    if provider == HYUNDAI_PROVIDER:
        recu_yy = _query_value(opening.url, "recuYy")
        recu_type = _query_value(opening.url, "recuType")
        recu_cls = _query_value(opening.url, "recuCls")
        identity = f"{recu_yy}-{recu_type}-{recu_cls}"
        if (
            parsed.hostname != "talent.hyundai.com"
            or parsed.path != "/eng/apply/applyView.hc"
            or re.fullmatch(r"\d{4}", recu_yy or "") is None
            or re.fullmatch(r"[A-Za-z0-9]{1,12}", recu_type or "") is None
            or re.fullmatch(r"\d{1,12}", recu_cls or "") is None
            or identity != opening.external_id
        ):
            raise ValueError("Hyundai opening URL is not official")
        return {
            "recuYy": recu_yy or "",
            "recuType": recu_type or "",
            "recuCls": recu_cls or "",
        }

    if provider == LG_PROVIDER:
        if (
            parsed.hostname != "careers.lg.com"
            or parsed.path.rstrip("/") != "/apply/detail"
            or re.fullmatch(r"\d{1,12}", opening.external_id) is None
            or _query_value(opening.url, "id") != opening.external_id
        ):
            raise ValueError("LG opening URL is not official")
        return {"external_id": opening.external_id}

    if provider == HANWHA_PROVIDER:
        if (
            parsed.hostname != "www.hanwhain.com"
            or parsed.path.rstrip("/") != "/portal/apply/recruit/detail"
            or re.fullmatch(r"\d{1,12}", opening.external_id) is None
            or _query_value(opening.url, "rtSeq") != opening.external_id
        ):
            raise ValueError("Hanwha opening URL is not official")
        return {"external_id": opening.external_id}

    if provider == SMILEGATE_PROVIDER:
        if (
            parsed.hostname != "careers.smilegate.com"
            or parsed.path.rstrip("/") != "/apply/announce/view"
            or re.fullmatch(r"\d{1,12}", opening.external_id) is None
            or _query_value(opening.url, "seq") != opening.external_id
        ):
            raise ValueError("Smilegate opening URL is not official")
        return {"external_id": opening.external_id}

    raise ValueError("Enterprise detail provider is unsupported")


def enterprise_detail_request(
    connector_family: str | None,
    listing_url: str,
    opening: ParsedOpening,
) -> EnterpriseDetailRequest | None:
    provider = _provider(connector_family, listing_url)
    if provider is None:
        return None
    identity = _validate_public_opening(provider, opening)

    if provider == CJ_PROVIDER:
        return EnterpriseDetailRequest(provider=provider, url=opening.url)
    if provider == HYUNDAI_PROVIDER:
        detail_url = (
            "https://talent.hyundai.com/api/rec/AP-HM-FO-02800?"
            + urlencode(
                {
                    "hgrCd": "1",
                    "lang": "en",
                    **identity,
                }
            )
        )
        return EnterpriseDetailRequest(
            provider=provider,
            url=detail_url,
            headers={
                "Accept": "application/json, text/plain, */*",
                "Referer": opening.url,
                "X-HKMC-SERVICE": "HM",
                "X-HKMC-TOKEN": "null",
            },
        )
    if provider == LG_PROVIDER:
        return EnterpriseDetailRequest(
            provider=provider,
            url=LG_DETAIL_URL,
            method="POST",
            json_body={"jobNoticeId": opening.external_id},
        )
    if provider == HANWHA_PROVIDER:
        return EnterpriseDetailRequest(
            provider=provider,
            url=HANWHA_DETAIL_URL,
            method="POST",
            json_body={
                "rtSeq": int(opening.external_id),
                "hidnKey": None,
                "langCd": "ko",
            },
            headers={
                "Accept": "application/json",
                "Referer": "https://www.hanwhain.com/",
                "X-Menu-Path": "/apply/recruit/detail",
            },
        )
    if provider == SMILEGATE_PROVIDER:
        return EnterpriseDetailRequest(
            provider=provider,
            url=(
                "https://careers.smilegate.com/api/apply/announce/guest/"
                f"{opening.external_id}?type=finalSelect"
            ),
        )
    raise AssertionError("registered enterprise detail provider was not handled")


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = " ".join(unescape(value).split())
    return normalized or None


def _same_title(actual: Any, opening: ParsedOpening, provider: str) -> None:
    title = _text(actual)
    expected = _text(opening.title)
    if title is None:
        raise ValueError(f"{provider} detail title is missing")
    if title != expected:
        raise ValueError(f"{provider} detail title does not match its listing")


def _same_identity(actual: Any, opening: ParsedOpening, provider: str) -> None:
    if isinstance(actual, bool) or actual is None:
        raise ValueError(f"{provider} detail identity is missing")
    if str(actual) != opening.external_id:
        raise ValueError(f"{provider} detail identity does not match its listing")


def _json_object(raw: str, provider: str) -> dict[str, Any]:
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError(f"{provider} detail response must be an object")
    return data


def _fragment(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    decoded = value
    for _ in range(2):
        unwrapped = unescape(decoded)
        if unwrapped == decoded:
            break
        decoded = unwrapped

    soup = BeautifulSoup(decoded, "lxml")
    for node in soup.find_all(("script", "style", "noscript", "template")):
        node.decompose()
    root = soup.body or soup
    pieces: list[str] = []
    for child in root.children:
        if isinstance(child, Comment):
            continue
        if isinstance(child, Tag):
            pieces.append(str(child))
        elif isinstance(child, NavigableString):
            pieces.append(escape(str(child)))
    return "".join(pieces).strip()


def _section(label: str, value: Any, *, level: int = 2) -> str:
    content = _fragment(value)
    if not content or not structured_plain_text(content):
        return ""
    heading = min(max(level, 2), 4)
    return (
        f'<section><h{heading}>{escape(label)}</h{heading}>'
        f"{content}</section>"
    )


def _finish(
    opening: ParsedOpening,
    description_html: str,
    source_url: str,
) -> ParsedOpening:
    description_text = structured_plain_text(description_html)
    require_substantive_posting_content(
        description_html,
        description_text,
        source_url,
    )
    return replace(
        opening,
        description_html=description_html,
        description_text=description_text,
    )


def _validate_response_url(
    response_url: str,
    request: EnterpriseDetailRequest,
) -> None:
    actual = _url(response_url)
    expected = _url(request.url)
    if (
        actual.scheme != "https"
        or actual.hostname != expected.hostname
        or actual.path.rstrip("/") != expected.path.rstrip("/")
        or parse_qs(actual.query) != parse_qs(expected.query)
    ):
        raise ValueError(
            f"{request.provider} detail response identity is not official"
        )


def _parse_cj(raw: str, opening: ParsedOpening) -> ParsedOpening:
    soup = BeautifulSoup(raw, "lxml")
    title_node = soup.select_one(".detail-wrap .title")
    _same_title(
        title_node.get_text(" ", strip=True) if title_node else None,
        opening,
        "CJ",
    )
    boxes = [box for box in soup.select(".detail-wrap .detail-list") if box]
    if not boxes:
        raise ValueError("CJ detail content is missing")
    description_html = "".join(str(box) for box in boxes)
    return _finish(opening, description_html, opening.url)


def _parse_hyundai(raw: str, opening: ParsedOpening) -> ParsedOpening:
    data = _json_object(raw, "Hyundai")
    payload = data.get("data")
    info = payload.get("applyInfo") if isinstance(payload, dict) else None
    if not isinstance(info, dict):
        raise ValueError("Hyundai detail content is missing")
    identity = "-".join(
        str(info.get(key)) for key in ("recuYy", "recuType", "recuCls")
    )
    _same_identity(identity, opening, "Hyundai")
    _same_title(info.get("recuNoticeNm"), opening, "Hyundai")
    sections = "".join(
        (
            _section("팀 소개", info.get("aboutTeamNtc")),
            _section("직무 상세", info.get("privJdDtl")),
            _section("필수 요건", info.get("privMustReq")),
            _section("우대 요건", info.get("prefReq")),
        )
    )
    require_substantive_posting_content(
        sections,
        structured_plain_text(sections),
        opening.url,
    )
    description_html = sections + _section("기타", info.get("etc"))
    return _finish(opening, description_html, opening.url)


def _parse_lg(raw: str, opening: ParsedOpening) -> ParsedOpening:
    data = _json_object(raw, "LG")
    payload = data.get("data")
    bundle = (
        payload.get("jobNoticesDetail")
        if isinstance(payload, dict)
        else None
    )
    notice = (
        bundle.get("jobNoticesDetail")
        if isinstance(bundle, dict)
        else None
    )
    rows = bundle.get("recList") if isinstance(bundle, dict) else None
    if not isinstance(notice, dict) or not isinstance(rows, list):
        raise ValueError("LG detail content is missing")
    _same_identity(notice.get("jobNoticeId"), opening, "LG")
    _same_title(notice.get("jobNoticeName"), opening, "LG")

    role_sections: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        row_id = row.get("jobNoticeId")
        if row_id is not None and str(row_id) != opening.external_id:
            raise ValueError("LG detail identity does not match its listing")
        heading_parts = [
            value
            for value in (
                _text(row.get("orgName")),
                _text(row.get("jobGroupName")),
            )
            if value
        ]
        heading = " · ".join(dict.fromkeys(heading_parts)) or "모집 직무"
        content = "".join(
            (
                _section("직무 내용", row.get("detailContext"), level=3),
                _section("필수 요건", row.get("requiredItem"), level=3),
                _section("우대 사항", row.get("preferredItem"), level=3),
            )
        )
        if content:
            role_sections.append(
                f"<section><h2>{escape(heading)}</h2>{content}</section>"
            )
    role_html = "".join(role_sections)
    require_substantive_posting_content(
        role_html,
        structured_plain_text(role_html),
        opening.url,
    )
    common_html = "".join(
        (
            _section("지원 자격 및 안내", notice.get("qualForAppInfo")),
            _section("전형 절차", notice.get("recProcessInfo")),
            _section("지원 방법", notice.get("submitMethodInfo")),
            _section("기타 안내", notice.get("otherInfo")),
        )
    )
    return _finish(opening, role_html + common_html, opening.url)


def _parse_hanwha(raw: str, opening: ParsedOpening) -> ParsedOpening:
    data = _json_object(raw, "Hanwha")
    payload = data.get("data")
    item = payload.get("item") if isinstance(payload, dict) else None
    if not isinstance(item, dict):
        raise ValueError("Hanwha detail content is missing")
    _same_identity(item.get("rtSeq"), opening, "Hanwha")
    _same_title(item.get("rtNm"), opening, "Hanwha")
    rows = item.get("unitDt")
    if not isinstance(rows, list):
        raise ValueError("Hanwha detail units are missing")

    unit_sections: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        row_id = row.get("rtSeq")
        if row_id is not None and str(row_id) != opening.external_id:
            raise ValueError("Hanwha detail identity does not match its listing")
        label = _text(row.get("ruNm")) or "모집 직무"
        content = _fragment(row.get("ruDtlJob"))
        if not content:
            continue
        location = _text(row.get("ruWorkpl"))
        location_html = (
            f"<p>근무지: {escape(location)}</p>" if location else ""
        )
        unit_sections.append(
            f"<section><h2>{escape(label)}</h2>{content}{location_html}</section>"
        )
    units_html = "".join(unit_sections)
    require_substantive_posting_content(
        units_html,
        structured_plain_text(units_html),
        opening.url,
    )
    common_html = "".join(
        (
            _section("공통 자격", item.get("rtExmQlf")),
            _section("전형 절차", item.get("rtExmProc")),
            _section("지원 방법", item.get("rtRctPrd")),
            _section("기타 안내", item.get("rtEct")),
        )
    )
    return _finish(opening, units_html + common_html, opening.url)


def _parse_smilegate(raw: str, opening: ParsedOpening) -> ParsedOpening:
    data = _json_object(raw, "Smilegate")
    _same_identity(data.get("announceSeq"), opening, "Smilegate")
    _same_title(data.get("title"), opening, "Smilegate")
    role_html = "".join(
        (
            _section("담당 업무", data.get("workInfo")),
            _section("자격 요건", data.get("qualificationDesc")),
            _section("필요 역량", data.get("abilityDesc")),
            _section("우대 사항", data.get("specialDesc")),
        )
    )
    require_substantive_posting_content(
        role_html,
        structured_plain_text(role_html),
        opening.url,
    )
    description_html = role_html + _section(
        "기타 안내",
        data.get("description"),
    )
    return _finish(opening, description_html, opening.url)


def parse_enterprise_detail(
    raw: str,
    response_url: str,
    connector_family: str | None,
    listing_url: str,
    opening: ParsedOpening,
) -> ParsedOpening:
    request = enterprise_detail_request(
        connector_family,
        listing_url,
        opening,
    )
    if request is None:
        raise ValueError("Enterprise detail parser is not registered")
    _validate_response_url(response_url, request)

    if request.provider == CJ_PROVIDER:
        return _parse_cj(raw, opening)
    if request.provider == HYUNDAI_PROVIDER:
        return _parse_hyundai(raw, opening)
    if request.provider == LG_PROVIDER:
        return _parse_lg(raw, opening)
    if request.provider == HANWHA_PROVIDER:
        return _parse_hanwha(raw, opening)
    if request.provider == SMILEGATE_PROVIDER:
        return _parse_smilegate(raw, opening)
    raise AssertionError("registered enterprise detail parser was not handled")
