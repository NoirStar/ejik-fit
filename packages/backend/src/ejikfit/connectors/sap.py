import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.types import ParsedOpening


SAP_JOBS_HOST = "jobs.sap.com"
SAP_JOB_PATH = re.compile(r"^/job/.+/(?P<external_id>\d+)/?$")
LISTING_TOTAL_PATTERN = re.compile(r"\bof\s+(?P<total>[\d,]+)\b", re.IGNORECASE)
EXPLICIT_YEARS_PATTERNS = (
    re.compile(
        r"\b(?:minimum(?:\s+of)?|at\s+least)\s+"
        r"(?P<years>\d{1,2})\+?\s*(?:years?|yrs?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?P<years>\d{1,2})\+\s*(?:years?|yrs?)\b",
        re.IGNORECASE,
    ),
)
TECHNICAL_TITLE_MARKERS = (
    "architect",
    "architecture",
    "developer",
    "engineer",
    "it technology services",
)
NON_TECHNICAL_TITLE_MARKERS = (
    "account executive",
    "customer success",
    "health manager",
    "sales",
    "solution advisor",
    "solution advisory",
)


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _job_identity(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != SAP_JOBS_HOST:
        raise ValueError("SAP job URL must use the official jobs.sap.com host")
    match = SAP_JOB_PATH.fullmatch(parsed.path)
    if match is None:
        raise ValueError("SAP job URL is missing a requisition ID")
    return match.group("external_id"), url


def is_sap_technical_role(title: str) -> bool:
    lowered = _clean_text(title).lower()
    if any(marker in lowered for marker in NON_TECHNICAL_TITLE_MARKERS):
        return False
    return any(marker in lowered for marker in TECHNICAL_TITLE_MARKERS)


def _listing_total(soup: BeautifulSoup) -> int:
    label = soup.select_one(".paginationLabel")
    if not isinstance(label, Tag):
        raise ValueError("SAP listing is missing its result total")
    match = LISTING_TOTAL_PATTERN.search(label.get_text(" ", strip=True))
    if match is None:
        raise ValueError("SAP listing result total is invalid")
    return int(match.group("total").replace(",", ""))


def parse_sap_korea_listing_openings(
    html: str,
    listing_url: str,
) -> list[ParsedOpening]:
    parsed_listing = urlparse(listing_url)
    if parsed_listing.scheme != "https" or parsed_listing.hostname != SAP_JOBS_HOST:
        raise ValueError("SAP listing must use the official jobs.sap.com host")

    soup = BeautifulSoup(html, "lxml")
    total = _listing_total(soup)
    rows = soup.select("#searchresults tbody tr.data-row")
    if len(rows) != total:
        raise ValueError(
            f"SAP listing is incomplete: expected {total}, received {len(rows)}"
        )

    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()
    for row in rows:
        link = row.select_one("a.jobTitle-link")
        if not isinstance(link, Tag):
            raise ValueError("SAP listing row is missing its job link")
        title = _clean_text(link.get_text(" ", strip=True))
        url = urljoin(listing_url, str(link.get("href") or ""))
        external_id, canonical_url = _job_identity(url)
        if external_id in seen_ids:
            raise ValueError("SAP listing contains a duplicate requisition ID")
        seen_ids.add(external_id)
        if not is_sap_technical_role(title):
            continue

        location_node = row.select_one(".colLocation .jobLocation")
        location = (
            _clean_text(location_node.get_text(" ", strip=True))
            if isinstance(location_node, Tag)
            else None
        )
        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=canonical_url,
                title=title,
                status="open",
                description_html="",
                description_text=" ".join(
                    value for value in (title, location) if value
                ),
                employment_type=None,
                career_type=None,
                career_min=None,
                career_max=None,
                location=location,
                opens_at=None,
                closes_at=None,
            )
        )
    return openings


def _property_text(soup: BeautifulSoup, property_id: str) -> str | None:
    node = soup.select_one(f'[data-careersite-propertyid="{property_id}"]')
    if not isinstance(node, Tag):
        return None
    value = _clean_text(node.get_text(" ", strip=True))
    return value or None


def _employment_type(value: str | None, title: str) -> str | None:
    lowered = f"{value or ''} {title}".lower()
    if "intern" in lowered or "student" in lowered:
        return "인턴"
    if "temporary" in lowered or "limited" in lowered:
        return "계약직"
    if "regular" in lowered or "full time" in lowered:
        return "정규직"
    return value


def _career_type(value: str | None, title: str) -> str | None:
    lowered = f"{value or ''} {title}".lower()
    if "intern" in lowered or "student" in lowered or "graduate" in lowered:
        return "new_comer"
    if "professional" in lowered:
        return "experienced"
    return None


def _career_min(description: str) -> int | None:
    for pattern in EXPLICIT_YEARS_PATTERNS:
        match = pattern.search(description)
        if match is not None:
            return int(match.group("years"))
    return None


def _posted_at(soup: BeautifulSoup) -> datetime | None:
    meta = soup.select_one('meta[itemprop="datePosted"]')
    if isinstance(meta, Tag):
        value = str(meta.get("content") or "").strip()
        if value:
            try:
                parsed = parsedate_to_datetime(value)
            except (TypeError, ValueError):
                parsed = None
            if parsed is not None:
                if parsed.tzinfo is None:
                    return parsed.replace(tzinfo=timezone.utc)
                return parsed

    value = _property_text(soup, "date")
    if value is None:
        return None
    try:
        return datetime.strptime(value, "%b %d, %Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_sap_job_detail(html: str, detail_url: str) -> ParsedOpening:
    external_id, canonical_url = _job_identity(detail_url)
    soup = BeautifulSoup(html, "lxml")
    title_node = soup.select_one('[itemprop="title"]')
    description_node = soup.select_one('[itemprop="description"]')
    if not isinstance(title_node, Tag) or not isinstance(description_node, Tag):
        raise ValueError("SAP detail is missing its title or description")

    title = _clean_text(title_node.get_text(" ", strip=True))
    if not is_sap_technical_role(title):
        raise ValueError("SAP detail no longer represents a technical role")
    description_text = _clean_text(description_node.get_text(" ", strip=True))
    if len(description_text) < 80:
        raise ValueError("SAP detail description is unexpectedly short")

    department = _property_text(soup, "department")
    career_status = _property_text(soup, "customfield3")
    employment = _property_text(soup, "shifttype")
    location = _property_text(soup, "location")
    description_with_context = " ".join(
        value for value in (department, description_text) if value
    )

    return ParsedOpening(
        external_id=external_id,
        url=canonical_url,
        title=title,
        status="open",
        description_html=str(description_node),
        description_text=description_with_context,
        employment_type=_employment_type(employment, title),
        career_type=_career_type(career_status, title),
        career_min=_career_min(description_text),
        career_max=None,
        location=location,
        opens_at=_posted_at(soup),
        closes_at=None,
    )
