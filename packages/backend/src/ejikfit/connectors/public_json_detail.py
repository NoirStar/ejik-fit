import json
import re
from dataclasses import dataclass, replace
from datetime import datetime
from html import escape
from typing import Any, Mapping
from urllib.parse import urlencode, urljoin, urlsplit
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from ejikfit.connectors.greeting import parse_opening as parse_greeting_opening
from ejikfit.connectors.next_data import extract_next_data
from ejikfit.connectors.technical_roles import is_technical_role
from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


KST = ZoneInfo("Asia/Seoul")
COM2US_LISTING_API = (
    "https://api-recruiter.recruiter.co.kr/position/v1/jobflex"
)
COM2US_LISTING_BODY: dict[str, object] = {
    "pageableRq": {"page": 1, "size": 100, "sort": ["JOBFLEX_SORT"]},
    "filter": {
        "keyword": "",
        "tagSnList": [],
        "jobGroupSnList": [],
        "careerTypeList": [],
        "regionSnList": [],
        "submissionStatusList": [],
        "openStatusList": [],
        "resumeLanguageTypeList": [],
    },
}
COM2US_REQUEST_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://com2us.recruiter.co.kr",
    "Referer": "https://com2us.recruiter.co.kr/",
    "prefix": "com2us.recruiter.co.kr",
}
COM2US_TECH_CLASSIFICATIONS = {
    "AI",
    "DB",
    "QA",
    "게임프로그래밍",
    "데이터분석",
    "보안",
    "웹개발·디자인",
    "인프라",
}
RECRUITER_LEGACY_TECH_CLASSIFICATIONS = {
    "Data",
    "IT",
    "R&D",
    "Security",
    "Tech",
    "개발",
    "기술",
}
RECRUITER_LEGACY_CONNECTOR_FAMILIES = frozenset(
    {
        "recruiter_legacy_public_api_tech",
        "ahnlab_recruiter_public_api_tech",
    }
)
NETMARBLE_LISTING_API = (
    "https://career.netmarble.com/api/v1/apply/announces?page=1&size=1000"
)
NHN_LISTING_API = (
    "https://careers.nhn.com/v1/job-postings"
    "?intensive-recruiting=&page=0&size=1000"
)
NCSOFT_LISTING_API = "https://careers.ncsoft.com/interface/apply/list"
NCSOFT_DETAIL_API = "https://careers.ncsoft.com/template/html//apply/view"
NCSOFT_LISTING_FORM: dict[str, object] = {
    "order_type": "ORDER_ETC",
    "order_direction": "desc",
    "page": 1,
    "pagesize": 200,
    "channelCds": "",
    "keywords": "",
    "job_group_cd": "",
    "search_text": "",
    "job_type_cd": "",
    "companyIds": "",
}
NCSOFT_TECH_JOB_TYPES = {
    "AI R&D",
    "Game Programming",
    "General Programming",
    "QA",
    "System Administration",
}
BANKSALAD_TECH_DEPARTMENTS = {"테크", "데이터"}
ROUNDHR_LISTING_API = "https://api-prod.roundhr.com/api/site/jobs"
WORKABLE_LISTING_API_TEMPLATE = (
    "https://apply.workable.com/api/v3/accounts/{account}/jobs"
)
WORKABLE_DETAIL_API_TEMPLATE = (
    "https://apply.workable.com/api/v2/accounts/{account}/jobs/{shortcode}"
)
NINEHIRE_LISTING_API = (
    "https://api.ninehire.com/identity-access/homepage/recruitments"
)
ELICE_LISTING_API = (
    "https://www.elice.careers/v1/datasource/airtable/"
    "07473e9b-e01d-44a7-8574-bfb9ef7636eb/"
    "177442e2-8523-41fb-9eb3-37969d716b78/"
    "7b93975c-b0cf-48e3-b4c4-536a3f1c41b7/"
    "e9d04b0b-43b5-4201-88ae-f2a908e81f6d/data"
)
ELICE_DETAIL_API_PREFIX = (
    "https://www.elice.careers/v1/datasource/applications/"
    "07473e9b-e01d-44a7-8574-bfb9ef7636eb/pages/"
    "92e9203b-3e2b-4a14-9c87-291166cd7deb/blocks/"
    "3687473e-d2f5-43a9-a5ae-04b8a3a3d906/datasources/"
    "7bda1710-d6c6-4d1a-b596-7813bc2d7165/records"
)
ELICE_LISTING_PAGE_SIZE = 100
ELICE_LISTING_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://www.elice.careers",
    "Referer": "https://www.elice.careers/",
}
ELICE_DETAIL_BODY: dict[str, object] = {
    "options": {"timeZone": "Asia/Seoul", "userLocale": "ko-KR"},
    "pageContext": None,
    "filterCriteria": {},
}
ELICE_NON_SOFTWARE_TITLE_MARKERS = (
    "[singapore]",
    "데이터센터 사업개발",
    "데이터센터 인프라 운영",
    "데이터센터 전기",
    "데이터센터 냉각",
    "디자이너",
    "office it technician",
    "product manager",
    "project manager",
    "프로덕트 매니저",
)
NINEHIRE_EXPLICIT_NON_TECH_GROUPS = frozenset(
    {"business", "design", "finance", "legal", "marketing", "people", "sales"}
)
NINEHIRE_STRONG_TECH_TITLES_IN_NON_TECH_GROUPS = (
    "data analyst",
    "data analysis",
    "데이터 분석가",
    "데이터 애널리스트",
)
DUNAMU_JOB_GROUP_LABELS = {
    "T_ENGINEERING": "Engineering",
    "T_SECURITY": "Security",
    "T_TALENT_POOL": "Talent Pool",
    "T_COMMUNICATION": "Communication",
    "T_COMPLIANCE": "Compliance",
    "T_BUSINESS": "Business",
    "T_CUSTOMER_SERVICE": "Customer Service",
    "T_DESIGN": "Design",
    "T_FINANCE": "Finance",
    "T_LEGAL": "Legal",
    "T_MARKETING": "Marketing",
    "T_PEOPLE": "People",
    "T_PRODUCT": "Product",
}
DUNAMU_CAREER_TYPES = {
    "EXPERIENCED": "experienced",
    "NEWBIE": "new_comer",
    "NONE": "mixed",
}
DUNAMU_CAREER_LABELS = {
    "EXPERIENCED": "경력",
    "NEWBIE": "신입",
    "NONE": "경력 무관",
}
DUNAMU_EMPLOYMENT_TYPES = {
    "FULL_TIME": "regular",
    "CONTRACT": "contract",
    "INTERN": "intern",
}
DUNAMU_EMPLOYMENT_LABELS = {
    "FULL_TIME": "정규직",
    "CONTRACT": "계약직",
    "INTERN": "인턴",
    "NONE": "미표기",
}
DUNAMU_CONNECTOR_FAMILIES = frozenset(
    {
        "dunamu_server_html_tech",
        "dunamu_official_api_proxy_tech",
    }
)


@dataclass(frozen=True)
class PublicJsonDetailRef:
    external_id: str
    detail_url: str
    public_url: str
    title: str
    category: str | None = None
    location: str | None = None
    country_code: str | None = None
    opens_at: datetime | None = None
    closes_at: datetime | None = None


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _positive_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _parse_datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.year >= 2999:
        return None
    return parsed.replace(tzinfo=KST) if parsed.tzinfo is None else parsed


def _jobflex_datetime(value: Any) -> datetime | None:
    if not isinstance(value, dict):
        return None
    milliseconds = _positive_int(value.get("time"))
    if milliseconds is None:
        return None
    try:
        return datetime.fromtimestamp(milliseconds / 1000, tz=KST)
    except (OverflowError, OSError, ValueError):
        return None


def _origin(listing_url: str) -> str:
    parsed = urlsplit(listing_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("public JSON listing URL must be absolute")
    return f"{parsed.scheme}://{parsed.netloc}"


def _decode_object(raw_json: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as error:
        raise ValueError("public JSON payload is invalid") from error
    if not isinstance(payload, dict):
        raise ValueError("public JSON payload must be an object")
    return payload


def roundhr_site_code(raw_html: str) -> str:
    data = extract_next_data(raw_html)
    try:
        organization = data["props"]["pageProps"]["site_config"][
            "organization"
        ]
    except (KeyError, TypeError) as error:
        raise ValueError(
            "RoundHR organization configuration is missing"
        ) from error
    code = (
        _text(organization.get("code"))
        if isinstance(organization, dict)
        else None
    )
    if code is None or re.fullmatch(r"[A-Za-z0-9_-]{6,64}", code) is None:
        raise ValueError("RoundHR organization code is invalid")
    return code


def workable_account_slug(raw_html: str, listing_url: str) -> str:
    parsed_url = urlsplit(listing_url)
    path_segments = [
        segment for segment in parsed_url.path.split("/") if segment
    ]
    if (
        parsed_url.scheme != "https"
        or parsed_url.hostname != "apply.workable.com"
        or len(path_segments) != 1
    ):
        raise ValueError("Workable listing must use an official account page")

    soup = BeautifulSoup(raw_html, "lxml")
    subdomain_node = soup.select_one('meta[name="subdomain"]')
    account = (
        _text(str(subdomain_node.get("content") or ""))
        if subdomain_node is not None
        else None
    )
    if (
        account is None
        or re.fullmatch(r"[a-z0-9][a-z0-9-]{1,62}", account) is None
        or account != path_segments[0]
    ):
        raise ValueError("Workable account identity is missing or inconsistent")
    return account


def ninehire_listing_config(
    raw_html: str,
    listing_url: str,
) -> tuple[str, str]:
    parsed_url = urlsplit(listing_url)
    if (
        parsed_url.scheme != "https"
        or parsed_url.hostname is None
        or parsed_url.username is not None
        or parsed_url.password is not None
    ):
        raise ValueError("Ninehire listing must use an official HTTPS page")

    data = extract_next_data(raw_html)
    try:
        homepage_props = data["props"]["pageProps"]["homepageProps"]
        info = homepage_props["info"]
        domain = homepage_props["domain"]
    except (KeyError, TypeError) as error:
        raise ValueError(
            "Ninehire public homepage configuration is missing"
        ) from error
    if not isinstance(info, dict) or not isinstance(domain, dict):
        raise ValueError("Ninehire public homepage configuration is invalid")

    company_id = _text(info.get("companyId"))
    hostname = _text(domain.get("hostname"))
    if (
        company_id is None
        or re.fullmatch(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            company_id,
            flags=re.IGNORECASE,
        )
        is None
        or info.get("status") != "published"
        or hostname is None
        or hostname.casefold() != parsed_url.hostname.casefold()
    ):
        raise ValueError("Ninehire public homepage identity is inconsistent")
    return company_id, f"https://{parsed_url.hostname}"


def ninehire_listing_api_url(company_id: str, page: int) -> str:
    if page < 1:
        raise ValueError("Ninehire listing page must be positive")
    return NINEHIRE_LISTING_API + "?" + urlencode(
        {
            "companyId": company_id,
            "page": page,
            "countPerPage": 100,
            "externalTitle": "",
            "order": "created_at_desc",
        }
    )


def parse_ninehire_listing_page(
    raw_json: str,
    company_id: str,
) -> tuple[list[dict[str, Any]], int]:
    payload = _decode_object(raw_json)
    rows = payload.get("results")
    total = _positive_int(payload.get("count"))
    if (
        not isinstance(rows, list)
        or total is None
        or len(rows) > min(total, 100)
        or any(not isinstance(row, dict) for row in rows)
        or any(_text(row.get("companyId")) != company_id for row in rows)
    ):
        raise ValueError("Ninehire listing page is invalid or incomplete")
    return rows, total


def elice_listing_request_body(offset: str | None) -> dict[str, object]:
    if offset is not None and (
        not offset.strip() or len(offset) > 500 or any(c in offset for c in "\r\n")
    ):
        raise ValueError("Elice listing cursor is invalid")
    return {
        "options": {
            "cellFormat": "string",
            "timeZone": "UTC",
            "userLocale": "ko-KR",
        },
        "pageContext": None,
        "filterCriteria": {},
        "pagingOption": {
            "offset": offset,
            "count": ELICE_LISTING_PAGE_SIZE,
        },
    }


def parse_elice_listing_page(
    raw_json: str,
) -> tuple[list[dict[str, Any]], str | None]:
    payload = _decode_object(raw_json)
    rows = payload.get("records")
    raw_offset = payload.get("offset")
    offset = _text(raw_offset)
    if (
        not isinstance(rows, list)
        or len(rows) > ELICE_LISTING_PAGE_SIZE
        or any(not isinstance(row, dict) for row in rows)
        or (raw_offset is not None and offset is None)
        or (
            offset is not None
            and (len(offset) > 500 or "\n" in offset or "\r" in offset)
        )
        or (offset is not None and not rows)
    ):
        raise ValueError("Elice listing page is invalid or incomplete")

    seen: set[str] = set()
    for row in rows:
        external_id = _text(row.get("id"))
        fields = row.get("fields")
        if (
            external_id is None
            or re.fullmatch(r"rec[A-Za-z0-9]{10,40}", external_id) is None
            or external_id in seen
            or not isinstance(fields, dict)
            or _text(fields.get("포지션")) is None
            or _text(fields.get("카테고리 대분류값(softr)")) is None
        ):
            raise ValueError("Elice listing contains an invalid job record")
        seen.add(external_id)
    return rows, offset


def parse_workable_listing_page(
    raw_json: str,
) -> tuple[list[dict[str, Any]], int, str | None]:
    payload = _decode_object(raw_json)
    rows = payload.get("results")
    total = _positive_int(payload.get("total"))
    raw_next_page = payload.get("nextPage")
    next_page = _text(raw_next_page)
    if (
        not isinstance(rows, list)
        or total is None
        or len(rows) > total
        or (raw_next_page is not None and next_page is None)
        or (next_page is not None and len(next_page) > 2048)
        or any(not isinstance(row, dict) for row in rows)
    ):
        raise ValueError("Workable listing page is invalid")
    return rows, total, next_page


def _response_header(headers: Mapping[str, str], name: str) -> str | None:
    lowered = name.lower()
    return next(
        (
            value
            for key, value in headers.items()
            if key.lower() == lowered and isinstance(value, str)
        ),
        None,
    )


def ncsoft_session_headers(
    bootstrap_html: str,
    response_headers: Mapping[str, str],
    referer: str,
) -> dict[str, str]:
    soup = BeautifulSoup(bootstrap_html, "lxml")
    csrf_node = soup.select_one('meta[name="_csrf"]')
    csrf = _text(str(csrf_node.get("content") or "")) if csrf_node else None
    set_cookie = _response_header(response_headers, "set-cookie")
    cookie = set_cookie.split(";", 1)[0].strip() if set_cookie else None
    if (
        csrf is None
        or re.fullmatch(r"[A-Za-z0-9-]+", csrf) is None
        or cookie is None
        or not cookie.startswith("nextrct-web-session=")
        or "\n" in cookie
        or "\r" in cookie
    ):
        raise ValueError("NC Careers session bootstrap is incomplete")
    return {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Cookie": cookie,
        "Origin": "https://careers.ncsoft.com",
        "Referer": referer,
        "X-CSRF-TOKEN": csrf,
        "X-Requested-With": "XMLHttpRequest",
    }


def _woowahan_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    if str(payload.get("code")) != "2000":
        raise ValueError("Woowahan listing did not return a success envelope")
    data = payload.get("data")
    rows = data.get("list") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        raise ValueError("Woowahan listing is missing its recruit list")

    origin = _origin(listing_url)
    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        if (
            row.get("recruitDeleteYn") is True
            or row.get("isHidden") is True
            or row.get("isTemporaryStatus") is True
            or row.get("isAfterOrEqualEndDay") is True
            or row.get("isAfterOrEqualOpenDay") is False
        ):
            continue
        external_id = _text(row.get("recruitNumber"))
        title = _text(row.get("recruitName"))
        if external_id is None or title is None or external_id in seen:
            continue
        seen.add(external_id)
        job_group = row.get("jobGroup")
        category = (
            _text(job_group.get("recruitItemCode"))
            if isinstance(job_group, dict)
            else None
        )
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=f"{origin}/w1/recruits/{external_id}",
                public_url=f"{origin}/recruitment/{external_id}/detail",
                title=title,
                category=category,
            )
        )
    return refs


def _kakaobank_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    rows = payload.get("list")
    if not isinstance(rows, list):
        raise ValueError("KakaoBank listing is missing its recruit list")

    origin = _origin(listing_url)
    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        raw_id = row.get("recruitNoticeSn")
        title = _text(row.get("recruitNoticeName"))
        if raw_id is None or isinstance(raw_id, bool) or title is None:
            continue
        external_id = str(raw_id)
        if external_id in seen:
            continue
        seen.add(external_id)
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=f"{origin}/api/recruits/{external_id}",
                public_url=f"{origin}/jobs/{external_id}",
                title=title,
                category=_text(row.get("recruitClassName")),
            )
        )
    return refs


def _dunamu_legacy_refs(raw_html: str) -> list[PublicJsonDetailRef]:
    data = extract_next_data(raw_html)
    try:
        articles = data["props"]["pageProps"]["articles"]
        rows = articles["content"]
        total = articles["totalElements"]
    except (KeyError, TypeError) as error:
        raise ValueError("Dunamu current jobs list is missing") from error
    if not isinstance(articles, dict) or not isinstance(rows, list):
        raise ValueError("Dunamu current jobs list must be an array")
    if (
        isinstance(total, bool)
        or not isinstance(total, int)
        or total != len(rows)
        or articles.get("last") is not True
    ):
        raise ValueError("Dunamu current jobs list is incomplete")
    number_of_elements = articles.get("numberOfElements")
    if number_of_elements is not None and number_of_elements != len(rows):
        raise ValueError("Dunamu current jobs count does not match its list")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict) or row.get("categoryKind") != "LINK":
            continue
        title = _text(row.get("title"))
        raw_url = _text(row.get("summary")) or _text(row.get("subject"))
        if title is None or raw_url is None:
            raise ValueError("Dunamu linked job identity is missing")
        parsed = urlsplit(raw_url)
        segments = [segment for segment in parsed.path.split("/") if segment]
        if (
            parsed.scheme != "https"
            or parsed.hostname != "careers.dunamu.com"
            or len(segments) < 2
            or segments[-2] != "detail"
        ):
            raise ValueError("Dunamu linked job URL is not an official detail")
        external_id = segments[-1]
        if external_id in seen:
            continue
        seen.add(external_id)
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=raw_url,
                public_url=raw_url,
                title=title,
                category=_text(row.get("categoryDisplayName")),
            )
        )
    return refs


def _dunamu_careers_refs(
    raw_html: str,
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    listing_host = urlsplit(listing_url).hostname
    if listing_host != "careers.dunamu.com":
        raise ValueError("Dunamu careers listing must use its official host")

    soup = BeautifulSoup(raw_html, "lxml")
    listing = soup.select_one(".main_list")
    cards = listing.select(".main_list_item") if listing is not None else []
    if not cards:
        raise ValueError("Dunamu current jobs list is missing")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for card in cards:
        link = card.select_one("a.main_list_link[href]")
        title_node = card.select_one(".main_list_name")
        category_node = card.select_one(".main_list_title")
        href = _text(link.get("href")) if link is not None else None
        title = (
            _text(title_node.get_text(" ", strip=True))
            if title_node is not None
            else None
        )
        category = (
            _text(category_node.get_text(" ", strip=True))
            if category_node is not None
            else None
        )
        if href is None or title is None or category is None:
            raise ValueError("Dunamu linked job identity is missing")

        detail_url = urljoin(listing_url, href)
        parsed = urlsplit(detail_url)
        segments = [segment for segment in parsed.path.split("/") if segment]
        if (
            parsed.scheme != "https"
            or parsed.hostname != "careers.dunamu.com"
            or len(segments) < 2
            or segments[-2] != "detail"
            or re.fullmatch(r"\d{1,12}", segments[-1]) is None
        ):
            raise ValueError("Dunamu linked job URL is not an official detail")

        external_id = segments[-1]
        if external_id in seen:
            raise ValueError("Dunamu listing contains a duplicate job")
        seen.add(external_id)
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=detail_url,
                public_url=detail_url,
                title=title,
                category=category,
            )
        )
    return refs


def _dunamu_api_rows(raw_json: str) -> list[dict[str, Any]]:
    payload = _decode_object(raw_json)
    content = payload.get("content")
    rows = content.get("jobNoticeResponses") if isinstance(content, dict) else None
    if (
        payload.get("statusCode") != 200
        or not isinstance(content, dict)
        or content.get("jobBoardName") != "Dunamu"
        or not isinstance(rows, list)
        or not rows
        or not all(isinstance(row, dict) for row in rows)
    ):
        raise ValueError("Dunamu current jobs API response is incomplete")
    return rows


def _dunamu_api_refs(
    raw_json: str,
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    parsed_listing = urlsplit(listing_url)
    if (
        parsed_listing.scheme != "https"
        or parsed_listing.hostname != "careers.dunamu.com"
        or parsed_listing.path
        != "/api/job-boards/jd0wjv/job-notices"
    ):
        raise ValueError("Dunamu jobs API must use its official endpoint")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in _dunamu_api_rows(raw_json):
        raw_id = row.get("id")
        title = _text(row.get("name"))
        group_code = _text(row.get("jobGroupCode"))
        if (
            isinstance(raw_id, bool)
            or not isinstance(raw_id, int)
            or raw_id < 1
            or title is None
            or group_code is None
            or re.fullmatch(r"T_[A-Z_]+", group_code) is None
        ):
            raise ValueError("Dunamu API job identity is missing")

        external_id = str(raw_id)
        if external_id in seen:
            raise ValueError("Dunamu jobs API contains a duplicate job")
        seen.add(external_id)
        category = DUNAMU_JOB_GROUP_LABELS.get(
            group_code,
            group_code.removeprefix("T_").replace("_", " ").title(),
        )
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=listing_url,
                public_url=f"https://careers.dunamu.com/detail/{external_id}",
                title=title,
                category=category,
            )
        )
    return refs


def _dunamu_refs(
    raw_html: str,
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    if raw_html.lstrip().startswith("{"):
        return _dunamu_api_refs(raw_html, listing_url)
    soup = BeautifulSoup(raw_html, "lxml")
    if soup.find("script", id="__NEXT_DATA__") is not None:
        return _dunamu_legacy_refs(raw_html)
    return _dunamu_careers_refs(raw_html, listing_url)


def _ably_refs(raw_html: str) -> list[PublicJsonDetailRef]:
    data = extract_next_data(raw_html)
    try:
        rows = data["props"]["pageProps"]["recruits"]
    except (KeyError, TypeError) as error:
        raise ValueError("Ably current jobs list is missing") from error
    if not isinstance(rows, list):
        raise ValueError("Ably current jobs list must be an array")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        if row.get("status") != "in_progress" or row.get("isPrivate") is True:
            continue
        external_id = _text(row.get("id"))
        title = _text(row.get("title"))
        detail_url = _text(row.get("applyUrl"))
        if external_id is None or title is None or detail_url is None:
            raise ValueError("Ably open job identity is missing")
        if title == "[산업기능요원] 엔지니어 채용":
            # This is a directory that links back to the same engineering
            # openings, not a distinct role with its own requirements.
            continue

        parsed = urlsplit(detail_url)
        segments = [segment for segment in parsed.path.split("/") if segment]
        if (
            parsed.scheme != "https"
            or parsed.hostname != "tydtr0dj.ninehire.site"
            or len(segments) != 2
            or segments[0] != "job_posting"
        ):
            raise ValueError("Ably job URL is not its official Ninehire detail")
        if external_id in seen:
            continue
        seen.add(external_id)
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=detail_url,
                public_url=detail_url,
                title=title,
                category=_text(row.get("jobGroup")),
            )
        )
    return refs


def _elice_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    parsed_listing = urlsplit(listing_url)
    if (
        parsed_listing.scheme != "https"
        or parsed_listing.hostname != "www.elice.careers"
        or parsed_listing.path.rstrip("/")
        or parsed_listing.query
        or parsed_listing.fragment
    ):
        raise ValueError("Elice listing must use its official careers page")

    rows = payload.get("records")
    if (
        payload.get("complete") is not True
        or payload.get("offset") is not None
        or not isinstance(rows, list)
        or any(not isinstance(row, dict) for row in rows)
    ):
        raise ValueError("Elice combined jobs listing is incomplete")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        external_id = _text(row.get("id"))
        fields = row.get("fields")
        title = (
            _text(fields.get("포지션"))
            if isinstance(fields, dict)
            else None
        )
        category = (
            _text(fields.get("카테고리 대분류값(softr)"))
            if isinstance(fields, dict)
            else None
        )
        if (
            external_id is None
            or re.fullmatch(r"rec[A-Za-z0-9]{10,40}", external_id) is None
            or title is None
            or category is None
            or external_id in seen
        ):
            raise ValueError("Elice open job identity is missing")
        seen.add(external_id)
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=f"{ELICE_DETAIL_API_PREFIX}/{external_id}",
                public_url=(
                    "https://www.elice.careers/jobs?recordId="
                    f"{external_id}"
                ),
                title=title,
                category=category,
            )
        )
    return refs


def _ninehire_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    parsed_listing = urlsplit(listing_url)
    if (
        parsed_listing.scheme != "https"
        or parsed_listing.hostname is None
        or parsed_listing.username is not None
        or parsed_listing.password is not None
    ):
        raise ValueError("Ninehire public listing URL is invalid")

    rows = payload.get("results")
    total = _positive_int(payload.get("count"))
    if (
        not isinstance(rows, list)
        or total is None
        or total != len(rows)
        or any(not isinstance(row, dict) for row in rows)
    ):
        raise ValueError("Ninehire combined jobs listing is incomplete")

    origin = f"https://{parsed_listing.hostname}"
    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if (
            row.get("status") != "in_progress"
            or row.get("isPrivate") is True
            or row.get("isSample") is True
        ):
            continue
        external_id = _text(row.get("recruitmentId"))
        address_key = _text(row.get("addressKey"))
        title = _text(row.get("externalTitle")) or _text(row.get("title"))
        if (
            external_id is None
            or address_key is None
            or re.fullmatch(r"[A-Za-z0-9_-]{6,64}", address_key) is None
            or title is None
        ):
            raise ValueError("Ninehire open job identity is missing")
        if external_id in seen:
            raise ValueError("Ninehire jobs listing contains a duplicate job")
        seen.add(external_id)

        category_parts: list[str] = []
        for key in ("jobGroup", "jobTask"):
            value = row.get(key)
            label = _text(value.get("title")) if isinstance(value, dict) else None
            if label and label not in category_parts:
                category_parts.append(label)
        raw_locations = row.get("jobLocations")
        locations = raw_locations if isinstance(raw_locations, list) else []
        location_parts: list[str] = []
        for location in locations:
            if not isinstance(location, dict):
                continue
            label = _text(location.get("addressName")) or _text(
                location.get("placeName")
            )
            if label and label not in location_parts:
                location_parts.append(label)

        detail_url = f"{origin}/job_posting/{address_key}"
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=detail_url,
                public_url=detail_url,
                title=title,
                category=" · ".join(category_parts) or None,
                location=" · ".join(location_parts) or None,
            )
        )
    return refs


def _netmarble_refs(payload: dict[str, Any]) -> list[PublicJsonDetailRef]:
    rows = payload.get("content")
    page = payload.get("page")
    if not isinstance(rows, list) or not isinstance(page, dict):
        raise ValueError("Netmarble listing is missing its complete jobs page")

    total = _positive_int(page.get("totalDataCnt"))
    total_pages = _positive_int(page.get("totalPages"))
    request_page = _positive_int(page.get("requestPage"))
    request_size = _positive_int(page.get("requestSize"))
    if (
        total != len(rows)
        or total_pages != 1
        or request_page != 1
        or request_size is None
        or request_size < len(rows)
        or page.get("isLastPage") is not True
    ):
        raise ValueError("Netmarble listing response is incomplete")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Netmarble listing contains an invalid job row")
        if row.get("isApply") is False:
            continue
        raw_id = row.get("carAnnoId")
        title = _text(row.get("annoSubject"))
        if raw_id is None or isinstance(raw_id, bool) or title is None:
            raise ValueError("Netmarble open job identity is missing")
        external_id = str(raw_id)
        if external_id in seen:
            continue
        seen.add(external_id)
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=(
                    "https://career.netmarble.com/api/v1/apply/announces/"
                    f"{external_id}/view"
                ),
                public_url=(
                    "https://career.netmarble.com/announce/view?anno_id="
                    f"{external_id}"
                ),
                title=title,
                category=_text(row.get("carJobGroupCd")),
            )
        )
    return refs


def _nhn_success_payload(payload: dict[str, Any], label: str) -> Any:
    header = payload.get("header")
    if (
        not isinstance(header, dict)
        or header.get("isSuccessful") is not True
        or header.get("resultCode") != 0
    ):
        raise ValueError(f"NHN Careers {label} did not return a success envelope")
    return payload.get("result")


def _nhn_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    parsed_url = urlsplit(listing_url)
    if (
        parsed_url.hostname != "careers.nhn.com"
        or parsed_url.path.rstrip("/")
        not in {"/recruits", "/v1/job-postings"}
    ):
        raise ValueError("NHN Careers listing URL is not an official endpoint")

    rows = _nhn_success_payload(payload, "listing")
    total = _positive_int(payload.get("totalCount"))
    if not isinstance(rows, list) or total != len(rows) or total > 1000:
        raise ValueError("NHN Careers listing response is incomplete")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("NHN Careers listing contains an invalid job row")
        if row.get("finishYn") != "N" or row.get("postingYn") != "Y":
            continue

        external_id = _text(row.get("id"))
        raw_title = _text(row.get("name"))
        corporation = row.get("corporation")
        corporation_name = (
            _text(corporation.get("name"))
            if isinstance(corporation, dict)
            else None
        )
        if (
            external_id is None
            or re.fullmatch(r"\d{10,25}", external_id) is None
            or raw_title is None
            or corporation_name is None
        ):
            raise ValueError("NHN Careers open job identity is missing")
        if external_id in seen:
            raise ValueError("NHN Careers listing contains a duplicate job")
        seen.add(external_id)

        category_parts: list[str] = []
        raw_series = row.get("jobSeries")
        series = raw_series if isinstance(raw_series, list) else []
        for item in series:
            if not isinstance(item, dict):
                continue
            group = item.get("jobGroup")
            group_name = (
                _text(group.get("name")) if isinstance(group, dict) else None
            )
            series_name = _text(item.get("name"))
            for label in (group_name, series_name):
                if label and label not in category_parts:
                    category_parts.append(label)

        region = (
            _text(corporation.get("regionCd"))
            if isinstance(corporation, dict)
            else None
        )
        # NHN Careers currently labels NHN JAPAN with KR in regionCd, so the
        # corporation name is the more reliable country signal for that feed.
        country_code = (
            "JP" if "JAPAN" in corporation_name.upper() else region
        )
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=(
                    "https://careers.nhn.com/v1/job-postings/"
                    f"{external_id}"
                ),
                public_url=f"https://careers.nhn.com/recruits/{external_id}",
                title=f"[{corporation_name}] {raw_title}",
                category=" · ".join(category_parts) or None,
                country_code=country_code,
            )
        )
    return refs


def _ncsoft_refs(payload: dict[str, Any]) -> list[PublicJsonDetailRef]:
    result = payload.get("result")
    if not isinstance(result, dict) or str(result.get("State")) != "0":
        raise ValueError("NC Careers listing did not return a success envelope")
    data = result.get("data")
    rows = data.get("record") if isinstance(data, dict) else None
    if not isinstance(data, dict) or not isinstance(rows, list):
        raise ValueError("NC Careers listing is missing its jobs")

    total = _positive_int(data.get("record_count"))
    page = _positive_int(data.get("page"))
    page_size = _positive_int(data.get("pagesize"))
    if (
        total != len(rows)
        or page != 1
        or page_size is None
        or page_size < len(rows)
    ):
        raise ValueError("NC Careers listing response is incomplete")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("NC Careers listing contains an invalid job row")
        raw_id = row.get("jopenId")
        operator_id = _text(row.get("regOpId"))
        title = _text(row.get("jopenNm"))
        job_type = _text(row.get("jobTypeName"))
        job_name = _text(row.get("jobName"))
        if (
            raw_id is None
            or isinstance(raw_id, bool)
            or operator_id is None
            or title is None
        ):
            raise ValueError("NC Careers open job identity is missing")
        external_id = str(raw_id)
        if external_id in seen:
            continue
        seen.add(external_id)
        detail_query = urlencode(
            {"companyId": operator_id, "jopenId": external_id}
        )
        public_query = urlencode({"companyId": operator_id})
        category = " | ".join(
            part for part in (job_type, job_name) if part is not None
        )
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=f"{NCSOFT_DETAIL_API}?{detail_query}",
                public_url=(
                    "https://careers.ncsoft.com/apply/view/"
                    f"{external_id}?{public_query}"
                ),
                title=title,
                category=category or None,
            )
        )
    return refs


def _com2us_refs(payload: dict[str, Any]) -> list[PublicJsonDetailRef]:
    pagination = payload.get("pagination")
    rows = payload.get("list")
    if not isinstance(pagination, dict) or not isinstance(rows, list):
        raise ValueError("Com2uS Jobflex listing is missing its jobs page")
    total = _positive_int(pagination.get("totalCount"))
    page = _positive_int(pagination.get("page"))
    page_size = _positive_int(pagination.get("size"))
    total_pages = _positive_int(pagination.get("totalPages"))
    if (
        total != len(rows)
        or page != 1
        or page_size is None
        or page_size < len(rows)
        or total_pages != 1
    ):
        raise ValueError("Com2uS Jobflex listing response is incomplete")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Com2uS Jobflex listing contains an invalid job row")
        if (
            row.get("submissionStatus") != "IN_SUBMISSION"
            or row.get("openStatus") != "OPEN"
        ):
            continue
        raw_id = row.get("positionSn")
        title = _text(row.get("title"))
        if raw_id is None or isinstance(raw_id, bool) or title is None:
            raise ValueError("Com2uS open job identity is missing")
        external_id = str(raw_id)
        if external_id in seen:
            continue
        seen.add(external_id)
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=(
                    "https://api-recruiter.recruiter.co.kr/position/v2/"
                    f"jobflex/{external_id}"
                ),
                public_url=(
                    "https://com2us.recruiter.co.kr/career/jobs/"
                    f"{external_id}"
                ),
                title=title,
                category=_text(row.get("classificationCode")),
            )
        )
    return refs


def _recruiter_legacy_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    page = payload.get("pageUtil")
    rows = payload.get("list")
    if not isinstance(page, dict) or not isinstance(rows, list):
        raise ValueError("Recruiter listing is missing its jobs page")
    current_page = _positive_int(page.get("currentPage"))
    last_page = _positive_int(page.get("lastPage"))
    page_size = _positive_int(page.get("maxRows"))
    total = _positive_int(page.get("recordCount"))
    if (
        current_page != 1
        or last_page != 1
        or page_size is None
        or page_size < len(rows)
        or total != len(rows)
    ):
        raise ValueError("Recruiter listing response is incomplete")

    origin = _origin(listing_url)
    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Recruiter listing contains an invalid job row")
        raw_id = row.get("jobnoticeSn")
        title = _text(row.get("jobnoticeName"))
        receipt_state = _text(row.get("receiptState"))
        category = _text(row.get("recruitClassName"))
        system_kind = _text(row.get("systemKindCode"))
        if (
            raw_id is None
            or isinstance(raw_id, bool)
            or title is None
            or receipt_state is None
            or category is None
            or system_kind is None
        ):
            raise ValueError("Recruiter job identity is missing")
        external_id = str(raw_id)
        if not external_id.isdigit():
            raise ValueError("Recruiter job identifier is invalid")
        if external_id in seen:
            raise ValueError("Recruiter listing contains a duplicate job")
        seen.add(external_id)
        if receipt_state != "접수중":
            continue
        query = urlencode(
            {"systemKindCode": system_kind, "jobnoticeSn": external_id}
        )
        detail_url = f"{origin}/app/jobnotice/view?{query}"
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=detail_url,
                public_url=detail_url,
                title=title,
                category=category,
                opens_at=_jobflex_datetime(row.get("applyStartDate")),
                closes_at=_jobflex_datetime(row.get("applyEndDate")),
            )
        )
    return refs


def _banksalad_refs(payload: dict[str, Any]) -> list[PublicJsonDetailRef]:
    groups = payload.get("jobs")
    if not isinstance(groups, list):
        raise ValueError("Banksalad listing is missing its job groups")

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for group in groups:
        if not isinstance(group, dict):
            raise ValueError("Banksalad listing contains an invalid job group")
        department = _text(group.get("department"))
        rows = group.get("data")
        if department is None or not isinstance(rows, list):
            raise ValueError("Banksalad job group is incomplete")
        if department not in BANKSALAD_TECH_DEPARTMENTS:
            continue

        for row in rows:
            if not isinstance(row, dict):
                raise ValueError("Banksalad listing contains an invalid job row")
            raw_id = row.get("id")
            title = _text(row.get("title"))
            raw_url = _text(row.get("url"))
            if raw_id is None or isinstance(raw_id, bool) or title is None:
                raise ValueError("Banksalad open job identity is missing")
            external_id = str(raw_id)
            if raw_url is None:
                raise ValueError("Banksalad open job URL is missing")
            parsed = urlsplit(raw_url)
            segments = [segment for segment in parsed.path.split("/") if segment]
            if (
                parsed.scheme != "https"
                or parsed.hostname != "banksalad.career.greetinghr.com"
                or len(segments) != 2
                or segments[0] != "o"
                or segments[1] != external_id
            ):
                raise ValueError("Banksalad job URL is not its official detail")
            if external_id in seen:
                continue
            seen.add(external_id)
            public_url = (
                "https://banksalad.career.greetinghr.com/ko/o/"
                f"{external_id}"
            )
            refs.append(
                PublicJsonDetailRef(
                    external_id=external_id,
                    detail_url=public_url,
                    public_url=public_url,
                    title=title,
                    category=_text(row.get("job")) or department,
                )
            )
    return refs


def _roundhr_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    rows = payload.get("results")
    page = payload.get("page")
    if not isinstance(rows, list) or not isinstance(page, dict):
        raise ValueError("RoundHR listing is missing its complete jobs page")

    total = _positive_int(page.get("total"))
    pages = _positive_int(page.get("pages"))
    current = _positive_int(page.get("current"))
    if total != len(rows) or pages != 1 or current != 1:
        raise ValueError("RoundHR listing response is incomplete")

    parsed_listing_url = urlsplit(listing_url)
    hostname = parsed_listing_url.hostname or ""
    if (
        parsed_listing_url.scheme != "https"
        or not hostname.endswith(".recruit.roundhr.com")
    ):
        raise ValueError("RoundHR listing must use an official public site")
    origin = f"https://{parsed_listing_url.netloc}"

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("RoundHR listing contains an invalid job row")
        form = row.get("application_form")
        if not isinstance(form, dict):
            continue
        if (
            row.get("deleted") is True
            or form.get("status") != "in_progress"
            or form.get("expired") is True
        ):
            continue

        raw_id = row.get("id")
        raw_form_job_id = form.get("job_id")
        title = _text(row.get("site_title")) or _text(row.get("title"))
        form_code = _text(form.get("code"))
        if (
            raw_id is None
            or isinstance(raw_id, bool)
            or raw_form_job_id is None
            or isinstance(raw_form_job_id, bool)
            or str(raw_form_job_id) != str(raw_id)
            or title is None
            or form_code is None
            or re.fullmatch(r"[A-Za-z0-9_-]{6,64}", form_code) is None
        ):
            raise ValueError("RoundHR open job identity is missing")

        external_id = str(raw_id)
        if external_id in seen:
            continue
        seen.add(external_id)
        position_group = row.get("position_group")
        position = row.get("position")
        category_parts = [
            value
            for value in (
                _text(position_group.get("title"))
                if isinstance(position_group, dict)
                else None,
                _text(position.get("title"))
                if isinstance(position, dict)
                else None,
            )
            if value is not None
        ]
        detail_url = f"{origin}/c/{form_code}"
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=detail_url,
                public_url=detail_url,
                title=title,
                category=" | ".join(dict.fromkeys(category_parts)) or None,
            )
        )
    return refs


def _workable_location_label(location: Any) -> str | None:
    if not isinstance(location, dict) or location.get("hidden") is True:
        return None
    parts = [
        value
        for value in (
            _text(location.get("city")),
            _text(location.get("region")),
            _text(location.get("country")),
        )
        if value is not None
    ]
    return ", ".join(dict.fromkeys(parts)) or None


def _workable_refs(
    payload: dict[str, Any],
    listing_url: str,
) -> list[PublicJsonDetailRef]:
    rows = payload.get("results")
    total = _positive_int(payload.get("total"))
    if (
        not isinstance(rows, list)
        or total != len(rows)
        or payload.get("nextPage") is not None
    ):
        raise ValueError("Workable listing is not a complete jobs envelope")

    parsed_url = urlsplit(listing_url)
    path_segments = [
        segment for segment in parsed_url.path.split("/") if segment
    ]
    if (
        parsed_url.scheme != "https"
        or parsed_url.hostname != "apply.workable.com"
        or len(path_segments) != 1
        or (
            re.fullmatch(
                r"[a-z0-9][a-z0-9-]{1,62}",
                path_segments[0],
            )
            is None
        )
    ):
        raise ValueError("Workable listing must use an official account page")
    account = path_segments[0]

    refs: list[PublicJsonDetailRef] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Workable listing contains an invalid job row")
        if (
            row.get("state") != "published"
            or row.get("isInternal") is True
            or row.get("approvalStatus") not in {None, "approved"}
        ):
            continue

        raw_id = row.get("id")
        external_id = (
            None
            if raw_id is None or isinstance(raw_id, bool)
            else str(raw_id)
        )
        shortcode = _text(row.get("shortcode"))
        title = _text(row.get("title"))
        if (
            external_id is None
            or shortcode is None
            or re.fullmatch(r"[A-Za-z0-9_-]{6,64}", shortcode) is None
            or title is None
        ):
            raise ValueError("Workable open job identity is missing")
        if external_id in seen:
            raise ValueError("Workable listing contains a duplicate job")
        seen.add(external_id)

        raw_departments = row.get("department")
        departments = (
            raw_departments if isinstance(raw_departments, list) else []
        )
        category = " | ".join(
            dict.fromkeys(
                department.strip()
                for department in departments
                if isinstance(department, str) and department.strip()
            )
        ) or None
        location = row.get("location")
        country_code = (
            _text(location.get("countryCode"))
            if isinstance(location, dict)
            else None
        )
        detail_url = WORKABLE_DETAIL_API_TEMPLATE.format(
            account=account,
            shortcode=shortcode,
        )
        refs.append(
            PublicJsonDetailRef(
                external_id=external_id,
                detail_url=detail_url,
                public_url=(
                    f"https://apply.workable.com/{account}/j/{shortcode}/"
                ),
                title=title,
                category=category,
                location=_workable_location_label(location),
                country_code=country_code,
            )
        )
    return refs


def discover_public_json_detail_refs(
    raw_json: str,
    listing_url: str,
    connector_family: str,
) -> list[PublicJsonDetailRef]:
    if connector_family in DUNAMU_CONNECTOR_FAMILIES:
        return _dunamu_refs(raw_json, listing_url)
    if connector_family == "ably_next_ninehire_tech":
        return _ably_refs(raw_json)
    payload = _decode_object(raw_json)
    if connector_family == "elice_softr_public_api_tech":
        return _elice_refs(payload, listing_url)
    if connector_family == "woowahan_public_api_tech":
        return _woowahan_refs(payload, listing_url)
    if connector_family == "kakaobank_public_api_tech":
        return _kakaobank_refs(payload, listing_url)
    if connector_family == "netmarble_public_api_tech":
        return _netmarble_refs(payload)
    if connector_family == "nhn_public_api_tech":
        return _nhn_refs(payload, listing_url)
    if connector_family == "ncsoft_session_html_tech":
        return _ncsoft_refs(payload)
    if connector_family == "com2us_jobflex_tech":
        return _com2us_refs(payload)
    if connector_family in RECRUITER_LEGACY_CONNECTOR_FAMILIES:
        return _recruiter_legacy_refs(payload, listing_url)
    if connector_family == "banksalad_greeting_api_tech":
        return _banksalad_refs(payload)
    if connector_family == "roundhr_public_api_tech":
        return _roundhr_refs(payload, listing_url)
    if connector_family == "workable_public_api_tech":
        return _workable_refs(payload, listing_url)
    if connector_family == "ninehire_public_api_tech":
        return _ninehire_refs(payload, listing_url)
    raise ValueError(f"unsupported public JSON detail family: {connector_family}")


def filter_public_detail_refs(
    refs: list[PublicJsonDetailRef],
    connector_family: str,
) -> list[PublicJsonDetailRef]:
    if connector_family == "netmarble_public_api_tech":
        return [ref for ref in refs if ref.category in {"01", "05"}]
    if connector_family == "nhn_public_api_tech":
        return [
            ref
            for ref in refs
            if ref.country_code == "KR"
            and ref.category is not None
            and ref.category.split(" · ", 1)[0] == "Tech"
            and "인재풀" not in ref.title
        ]
    if connector_family == "ncsoft_session_html_tech":
        return [
            ref
            for ref in refs
            if ref.category is not None
            and ref.category.split(" | ", 1)[0] in NCSOFT_TECH_JOB_TYPES
            and "어시스턴트" not in ref.title
            and "인재풀" not in ref.title
        ]
    if connector_family == "com2us_jobflex_tech":
        return [
            ref
            for ref in refs
            if ref.category in COM2US_TECH_CLASSIFICATIONS
            and not (
                ref.category == "웹개발·디자인"
                and ("디자이너" in ref.title or "디자인" in ref.title)
            )
            and not (ref.category == "AI" and "아티스트" in ref.title)
            and not (ref.category == "인프라" and "기획" in ref.title)
        ]
    if connector_family == "recruiter_legacy_public_api_tech":
        return [
            ref
            for ref in refs
            if ref.category in RECRUITER_LEGACY_TECH_CLASSIFICATIONS
            and "인재풀" not in ref.title
        ]
    if connector_family == "ahnlab_recruiter_public_api_tech":
        return [
            ref
            for ref in refs
            if "인재풀" not in ref.title
            and (
                is_technical_role(ref.title, ref.category)
                or "디지털 포렌식" in ref.title
            )
        ]
    if connector_family == "banksalad_greeting_api_tech":
        return refs
    if connector_family == "elice_softr_public_api_tech":
        return [
            ref
            for ref in refs
            if ref.category == "Tech & Product"
            and not any(
                marker in ref.title.casefold()
                for marker in ELICE_NON_SOFTWARE_TITLE_MARKERS
            )
            and is_technical_role(ref.title, ref.category)
        ]
    if connector_family == "ninehire_public_api_tech":
        return [
            ref
            for ref in refs
            if "인재풀" not in ref.title
            and (
                ref.category is None
                or ref.category.split(" · ", 1)[0].casefold()
                not in NINEHIRE_EXPLICIT_NON_TECH_GROUPS
                or any(
                    marker in ref.title.casefold()
                    for marker in NINEHIRE_STRONG_TECH_TITLES_IN_NON_TECH_GROUPS
                )
            )
            and is_technical_role(ref.title, ref.category)
        ]
    if connector_family == "workable_public_api_tech":
        return [
            ref
            for ref in refs
            if ref.country_code == "KR"
            and "인재풀" not in ref.title
            and is_technical_role(ref.title, ref.category)
        ]
    if not connector_family.endswith("_tech"):
        return refs
    return [
        ref
        for ref in refs
        if "인재풀" not in ref.title
        and is_technical_role(ref.title, ref.category)
    ]


def public_detail_listing_is_self_validated(connector_family: str) -> bool:
    if connector_family in DUNAMU_CONNECTOR_FAMILIES:
        return True
    return connector_family in {
        "ably_next_ninehire_tech",
        "netmarble_public_api_tech",
        "nhn_public_api_tech",
        "ncsoft_session_html_tech",
        "com2us_jobflex_tech",
        "elice_softr_public_api_tech",
        "banksalad_greeting_api_tech",
        "roundhr_public_api_tech",
        "workable_public_api_tech",
        "ninehire_public_api_tech",
    } | RECRUITER_LEGACY_CONNECTOR_FAMILIES


def _nested_code(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    return _text(value.get("recruitItemCode")) if isinstance(value, dict) else None


def _woowahan_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    if str(payload.get("code")) != "2000":
        raise ValueError("Woowahan detail did not return a success envelope")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("Woowahan detail is missing its recruit data")
    external_id = _text(data.get("recruitNumber"))
    title = _text(data.get("recruitName"))
    if external_id != ref.external_id or title is None:
        raise ValueError("Woowahan detail identity does not match its listing")

    description_html = _text(data.get("recruitContents")) or ""
    career_type = {
        "BA003001": "new_comer",
        "BA003002": "experienced",
        "BA003003": "mixed",
    }.get(_nested_code(data, "careerType"))
    employment_type = {
        "BA002001": "regular",
        "BA002002": "contract",
        "BA002003": "intern",
    }.get(_nested_code(data, "employmentType"))
    is_closed = (
        data.get("recruitDeleteYn") is True
        or data.get("isAfterOrEqualEndDay") is True
        or data.get("isHidden") is True
    )
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="closed" if is_closed else "open",
        description_html=description_html,
        description_text=structured_plain_text(description_html),
        employment_type=employment_type,
        career_type=career_type,
        career_min=_positive_int(data.get("careerRestrictionMinYears")),
        career_max=_positive_int(data.get("careerRestrictionMaxYears")),
        location=None,
        opens_at=_parse_datetime(data.get("recruitOpenDate")),
        closes_at=_parse_datetime(data.get("recruitEndDate")),
    )


def _career_type_from_title(title: str) -> str | None:
    has_newcomer = "신입" in title
    has_experienced = "경력" in title
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _employment_type_from_title(title: str) -> str:
    if "인턴" in title:
        return "intern"
    if "계약직" in title:
        return "contract"
    return "regular"


def _kakaobank_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    raw_id = payload.get("recruitNoticeSn")
    external_id = None if raw_id is None or isinstance(raw_id, bool) else str(raw_id)
    title = _text(payload.get("recruitNoticeName"))
    if external_id != ref.external_id or title is None:
        raise ValueError("KakaoBank detail identity does not match its listing")

    description_html = _text(payload.get("contents")) or ""
    closes_at = _parse_datetime(payload.get("receiveEndDatetime"))
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=structured_plain_text(description_html),
        employment_type=_employment_type_from_title(title),
        career_type=_career_type_from_title(title),
        career_min=None,
        career_max=None,
        location=None,
        opens_at=_parse_datetime(payload.get("receiveStartDatetime")),
        closes_at=closes_at,
    )


def _value_after_heading(text: str, heading: str) -> str | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines):
        normalized = line.lstrip("# ").rstrip(":： ")
        if normalized != heading:
            continue
        for value in lines[index + 1 :]:
            stripped = value.lstrip("•*- ").strip()
            if stripped:
                return stripped
    return None


def _netmarble_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    raw_id = payload.get("carAnnoId")
    external_id = None if raw_id is None or isinstance(raw_id, bool) else str(raw_id)
    title = _text(payload.get("annoSubject"))
    if external_id != ref.external_id or title != ref.title:
        raise ValueError("Netmarble detail identity does not match its listing")

    description_html = _text(payload.get("annoContents")) or ""
    if not description_html:
        raise ValueError("Netmarble job detail content is missing")
    description_text = structured_plain_text(description_html)
    is_open = (
        payload.get("isApply") is not False
        and payload.get("isOpen") is True
        and payload.get("isEnd") is not True
        and payload.get("isSecrete") is not True
    )
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="open" if is_open else "closed",
        description_html=description_html,
        description_text=description_text,
        employment_type={
            "01": "regular",
            "02": "contract",
            "03": "intern",
        }.get(_text(payload.get("entTypeCd")) or ""),
        career_type={
            "90005": "new_comer",
            "90006": "experienced",
            "90007": "mixed",
        }.get(_text(payload.get("reqTypeCd")) or ""),
        career_min=None,
        career_max=None,
        location=(
            _value_after_heading(description_text, "근무장소")
            or _value_after_heading(description_text, "근무지")
        ),
        opens_at=_parse_datetime(payload.get("staDate")),
        closes_at=_parse_datetime(payload.get("endDate")),
    )


def _nhn_career_type(value: Any) -> str | None:
    label = _text(value.get("name")) if isinstance(value, dict) else None
    if label is None:
        return None
    if "신입" in label and "경력" in label:
        return "mixed"
    if "신입" in label:
        return "new_comer"
    if "경력" in label:
        return "experienced"
    if "무관" in label:
        return "mixed"
    return None


def _nhn_employment_type(value: Any) -> str | None:
    label = _text(value.get("name")) if isinstance(value, dict) else None
    if label is None:
        return None
    if "정규" in label:
        return "regular"
    if "계약" in label:
        return "contract"
    if "인턴" in label:
        return "intern"
    return None


def _nhn_description(items: Any) -> str:
    if not isinstance(items, list):
        raise ValueError("NHN Careers job detail content is missing")

    valid_items = [item for item in items if isinstance(item, dict)]
    valid_items.sort(
        key=lambda item: float(item.get("orderNo") or 0),
    )
    sections: list[str] = []
    for item in valid_items:
        title = _text(item.get("title"))
        raw_contents = item.get("contents")
        contents = raw_contents if isinstance(raw_contents, list) else []
        content_lines = [
            value
            for value in (_text(content) for content in contents)
            if value is not None
        ]
        footer_html = _text(item.get("footer"))
        footer_text = (
            structured_plain_text(footer_html) if footer_html is not None else ""
        )
        if not title and not content_lines and not footer_text:
            continue

        section: list[str] = []
        if title:
            section.append(f"<h3>{escape(title)}</h3>")
        if content_lines:
            section.append("<ul>")
            section.extend(
                "<li>" + escape(line).replace("\n", "<br>") + "</li>"
                for line in content_lines
            )
            section.append("</ul>")
        if footer_text:
            section.append(
                "<p>" + escape(footer_text).replace("\n", "<br>") + "</p>"
            )
        sections.append("".join(section))

    description_html = "".join(sections)
    if not structured_plain_text(description_html):
        raise ValueError("NHN Careers job detail content is missing")
    return description_html


def _nhn_location(description_text: str) -> str | None:
    for heading in ("근무지", "근무장소", "근무 장소"):
        location = _value_after_heading(description_text, heading)
        if location:
            return location.rstrip(". ")
    match = re.search(
        r"근무지는?\s*[:：]?\s*(.+?)(?:\s*입니다[.]?|\n|$)",
        description_text,
    )
    return match.group(1).strip().rstrip(". ") if match else None


def _nhn_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    data = _nhn_success_payload(payload, "detail")
    if not isinstance(data, dict):
        raise ValueError("NHN Careers detail is missing its job")

    external_id = _text(data.get("id"))
    raw_title = _text(data.get("name"))
    corporation = data.get("corporation")
    corporation_name = (
        _text(corporation.get("name"))
        if isinstance(corporation, dict)
        else None
    )
    title = (
        f"[{corporation_name}] {raw_title}"
        if corporation_name and raw_title
        else None
    )
    if external_id != ref.external_id or title != ref.title:
        raise ValueError("NHN Careers detail identity does not match its listing")

    description_html = _nhn_description(data.get("jobPostingContentsItems"))
    description_text = structured_plain_text(description_html)
    is_open = data.get("finishYn") == "N" and data.get("postingYn") == "Y"
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="open" if is_open else "closed",
        description_html=description_html,
        description_text=description_text,
        employment_type=_nhn_employment_type(data.get("employeeType")),
        career_type=_nhn_career_type(data.get("careerType")),
        career_min=None,
        career_max=None,
        location=_nhn_location(description_text),
        opens_at=_parse_datetime(data.get("postingStaDatetime")),
        closes_at=_parse_datetime(data.get("postingEndDatetime")),
    )


def _ncsoft_date(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.strptime(value.strip(), "%Y.%m.%d").replace(tzinfo=KST)
    except ValueError:
        return None


def _ncsoft_career_range(text: str) -> tuple[int | None, int | None]:
    match = re.search(
        r"경력\s*:\s*(\d+)\s*년\s*~\s*(?:(\d+)\s*년)?",
        text,
    )
    if match is None:
        return None, None
    return int(match.group(1)), int(match.group(2)) if match.group(2) else None


def _ncsoft_opening(raw_html: str, ref: PublicJsonDetailRef) -> ParsedOpening:
    soup = BeautifulSoup(raw_html, "lxml")
    title_node = soup.select_one(".apply-detail-header-wrap h2.subject")
    career_node = soup.select_one(".apply-detail-header-wrap .career-tit")
    term_node = soup.select_one(".apply-detail-header-wrap .term")
    contents = soup.select_one(".apply-detail-content article.contents")
    title = _text(title_node.get_text(" ", strip=True)) if title_node else None
    if title != ref.title:
        raise ValueError("NC Careers detail identity does not match its listing")
    if contents is None:
        raise ValueError("NC Careers job detail content is missing")

    description_html = str(contents)
    description_text = structured_plain_text(description_html)
    career_min, career_max = _ncsoft_career_range(description_text)
    career_label = (
        _text(career_node.get_text(" ", strip=True)) if career_node else None
    )
    term = _text(term_node.get_text(" ", strip=True)) if term_node else None
    dates = [part.strip() for part in term.split("~", 1)] if term else []
    opens_at = _ncsoft_date(dates[0]) if dates else None
    closes_at = _ncsoft_date(dates[1]) if len(dates) == 2 else None
    employment_type = (
        "contract"
        if "계약직" in title or career_label == "단기"
        else "regular"
    )
    career_type = {
        "경력": "experienced",
        "신입": "new_comer",
    }.get(career_label or "")
    return ParsedOpening(
        external_id=ref.external_id,
        url=ref.public_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_text,
        employment_type=employment_type,
        career_type=career_type,
        career_min=career_min,
        career_max=career_max,
        location=None,
        opens_at=opens_at,
        closes_at=closes_at,
    )


def _career_range_from_title(title: str) -> tuple[int | None, int | None]:
    range_match = re.search(
        r"(\d+)\s*~\s*(\d+)\s*년(?:차)?",
        title,
    )
    if range_match is not None:
        return int(range_match.group(1)), int(range_match.group(2))
    minimum_match = re.search(r"(\d+)\s*년\s*이상", title)
    if minimum_match is not None:
        return int(minimum_match.group(1)), None
    return None, None


def _com2us_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    title = _text(payload.get("title"))
    if title != ref.title:
        raise ValueError("Com2uS Jobflex detail identity does not match its listing")
    description_html = _text(payload.get("jobDescription")) or ""
    if not description_html:
        raise ValueError("Com2uS Jobflex job detail content is missing")

    classification = _text(payload.get("classificationCode"))
    raw_tags = payload.get("tagList")
    tags: list[str] = []
    if isinstance(raw_tags, list):
        for tag in raw_tags:
            name = _text(tag.get("tagName")) if isinstance(tag, dict) else None
            if name and name not in tags:
                tags.append(name)
    body_text = structured_plain_text(description_html)
    description_parts = [body_text] if body_text else []
    if classification:
        description_parts.append(f"직무 분류: {classification}")
    if tags:
        description_parts.append(f"공식 태그: {', '.join(tags)}")
    description_text = "\n".join(description_parts)
    career_min, career_max = _career_range_from_title(title)
    career_type = {
        "CAREER": "experienced",
        "NEW": "new_comer",
        "NEW_CAREER": "mixed",
        "FIELD_DIFFERENCE": "mixed",
    }.get(_text(payload.get("careerType")) or "")
    is_open = (
        payload.get("progressStatus") == "IN_PROGRESS"
        and payload.get("submissionStatus") == "IN_SUBMISSION"
        and payload.get("writeButtonStatus") == "OPEN"
    )
    return ParsedOpening(
        external_id=ref.external_id,
        url=ref.public_url,
        title=title,
        status="open" if is_open else "closed",
        description_html=description_html,
        description_text=description_text,
        employment_type="contract" if "계약직" in title else "regular",
        career_type=career_type,
        career_min=career_min,
        career_max=career_max,
        location=None,
        opens_at=_parse_datetime(payload.get("startDateTime")),
        closes_at=_parse_datetime(payload.get("endDateTime")),
    )


def _labeled_value(text: str, label: str) -> str | None:
    pattern = re.compile(rf"^{re.escape(label)}\s*:\s*(.+)$")
    for line in text.splitlines():
        match = pattern.match(line.strip().lstrip("•*- "))
        if match is not None:
            return match.group(1).strip() or None
    return None


def _recruiter_legacy_opening(
    raw_html: str,
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    soup = BeautifulSoup(raw_html, "lxml")
    id_node = soup.select_one("#jobnoticeSn")
    title_node = soup.select_one(".view-bbs-title")
    write_state_node = soup.select_one("#writeButtonState")
    external_id = (
        _text(str(id_node.get("value") or "")) if id_node else None
    )
    title = _text(title_node.get_text(" ", strip=True)) if title_node else None
    if external_id != ref.external_id or title != ref.title:
        raise ValueError("Recruiter detail identity does not match its listing")

    contents = soup.select_one("#viewSmartEditorContent")
    if contents is None:
        textarea = soup.select_one("textarea#jobnoticeContents")
        embedded = textarea.get_text() if textarea is not None else ""
        embedded_soup = BeautifulSoup(embedded, "lxml")
        contents = embedded_soup.body
    if contents is None:
        raise ValueError("Recruiter job detail content is missing")

    description_html = str(contents)
    description_text = structured_plain_text(description_html)
    career_min, career_max = _career_range_from_title(description_text)
    has_newcomer = "신입" in description_text
    has_experience = "경력" in description_text or career_min is not None
    career_type = (
        "mixed"
        if has_newcomer and has_experience
        else "new_comer"
        if has_newcomer
        else "experienced"
        if has_experience
        else None
    )
    employment_type = (
        "contract"
        if "계약직" in description_text
        else "intern"
        if "인턴" in description_text
        else "regular"
        if "정규직" in description_text
        else None
    )
    write_state = (
        _text(str(write_state_node.get("value") or ""))
        if write_state_node
        else None
    )
    return ParsedOpening(
        external_id=ref.external_id,
        url=ref.public_url,
        title=title,
        status="open" if write_state == "WRITEABLE" else "closed",
        description_html=description_html,
        description_text=description_text,
        employment_type=employment_type,
        career_type=career_type,
        career_min=career_min,
        career_max=career_max,
        location=_labeled_value(description_text, "근무지"),
        opens_at=ref.opens_at,
        closes_at=ref.closes_at,
    )


def _dunamu_opening(
    raw_html: str,
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    soup = BeautifulSoup(raw_html, "lxml")
    title_node = soup.select_one(".detailView_title")
    information = soup.select_one(".detailView_information")
    title = _text(title_node.get_text(" ", strip=True)) if title_node else None
    if title is None or title != ref.title:
        raise ValueError("Dunamu detail identity does not match its listing")
    if information is None:
        raise ValueError("Dunamu detail content is missing")

    description_html = str(information)
    description_text = structured_plain_text(description_html)
    employment_label = _labeled_value(description_text, "고용형태") or ""
    career_label = _labeled_value(description_text, "채용유형") or ""
    employment_type = (
        _employment_type_from_title(employment_label)
        if employment_label
        else None
    )
    career_type = _career_type_from_title(career_label)

    return ParsedOpening(
        external_id=ref.external_id,
        url=ref.public_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_text,
        employment_type=employment_type,
        career_type=career_type,
        career_min=None,
        career_max=None,
        location=_labeled_value(description_text, "근무지역"),
        opens_at=None,
        closes_at=None,
    )


def _dunamu_api_opening(
    raw_json: str,
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    matched_row: dict[str, Any] | None = None
    for row in _dunamu_api_rows(raw_json):
        raw_id = row.get("id")
        if not isinstance(raw_id, bool) and str(raw_id) == ref.external_id:
            matched_row = row
            break
    if matched_row is None:
        raise ValueError("Dunamu API detail identity is missing")

    title = _text(matched_row.get("name"))
    group_code = _text(matched_row.get("jobGroupCode"))
    career_code = _text(matched_row.get("experienceLevel")) or "NONE"
    employment_code = _text(matched_row.get("employmentType")) or "NONE"
    category = (
        DUNAMU_JOB_GROUP_LABELS.get(
            group_code,
            group_code.removeprefix("T_").replace("_", " ").title(),
        )
        if group_code is not None
        else None
    )
    if title != ref.title or category != ref.category:
        raise ValueError("Dunamu API detail identity does not match its listing")
    if career_code not in DUNAMU_CAREER_LABELS:
        raise ValueError("Dunamu API career type is unsupported")
    if employment_code not in DUNAMU_EMPLOYMENT_LABELS:
        raise ValueError("Dunamu API employment type is unsupported")

    description_text = "\n".join(
        (
            f"직군: {category}",
            f"경력 조건: {DUNAMU_CAREER_LABELS[career_code]}",
            f"고용 형태: {DUNAMU_EMPLOYMENT_LABELS[employment_code]}",
        )
    )
    return ParsedOpening(
        external_id=ref.external_id,
        url=ref.public_url,
        title=title,
        status="open",
        description_html="",
        description_text=description_text,
        employment_type=DUNAMU_EMPLOYMENT_TYPES.get(employment_code),
        career_type=DUNAMU_CAREER_TYPES[career_code],
        career_min=None,
        career_max=None,
        location=None,
        opens_at=None,
        closes_at=None,
    )


def _elice_field_text(value: Any) -> str | None:
    if isinstance(value, str):
        return _text(value)
    if isinstance(value, dict):
        return _text(value.get("label"))
    if not isinstance(value, list):
        return None

    parts: list[str] = []
    for item in value:
        part = _text(item) if isinstance(item, str) else None
        if part is None and isinstance(item, dict):
            part = _text(item.get("label"))
        if part is not None:
            parts.append(part)
    return "\n".join(parts) or None


def _elice_career_type(label: str | None) -> str | None:
    normalized = (label or "").replace(" ", "").casefold()
    if not normalized:
        return None
    if "무관" in normalized or ("신입" in normalized and "경력" in normalized):
        return "mixed"
    if "신입" in normalized:
        return "new_comer"
    if "경력" in normalized or "senior" in normalized:
        return "experienced"
    return None


def _elice_employment_type(label: str | None) -> str | None:
    normalized = (label or "").casefold()
    if "정규" in normalized or "full" in normalized:
        return "regular"
    if "계약" in normalized or "contract" in normalized:
        return "contract"
    if "인턴" in normalized or "intern" in normalized:
        return "intern"
    return label


def _elice_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    external_id = _text(payload.get("id"))
    fields = payload.get("fields")
    title = (
        _text(fields.get("포지션")) if isinstance(fields, dict) else None
    )
    if (
        external_id != ref.external_id
        or title != ref.title
        or not isinstance(fields, dict)
    ):
        raise ValueError("Elice detail identity does not match its listing")

    section_fields = (
        ("팀 소개", "팀소개 헤더", "팀소개 내용"),
        ("직무 소개", "직무 헤더", "직무 인트로"),
        ("성장 기회", "성장기회 헤더", "성장기회 내용"),
        ("주요 업무", "주요업무 헤더", "주요업무 내용"),
        ("자격 요건", "자격요건 헤더", "자격요건 내용"),
        ("우대 사항", "우대사항 헤더", "우대사항 내용"),
    )
    if not any(
        _elice_field_text(fields.get(key))
        for key in ("직무 인트로", "주요업무 내용", "자격요건 내용")
    ):
        raise ValueError("Elice job detail content is missing")

    sections: list[str] = []
    for fallback_heading, heading_key, body_key in section_fields:
        body = _elice_field_text(fields.get(body_key))
        if body is None:
            continue
        heading = _elice_field_text(fields.get(heading_key)) or fallback_heading
        sections.append(
            f"<section><h3>{escape(heading)}</h3>"
            f"<p>{escape(body).replace(chr(10), '<br>')}</p></section>"
        )
    description_html = "".join(sections)
    description_text = structured_plain_text(description_html)
    career_match = re.search(r"(\d+)\s*년\s*이상", description_text)
    career_label = _elice_field_text(fields.get("경력사항"))
    employment_label = _elice_field_text(fields.get("고용형태"))
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_text,
        employment_type=_elice_employment_type(employment_label),
        career_type=_elice_career_type(career_label),
        career_min=int(career_match.group(1)) if career_match else None,
        career_max=None,
        location=_elice_field_text(fields.get("근무지")),
        opens_at=None,
        closes_at=None,
    )


def _ninehire_opening(
    raw_html: str,
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    data = extract_next_data(raw_html)
    try:
        page_props = data["props"]["pageProps"]
        recruitment = page_props["recruitment"]
        job_posting = page_props["jobPosting"]
    except (KeyError, TypeError) as error:
        raise ValueError("Ninehire job detail is missing") from error
    if not isinstance(recruitment, dict) or not isinstance(job_posting, dict):
        raise ValueError("Ninehire job detail must be an object")

    external_id = _text(recruitment.get("recruitmentId"))
    title = _text(recruitment.get("externalTitle")) or _text(
        recruitment.get("title")
    )
    if external_id != ref.external_id or title != ref.title:
        raise ValueError("Ninehire detail identity does not match its listing")

    description_html = _text(job_posting.get("content")) or ""
    if not description_html:
        raise ValueError("Ninehire job detail content is missing")

    career = recruitment.get("career")
    career_type = None
    career_min = None
    career_max = None
    if isinstance(career, dict):
        career_type = {
            "experienced": "experienced",
            "new_comer": "new_comer",
            "newcomer": "new_comer",
        }.get(_text(career.get("type")) or "")
        career_range = career.get("range")
        if isinstance(career_range, dict):
            career_min = _positive_int(career_range.get("over"))
            career_max = _positive_int(career_range.get("below"))
            career_min = career_min or None
            career_max = career_max or None

    raw_employment_types = recruitment.get("employmentType")
    employment_types = (
        raw_employment_types if isinstance(raw_employment_types, list) else []
    )
    employment_map = {
        "contractor": "contract",
        "full_time": "regular",
        "intern": "intern",
    }
    mapped_employment_types = list(
        dict.fromkeys(
            employment_map.get(item, item)
            for item in employment_types
            if isinstance(item, str) and item
        )
    )

    raw_locations = recruitment.get("jobLocations")
    locations = raw_locations if isinstance(raw_locations, list) else []
    location_names: list[str] = []
    for location in locations:
        if not isinstance(location, dict):
            continue
        name = _text(location.get("addressName")) or _text(
            location.get("placeName")
        )
        if name:
            location_names.append(name)

    is_open = (
        recruitment.get("status") == "in_progress"
        and job_posting.get("isActive") is not False
    )
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="open" if is_open else "closed",
        description_html=description_html,
        description_text=structured_plain_text(description_html),
        employment_type=", ".join(mapped_employment_types) or None,
        career_type=career_type,
        career_min=career_min,
        career_max=career_max,
        location=", ".join(dict.fromkeys(location_names)) or None,
        opens_at=_parse_datetime(recruitment.get("createdAt")),
        closes_at=_parse_datetime(recruitment.get("deadlineValue")),
    )


def _roundhr_location(
    application_form: dict[str, Any],
    page_props: dict[str, Any],
) -> str | None:
    location_labels: list[str] = []
    raw_locations = application_form.get("locations")
    if isinstance(raw_locations, list):
        for location in raw_locations:
            if not isinstance(location, dict):
                continue
            location_title = _text(location.get("title"))
            address = _text(location.get("address")) or _text(
                location.get("name")
            )
            parts = [
                value
                for value in (
                    location_title,
                    address,
                    _text(location.get("address_detail")),
                )
                if value is not None
            ]
            label = " ".join(dict.fromkeys(parts))
            if label:
                location_labels.append(label)

    if not location_labels:
        site_config = page_props.get("site_config")
        organization = (
            site_config.get("organization")
            if isinstance(site_config, dict)
            else None
        )
        if isinstance(organization, dict):
            organization_parts = [
                value
                for value in (
                    _text(organization.get("address")),
                    _text(organization.get("address_detail")),
                )
                if value is not None
            ]
            organization_label = " ".join(dict.fromkeys(organization_parts))
            if organization_label:
                location_labels.append(organization_label)

    if application_form.get("enable_remote") is True:
        location_labels.append("원격 근무 가능")
    return ", ".join(dict.fromkeys(location_labels)) or None


def _roundhr_opening(
    raw_html: str,
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    data = extract_next_data(raw_html)
    try:
        page_props = data["props"]["pageProps"]
        dehydrated_state = page_props["_dehydratedState"]
        queries = dehydrated_state["queries"]
    except (KeyError, TypeError) as error:
        raise ValueError("RoundHR public job detail is missing") from error
    if not isinstance(page_props, dict) or not isinstance(queries, list):
        raise ValueError("RoundHR public job detail must be an object")

    parsed_url = urlsplit(ref.detail_url)
    path_segments = [
        segment for segment in parsed_url.path.split("/") if segment
    ]
    if (
        parsed_url.scheme != "https"
        or not (parsed_url.hostname or "").endswith(".recruit.roundhr.com")
        or len(path_segments) != 2
        or path_segments[0] != "c"
    ):
        raise ValueError("RoundHR public job detail URL is invalid")
    form_code = path_segments[1]

    application_form: dict[str, Any] | None = None
    for query in queries:
        if not isinstance(query, dict):
            continue
        if query.get("queryKey") != [
            "SiteApplicationForm",
            "show",
            form_code,
        ]:
            continue
        state = query.get("state")
        candidate = state.get("data") if isinstance(state, dict) else None
        if isinstance(candidate, dict):
            application_form = candidate
            break
    if application_form is None:
        raise ValueError("RoundHR public application form is missing")

    raw_job_id = application_form.get("job_id")
    job = application_form.get("job")
    if not isinstance(job, dict):
        raise ValueError("RoundHR public job identity is missing")
    raw_embedded_job_id = job.get("id")
    external_id = (
        None
        if raw_job_id is None or isinstance(raw_job_id, bool)
        else str(raw_job_id)
    )
    embedded_job_id = (
        None
        if raw_embedded_job_id is None or isinstance(raw_embedded_job_id, bool)
        else str(raw_embedded_job_id)
    )
    title = _text(job.get("site_title")) or _text(job.get("title"))
    if (
        external_id != ref.external_id
        or embedded_job_id != ref.external_id
        or _text(application_form.get("code")) != form_code
        or title != ref.title
    ):
        raise ValueError("RoundHR detail identity does not match its listing")

    content_fields = (
        (None, "intro_content"),
        ("주요 업무", "main_task_content"),
        ("자격 요건", "requirement_content"),
        ("우대 사항", "preferred_point_content"),
        ("복지 및 혜택", "benefit_content"),
        ("채용 절차", "hire_round_content"),
    )
    description_parts: list[str] = []
    for heading, field in content_fields:
        content = _text(application_form.get(field))
        if content is None:
            continue
        if heading is not None:
            description_parts.append(f"<h3>{heading}</h3>")
        description_parts.append(content)
    if not description_parts:
        raise ValueError("RoundHR public job detail content is missing")
    description_html = "".join(description_parts)

    career_type = {
        "experienced": "experienced",
        "new_comer": "new_comer",
        "newcomer": "new_comer",
        "new": "new_comer",
        "entry_level": "new_comer",
        "mixed": "mixed",
        "not_matter": "not_matter",
        "not_required": "not_matter",
    }.get(_text(application_form.get("career_kind")) or "")
    raw_employment_type = _text(application_form.get("employment_type"))
    employment_type = {
        "full_time": "FULL_TIME",
        "contract": "CONTRACT",
        "intern": "INTERN",
        "part_time": "PART_TIME",
        "freelancer": "FREELANCER",
    }.get(raw_employment_type or "", raw_employment_type)
    # RoundHR tenants use open_status inconsistently: current public and
    # directly applicable postings can return either true or false. The
    # shared lifecycle fields below are consistent across verified tenants.
    is_open = (
        application_form.get("status") == "in_progress"
        and application_form.get("expired") is not True
        and job.get("deleted") is not True
    )
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="open" if is_open else "closed",
        description_html=description_html,
        description_text=structured_plain_text(description_html),
        employment_type=employment_type,
        career_type=career_type,
        career_min=_positive_int(application_form.get("career_start")) or None,
        career_max=_positive_int(application_form.get("career_end")) or None,
        location=_roundhr_location(application_form, page_props),
        opens_at=_parse_datetime(application_form.get("created_at")),
        closes_at=_parse_datetime(application_form.get("end_at")),
    )


def _workable_career_range(text: str) -> tuple[int | None, int | None]:
    range_patterns = (
        r"(\d+)\s*[~\-–]\s*(\d+)\s*년",
        r"(\d+)\s*[~\-–]\s*(\d+)\s*years?",
    )
    for pattern in range_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match is not None:
            return int(match.group(1)), int(match.group(2))

    minimum_patterns = (
        r"(\d+)\s*년\s*이상",
        r"(?:at\s+least|minimum(?:\s+of)?)\s*(\d+)\+?\s*years?",
        r"(\d+)\+\s*years?",
    )
    for pattern in minimum_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match is not None:
            return int(match.group(1)), None
    return None, None


def _workable_location(payload: dict[str, Any]) -> str | None:
    raw_locations = payload.get("locations")
    locations = raw_locations if isinstance(raw_locations, list) else []
    if not locations:
        locations = [payload.get("location")]
    labels = [
        label
        for location in locations
        if (label := _workable_location_label(location)) is not None
    ]
    if payload.get("remote") is True or payload.get("workplace") == "remote":
        labels.append("원격 근무")
    return " / ".join(dict.fromkeys(labels)) or None


def _workable_opening(
    payload: dict[str, Any],
    ref: PublicJsonDetailRef,
) -> ParsedOpening:
    raw_id = payload.get("id")
    external_id = (
        None
        if raw_id is None or isinstance(raw_id, bool)
        else str(raw_id)
    )
    shortcode = _text(payload.get("shortcode"))
    title = _text(payload.get("title"))
    if (
        external_id != ref.external_id
        or title != ref.title
        or shortcode is None
        or not ref.detail_url.endswith(f"/{shortcode}")
    ):
        raise ValueError("Workable detail identity does not match its listing")

    content_fields = (
        (None, "description"),
        ("자격 요건", "requirements"),
        ("복지 및 혜택", "benefits"),
    )
    description_parts: list[str] = []
    for heading, field in content_fields:
        content = _text(payload.get(field))
        if content is None:
            continue
        if heading is not None:
            description_parts.append(f"<h3>{heading}</h3>")
        description_parts.append(content)
    if not description_parts:
        raise ValueError("Workable public job detail content is missing")
    description_html = "".join(description_parts)
    description_text = structured_plain_text(description_html)
    requirements_text = structured_plain_text(
        _text(payload.get("requirements")) or ""
    )
    career_min, career_max = _workable_career_range(requirements_text)

    lower_title = title.lower()
    career_type = _career_type_from_title(title)
    if career_type is None and "intern" in lower_title:
        career_type = "new_comer"
    if career_type is None and (
        career_min is not None
        or any(
            marker in lower_title
            for marker in ("senior", "lead", "director", "head of")
        )
    ):
        career_type = "experienced"

    raw_employment_type = _text(payload.get("type"))
    employment_type = {
        "full": "regular",
        "part": "part_time",
        "contract": "contract",
        "temporary": "temporary",
        "other": "other",
    }.get(raw_employment_type or "", raw_employment_type)
    if "intern" in lower_title:
        employment_type = "intern"

    is_open = (
        payload.get("state") == "published"
        and payload.get("isInternal") is not True
        and payload.get("approvalStatus") in {None, "approved"}
    )
    return ParsedOpening(
        external_id=external_id,
        url=ref.public_url,
        title=title,
        status="open" if is_open else "closed",
        description_html=description_html,
        description_text=description_text,
        employment_type=employment_type,
        career_type=career_type,
        career_min=career_min,
        career_max=career_max,
        location=_workable_location(payload),
        opens_at=_parse_datetime(payload.get("published")),
        closes_at=None,
    )


def parse_public_json_detail(
    raw_json: str,
    ref: PublicJsonDetailRef,
    connector_family: str,
) -> ParsedOpening:
    if connector_family in DUNAMU_CONNECTOR_FAMILIES:
        if raw_json.lstrip().startswith("{"):
            return _dunamu_api_opening(raw_json, ref)
        return _dunamu_opening(raw_json, ref)
    if connector_family in {
        "ably_next_ninehire_tech",
        "ninehire_public_api_tech",
    }:
        return _ninehire_opening(raw_json, ref)
    if connector_family == "ncsoft_session_html_tech":
        return _ncsoft_opening(raw_json, ref)
    if connector_family in RECRUITER_LEGACY_CONNECTOR_FAMILIES:
        return _recruiter_legacy_opening(raw_json, ref)
    if connector_family == "banksalad_greeting_api_tech":
        opening = parse_greeting_opening(raw_json, ref.detail_url)
        if opening.external_id != ref.external_id or opening.title != ref.title:
            raise ValueError(
                "Banksalad Greeting detail identity does not match its listing"
            )
        return replace(opening, url=ref.public_url)
    if connector_family == "roundhr_public_api_tech":
        return _roundhr_opening(raw_json, ref)
    payload = _decode_object(raw_json)
    if connector_family == "elice_softr_public_api_tech":
        return _elice_opening(payload, ref)
    if connector_family == "workable_public_api_tech":
        return _workable_opening(payload, ref)
    if connector_family == "woowahan_public_api_tech":
        return _woowahan_opening(payload, ref)
    if connector_family == "kakaobank_public_api_tech":
        return _kakaobank_opening(payload, ref)
    if connector_family == "netmarble_public_api_tech":
        return _netmarble_opening(payload, ref)
    if connector_family == "nhn_public_api_tech":
        return _nhn_opening(payload, ref)
    if connector_family == "com2us_jobflex_tech":
        return _com2us_opening(payload, ref)
    raise ValueError(f"unsupported public JSON detail family: {connector_family}")
