import json
import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

from ejikfit.connectors.next_data import extract_next_data
from ejikfit.models import SourceType


class ListingValidationError(ValueError):
    pass


JSON_SOURCE_TYPES = {
    SourceType.NAVER_JSON,
    SourceType.KAKAO_JSON,
    SourceType.LINE_GATSBY,
    SourceType.STATIC_NEXT_DATA,
    SourceType.ENTERPRISE_JSON,
    SourceType.LEVER_GREENHOUSE,
    SourceType.WORKDAY,
    SourceType.SAP_SUCCESSFACTORS,
}

COLLECTION_KEYS_BY_SOURCE = {
    SourceType.NAVER_JSON: {"list"},
    SourceType.KAKAO_JSON: {"jobList", "list"},
    SourceType.LINE_GATSBY: {"edges"},
    SourceType.STATIC_NEXT_DATA: {
        "announce",
        "data",
        "edges",
        "items",
        "jobList",
        "jobNoticeList",
        "jobPostings",
        "jobs",
        "list",
        "openings",
        "results",
    },
    SourceType.ENTERPRISE_JSON: {
        "announce",
        "data",
        "jobNoticeList",
        "jobs",
        "list",
        "recuList",
    },
    SourceType.LEVER_GREENHOUSE: {"jobs"},
    SourceType.WORKDAY: {"jobPostings", "jobs", "postings"},
    SourceType.SAP_SUCCESSFACTORS: {
        "jobRequisitions",
        "jobs",
        "results",
        "value",
    },
}
SINGLETON_KEYS_BY_SOURCE = {
    SourceType.WORKDAY: {"jobPostingInfo"},
}
ROOT_LIST_SOURCE_TYPES = {
    SourceType.NAVER_JSON,
    SourceType.KAKAO_JSON,
    SourceType.STATIC_NEXT_DATA,
    SourceType.ENTERPRISE_JSON,
    SourceType.LEVER_GREENHOUSE,
    SourceType.WORKDAY,
    SourceType.SAP_SUCCESSFACTORS,
}
TOTAL_KEYS = {
    "announcecount",
    "count",
    "listcnt",
    "total",
    "totalcount",
    "totaljobcount",
}
PAGE_SIZE_KEYS = {
    "limit",
    "pagesize",
    "pageblock",
    "perpage",
    "rowcount",
    "rowno",
    "size",
}
PAGE_KEYS = {
    "currentpage",
    "currentpageno",
    "currpage",
    "offset",
    "page",
    "pageindex",
    "pageno",
}
EMPTY_MARKERS = (
    "no current openings",
    "no job openings",
    "no jobs available",
    "no open positions",
    "등록된 채용공고가 없습니다",
    "진행 중인 공고가 없습니다",
    "진행중인 공고가 없습니다",
    "현재 채용 공고가 없습니다",
    "채용 공고가 없습니다",
    "채용공고가 없습니다",
    "곧 공개될 새로운 공고를 기대해 주세요",
)


def _decode_json_or_jsonp(raw: str) -> Any:
    stripped = raw.strip()
    if not stripped:
        raise ListingValidationError("listing payload is empty")
    if "__NEXT_DATA__" in stripped:
        return extract_next_data(stripped)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError as json_error:
        match = re.match(r"\s*[\w$.]+\((.*)\)\s*;?\s*$", stripped, re.DOTALL)
        if match is None:
            raise ListingValidationError(
                "listing payload is not valid JSON"
            ) from json_error
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError as nested_error:
            raise ListingValidationError(
                "listing JSONP payload is invalid"
            ) from nested_error


def _as_non_negative_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = int(str(value))
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _collection_parents(
    value: Any,
    source_type: SourceType,
    *,
    is_root: bool = True,
) -> list[tuple[Mapping[str, Any], list[Any]]]:
    parents: list[tuple[Mapping[str, Any], list[Any]]] = []
    if isinstance(value, list):
        if is_root and source_type in ROOT_LIST_SOURCE_TYPES:
            parents.append(({}, value))
        return parents
    if not isinstance(value, dict):
        return parents

    collection_keys = COLLECTION_KEYS_BY_SOURCE[source_type]
    singleton_keys = SINGLETON_KEYS_BY_SOURCE.get(source_type, set())
    for key, child in value.items():
        if key in collection_keys and isinstance(child, list):
            parents.append((value, child))
        elif key in singleton_keys and isinstance(child, dict):
            parents.append((value, [child]))
        else:
            parents.extend(
                _collection_parents(
                    child,
                    source_type,
                    is_root=False,
                )
            )
    return parents


def _normalized_mapping(value: Mapping[str, Any]) -> dict[str, Any]:
    return {str(key).lower(): child for key, child in value.items()}


def _envelope_mappings(data: Any) -> list[Mapping[str, Any]]:
    if not isinstance(data, dict):
        return []
    mappings: list[Mapping[str, Any]] = [data]
    for child in data.values():
        if isinstance(child, dict):
            mappings.extend(_envelope_mappings(child))
    return mappings


def _has_error_envelope(data: Any) -> bool:
    for mapping in _envelope_mappings(data):
        normalized = _normalized_mapping(mapping)
        for key in ("error", "errors", "errormessage", "error_message"):
            value = normalized.get(key)
            if value not in (None, False, "", [], {}):
                return True
        if any(
            normalized.get(key) is False
            for key in ("success", "issuccess", "result")
        ):
            return True
        success_value = normalized.get("successornot")
        if isinstance(success_value, str) and success_value.upper() not in {
            "Y",
            "YES",
            "SUCCESS",
            "TRUE",
        }:
            return True
        status_code = normalized.get("statuscode")
        numeric_status = _as_non_negative_int(status_code)
        if numeric_status is not None and 400 <= numeric_status <= 599:
            return True
        if isinstance(status_code, str):
            normalized_status = status_code.upper()
            if any(marker in normalized_status for marker in ("ERROR", "FAIL")):
                return True
        status = normalized.get("status")
        numeric_status = _as_non_negative_int(status)
        if numeric_status is not None and 400 <= numeric_status <= 599:
            return True
        if isinstance(status, str) and status.upper() in {
            "E",
            "ERROR",
            "F",
            "FAIL",
            "FAILED",
            "N",
        }:
            return True
        for message_key in ("message", "msg"):
            message = normalized.get(message_key)
            if isinstance(message, str) and any(
                marker in message.lower()
                for marker in (
                    "error",
                    "fail",
                    "maintenance",
                    "temporarily unavailable",
                    "오류",
                    "점검",
                )
            ):
                return True
    return False


def _has_explicit_json_empty_state(
    data: Any,
    source_type: SourceType,
    listing_url: str,
) -> bool:
    if data == [] and source_type in {
        SourceType.NAVER_JSON,
        SourceType.KAKAO_JSON,
        SourceType.LEVER_GREENHOUSE,
        SourceType.WORKDAY,
        SourceType.SAP_SUCCESSFACTORS,
    }:
        return True
    parsed_url = urlparse(listing_url)
    is_cj_listing = (
        source_type == SourceType.ENTERPRISE_JSON
        and parsed_url.hostname == "recruit.cj.net"
        and parsed_url.path.endswith("/common/common/jobListInfo.fo")
    )
    if is_cj_listing and isinstance(data, list):
        return True
    if _posco_listing_total(data, listing_url) == 0:
        return True

    semantic_collection_keys = {
        key.lower() for key in COLLECTION_KEYS_BY_SOURCE[source_type]
    }
    if source_type in {
        SourceType.ENTERPRISE_JSON,
        SourceType.STATIC_NEXT_DATA,
    }:
        semantic_collection_keys = set()
    for mapping in _envelope_mappings(data):
        normalized = _normalized_mapping(mapping)
        if any(
            isinstance(normalized.get(key), list) and not normalized[key]
            for key in semantic_collection_keys
        ):
            return True
        for key in TOTAL_KEYS | {"filteredcount"}:
            if _as_non_negative_int(normalized.get(key)) == 0:
                return True
        if any(
            normalized.get(key) is True
            for key in ("success", "issuccess", "result")
        ):
            return True
        success_value = normalized.get("successornot")
        if isinstance(success_value, str) and success_value.upper() in {
            "Y",
            "YES",
            "SUCCESS",
            "TRUE",
        }:
            return True
        status_code = normalized.get("statuscode")
        numeric_status = _as_non_negative_int(status_code)
        if numeric_status is not None and 200 <= numeric_status <= 299:
            return True
        if isinstance(status_code, str) and status_code.upper() in {
            "OK",
            "SUCCESS",
        }:
            return True
        status = normalized.get("status")
        numeric_status = _as_non_negative_int(status)
        if numeric_status is not None and 200 <= numeric_status <= 299:
            return True
        if isinstance(status, str) and status.upper() in {
            "OK",
            "S",
            "SUCCESS",
        }:
            return True
    return False


def _is_explicitly_inactive_item(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    normalized = _normalized_mapping(value)
    row_number = _as_non_negative_int(normalized.get("rnum"))
    active_count = _as_non_negative_int(normalized.get("active_cnt"))
    if (
        row_number is not None
        and active_count is not None
        and row_number > active_count
    ):
        return True
    if any(
        normalized.get(key) is False
        for key in (
            "active",
            "ispublic",
            "ispublished",
            "live",
            "public",
            "publish",
            "published",
        )
    ):
        return True
    if any(
        normalized.get(key) is True
        for key in (
            "closed",
            "closeflag",
            "expired",
            "hidden",
            "isclosed",
            "isexpired",
            "ishidden",
            "isprivate",
            "private",
        )
    ):
        return True
    return any(
        isinstance(status, str)
        and status.lower()
        in {
            "close",
            "closed",
            "end",
            "ended",
            "expired",
            "finish",
            "finished",
            "inactive",
            "마감",
        }
        for key in (
            "displaystatus",
            "noticestatus",
            "recruitstatus",
            "state",
            "status",
            "statuscode",
        )
        if (status := normalized.get(key)) is not None
    )


def _collections_are_explicitly_inactive(
    collections: list[tuple[Mapping[str, Any], list[Any]]],
) -> bool:
    items = [item for _, collection in collections for item in collection]
    return bool(items) and all(_is_explicitly_inactive_item(item) for item in items)


def _request_pagination(
    listing_url: str,
    request_body: Mapping[str, Any] | None,
) -> tuple[int | None, bool, bool]:
    values: list[int] = []
    query = {
        str(key).lower(): children
        for key, children in parse_qs(urlparse(listing_url).query).items()
    }
    normalized_body = (
        _normalized_mapping(request_body) if request_body is not None else {}
    )
    allow_one_based_page_index = _is_smilegate_listing(listing_url)
    for key in PAGE_SIZE_KEYS:
        for value in query.get(key, []):
            parsed = _as_non_negative_int(value)
            if parsed:
                values.append(parsed)
        parsed = _as_non_negative_int(normalized_body.get(key))
        if parsed:
            values.append(parsed)
    has_page_marker = any(key in query or key in normalized_body for key in PAGE_KEYS)
    non_initial_page = any(
        _is_non_initial_page_value(
            key,
            value,
            allow_one_based_page_index=allow_one_based_page_index,
        )
        for key in PAGE_KEYS
        for value in query.get(key, [])
    ) or any(
        _is_non_initial_page_value(
            key,
            normalized_body.get(key),
            allow_one_based_page_index=allow_one_based_page_index,
        )
        for key in PAGE_KEYS
        if key in normalized_body
    )
    return (min(values) if values else None, has_page_marker, non_initial_page)


def _is_smilegate_listing(listing_url: str) -> bool:
    parsed = urlparse(listing_url)
    return (
        parsed.hostname == "careers.smilegate.com"
        and parsed.path.rstrip("/") == "/api/apply/announce/guest"
    )


def _posco_listing_total(data: Any, listing_url: str) -> int | None:
    parsed = urlparse(listing_url)
    if (
        parsed.hostname != "recruit.posco.com"
        or parsed.path.rstrip("/") != "/h22a01-recruit/H22A1000/list"
        or not isinstance(data, dict)
    ):
        return None
    summary = data.get("summary")
    if not isinstance(summary, list):
        return None
    totals = [
        total
        for item in summary
        if isinstance(item, dict)
        if (total := _as_non_negative_int(item.get("TOT_CNT"))) is not None
    ]
    return max(totals) if totals else None


def _is_non_initial_page_value(
    key: str,
    value: Any,
    *,
    allow_one_based_page_index: bool = False,
) -> bool:
    parsed = _as_non_negative_int(value)
    if parsed is None:
        return False
    if key == "offset":
        return parsed > 0
    if key == "pageindex" and not allow_one_based_page_index:
        return parsed > 0
    return parsed > 1


def _mapping_has_non_initial_page(
    mapping: Mapping[str, Any],
    listing_url: str,
) -> bool:
    return any(
        key in mapping
        and _is_non_initial_page_value(
            key,
            mapping.get(key),
            allow_one_based_page_index=_is_smilegate_listing(listing_url),
        )
        for key in PAGE_KEYS
    )


def _is_complete_json_listing(
    data: Any,
    collections: list[tuple[Mapping[str, Any], list[Any]]],
    listing_url: str,
    request_body: Mapping[str, Any] | None,
) -> bool:
    explicit_last_page = False
    completeness_proven = False
    page_size, has_page_marker, non_initial_page = _request_pagination(
        listing_url,
        request_body,
    )
    if non_initial_page:
        return False

    largest_collection = max((len(items) for _, items in collections), default=0)
    posco_total = _posco_listing_total(data, listing_url)
    if posco_total is not None:
        if posco_total > largest_collection:
            return False
        completeness_proven = True

    for parent, collection in collections:
        normalized_parent = _normalized_mapping(parent)
        if _mapping_has_non_initial_page(normalized_parent, listing_url):
            return False
        if any(
            normalized_parent.get(key) not in (None, False, "", [], {})
            for key in ("next", "nextpage", "nextcursor", "__next", "@odata.nextlink")
        ):
            return False
        if normalized_parent.get("hasnext") is True:
            return False
        if normalized_parent.get("hasnext") is False:
            explicit_last_page = True
            completeness_proven = True

        total_keys = (
            ("filteredcount",)
            if "filteredcount" in normalized_parent
            else TOTAL_KEYS
        )
        for key in total_keys:
            total = _as_non_negative_int(normalized_parent.get(key))
            if total is None:
                continue
            if total > len(collection):
                return False
            completeness_proven = True

        current_page = next(
            (
                parsed
                for key in PAGE_KEYS
                if (parsed := _as_non_negative_int(normalized_parent.get(key)))
                is not None
            ),
            None,
        )
        total_pages = _as_non_negative_int(
            normalized_parent.get("totalpages", normalized_parent.get("totalpage"))
        )
        if current_page is not None and total_pages is not None:
            is_before_last = (
                current_page + 1 < total_pages
                if current_page == 0
                else current_page < total_pages
            )
            if is_before_last:
                return False
            completeness_proven = True

    if page_size is not None and not completeness_proven:
        if largest_collection >= page_size:
            return False
        completeness_proven = True
    if has_page_marker and not completeness_proven and not explicit_last_page:
        return False
    return True


def _has_explicit_empty_state(html: str) -> bool:
    soup = BeautifulSoup(html, "lxml")
    if soup.select_one(".noData") is not None:
        return True
    text = " ".join(soup.get_text(" ", strip=True).lower().split())
    return any(marker in text for marker in EMPTY_MARKERS)


def _html_has_next_page(html: str) -> bool:
    soup = BeautifulSoup(html, "lxml")
    if soup.select_one("a[rel='next']") is not None:
        return True
    for selector in (".pagination .next", ".paging .next", "a.next"):
        node = soup.select_one(selector)
        if node is None:
            continue
        classes = {str(value).lower() for value in node.get("class", [])}
        if "disabled" not in classes and node.get("aria-disabled") != "true":
            return True
    return False


def validate_listing_response(
    source_type: SourceType,
    raw: str,
    listing_url: str,
    openings_count: int,
    request_body: Mapping[str, Any] | None = None,
) -> bool:
    """Validate a 200 listing response and report whether it is complete.

    A valid partial page can still be ingested, but callers must not reconcile
    absences unless this function returns ``True``.
    """

    if source_type in JSON_SOURCE_TYPES:
        data = _decode_json_or_jsonp(raw)
        if _has_error_envelope(data):
            raise ListingValidationError("listing response contains an error envelope")
        collections = _collection_parents(data, source_type)
        if not collections and openings_count == 0:
            raise ListingValidationError(
                "listing response has no recognized job collection"
            )
        if openings_count == 0:
            if any(
                collection for _, collection in collections
            ) and not _collections_are_explicitly_inactive(collections):
                raise ListingValidationError(
                    "listing response contains no parseable jobs"
                )
            if not _has_explicit_json_empty_state(
                data,
                source_type,
                listing_url,
            ):
                raise ListingValidationError(
                    "listing response has no explicit empty state"
                )
        return _is_complete_json_listing(
            data,
            collections,
            listing_url,
            request_body,
        )

    if source_type in {
        SourceType.JSON_LD,
        SourceType.HTML_LISTING_DETAIL,
        SourceType.BROWSER_PUBLIC_RENDER,
    }:
        if openings_count == 0 and not _has_explicit_empty_state(raw):
            raise ListingValidationError(
                "listing response has no jobs or explicit empty state"
            )
        return not _html_has_next_page(raw)

    return True
