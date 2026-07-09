import hashlib
import re
from datetime import datetime
from urllib.parse import parse_qsl, urljoin, urlparse
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.types import ParsedOpening


KST = ZoneInfo("Asia/Seoul")
DATE_PATTERN = re.compile(
    r"(?P<year>20\d{2})[.\-/](?P<month>\d{1,2})[.\-/](?P<day>\d{1,2})"
)
JOB_PATH_MARKERS = (
    "job",
    "jobs",
    "opening",
    "recruit",
    "apply",
    "career",
)
NAVIGATION_TITLES = {
    "about",
    "about us",
    "career",
    "careers",
    "culture",
    "hiring process",
    "jobs",
    "job openings",
    "top",
}
JOB_TITLE_MARKERS = (
    "ai",
    "android",
    "architect",
    "backend",
    "cloud",
    "data",
    "developer",
    "devops",
    "engineer",
    "frontend",
    "ios",
    "machine learning",
    "ml",
    "platform",
    "qa",
    "security",
    "server",
    "software",
    "개발자",
    "데이터",
    "백엔드",
    "보안",
    "서버",
    "소프트웨어",
    "앱",
    "엔지니어",
    "인프라",
    "클라우드",
    "프론트엔드",
    "플랫폼",
)


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _has_job_title_signal(title: str) -> bool:
    lowered = title.lower()
    return any(marker in lowered for marker in JOB_TITLE_MARKERS)


def _has_posting_signal(link: Tag, title: str) -> bool:
    container_text = _container_text(link)
    dates = _date_values(container_text)
    time_date = _time_date(link)
    if "더보기" in title and not dates and time_date is None:
        return False
    return _has_job_title_signal(title) or bool(dates) or time_date is not None


def _candidate_links(soup: BeautifulSoup) -> list[Tag]:
    links: list[Tag] = []
    for link in soup.find_all("a", href=True):
        if not isinstance(link, Tag):
            continue
        href = str(link.get("href") or "").strip()
        title = _clean_text(link.get_text(" ", strip=True))
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        if title.lower() in NAVIGATION_TITLES:
            continue
        lowered_href = href.lower()
        if not any(marker in lowered_href for marker in JOB_PATH_MARKERS):
            continue
        if len(title) < 4:
            continue
        if not _has_posting_signal(link, title):
            continue
        links.append(link)
    return links


def _link_title(link: Tag) -> str:
    title_node = link.select_one(".title")
    if isinstance(title_node, Tag):
        title = _clean_text(title_node.get_text(" ", strip=True))
        if title:
            return title
    return _clean_text(link.get_text(" ", strip=True))


def _container_text(link: Tag) -> str:
    container = link.find_parent(["article", "li", "tr", "div", "section"])
    if not isinstance(container, Tag):
        container = link
    return _clean_text(container.get_text(" ", strip=True))


def _external_id(url: str) -> str:
    parsed = urlparse(url)
    query_values = dict(parse_qsl(parsed.query))
    for key in (
        "_jobOpeningNo",
        "jobOpeningNo",
        "jobId",
        "job_id",
        "id",
        "no",
        "seq",
    ):
        value = query_values.get(key)
        if value:
            return value
    path = parsed.path.rstrip("/")
    tail = path.rsplit("/", maxsplit=1)[-1]
    if tail:
        return tail
    return hashlib.sha256(url.encode()).hexdigest()[:32]


def _parse_date(value: str) -> datetime | None:
    match = DATE_PATTERN.search(value)
    if match is None:
        return None
    return datetime(
        int(match.group("year")),
        int(match.group("month")),
        int(match.group("day")),
        tzinfo=KST,
    )


def _date_values(text: str) -> list[datetime]:
    return [
        parsed
        for parsed in (_parse_date(match.group(0)) for match in DATE_PATTERN.finditer(text))
        if parsed is not None
    ]


def _time_date(link: Tag) -> datetime | None:
    container = link.find_parent(["article", "li", "tr", "div", "section"])
    if not isinstance(container, Tag):
        return None
    for node in container.find_all("time"):
        if not isinstance(node, Tag):
            continue
        for value in (node.get("datetime"), node.get_text(" ", strip=True)):
            if isinstance(value, str):
                parsed = _parse_date(value)
                if parsed is not None:
                    return parsed
    return None


def _employment_type(text: str) -> str | None:
    if "정규" in text:
        return "regular"
    if "계약" in text:
        return "contract"
    if "인턴" in text:
        return "intern"
    return None


def _career_type(text: str) -> str | None:
    has_newcomer = "신입" in text
    has_experienced = "경력" in text
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _location(text: str) -> str | None:
    for location in ("서울", "판교", "성남", "수원", "대전", "부산", "대구", "광주", "울산"):
        if location in text:
            return location
    return None


def _is_samsung_careers_listing(listing_url: str) -> bool:
    parsed = urlparse(listing_url)
    return (
        parsed.netloc == "www.samsungcareers.com"
        and parsed.path.rstrip("/") == "/hr/list.data"
    )


def _samsung_careers_id(value: str) -> str:
    return re.sub(r"\D", "", value)


def _samsung_careers_openings(
    soup: BeautifulSoup,
    listing_url: str,
) -> list[ParsedOpening]:
    parsed_url = urlparse(listing_url)
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()

    for link in soup.select("li a[data-value]"):
        if not isinstance(link, Tag):
            continue
        external_id = _samsung_careers_id(str(link.get("data-value") or ""))
        title_node = link.select_one(".title")
        company_node = link.select_one(".company")
        if not external_id or not isinstance(title_node, Tag):
            continue
        if external_id in seen_ids:
            continue
        seen_ids.add(external_id)

        title = _clean_text(title_node.get_text(" ", strip=True))
        company = (
            _clean_text(company_node.get_text(" ", strip=True))
            if isinstance(company_node, Tag)
            else ""
        )
        info = _clean_text(
            " ".join(
                node.get_text(" ", strip=True)
                for node in link.select(".info span")
                if isinstance(node, Tag)
            )
        )
        container = link.find_parent("li")
        flags = ""
        if isinstance(container, Tag):
            flags = _clean_text(
                " ".join(
                    node.get_text(" ", strip=True)
                    for node in container.select(".flagWrap .flag.grey")
                    if isinstance(node, Tag)
                )
            )
        description_text = _clean_text(
            " ".join(value for value in (company, title, info, flags) if value)
        )
        dates = _date_values(description_text)

        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=f"{base_url}/hr/?no={external_id}",
                title=title,
                status="open",
                description_html="",
                description_text=description_text,
                employment_type=_employment_type(description_text),
                career_type=_career_type(description_text),
                career_min=None,
                career_max=None,
                location=_location(description_text),
                opens_at=dates[0] if len(dates) >= 2 else None,
                closes_at=dates[-1] if dates else None,
            )
        )

    return openings


def parse_html_listing_openings(
    html: str,
    listing_url: str,
) -> list[ParsedOpening]:
    soup = BeautifulSoup(html, "lxml")
    if _is_samsung_careers_listing(listing_url):
        return _samsung_careers_openings(soup, listing_url)

    openings: list[ParsedOpening] = []
    seen_urls: set[str] = set()

    for link in _candidate_links(soup):
        title = _link_title(link)
        url = urljoin(listing_url, str(link.get("href")))
        if url in seen_urls:
            continue
        seen_urls.add(url)

        description_text = _container_text(link)
        dates = _date_values(description_text)
        closes_at = dates[-1] if dates else _time_date(link)

        openings.append(
            ParsedOpening(
                external_id=_external_id(url),
                url=url,
                title=title,
                status="open",
                description_html="",
                description_text=description_text,
                employment_type=_employment_type(description_text),
                career_type=_career_type(description_text),
                career_min=None,
                career_max=None,
                location=_location(description_text),
                opens_at=dates[0] if len(dates) >= 2 else None,
                closes_at=closes_at,
            )
        )

    return openings
