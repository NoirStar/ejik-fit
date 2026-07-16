import re
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.types import ParsedOpening


GOOGLE_CAREERS_HOST = "www.google.com"
GOOGLE_CAREERS_BASE = "https://www.google.com/about/careers/applications/"
GOOGLE_RESULTS_PATH = "/about/careers/applications/jobs/results/"
GOOGLE_JOB_PATH = re.compile(
    r"^/about/careers/applications/jobs/results/"
    r"(?P<external_id>\d+)(?:-[^/?#]+)?/?$"
)
EXPLICIT_YEARS_PATTERN = re.compile(
    r"(?<!\d)(?P<years>\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience\b",
    re.IGNORECASE,
)
TECHNICAL_TITLE_MARKERS = (
    "architect",
    "developer",
    "engineer",
)


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _validate_listing_url(url: str) -> None:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    location = " ".join(query.get("location", [])).casefold()
    search_term = " ".join(query.get("q", [])).casefold()
    if (
        parsed.scheme != "https"
        or parsed.hostname != GOOGLE_CAREERS_HOST
        or parsed.path != GOOGLE_RESULTS_PATH
        or "seoul" not in location
        or search_term != "engineer"
    ):
        raise ValueError(
            "Google listing must use the official Seoul engineer search"
        )


def _job_identity(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != GOOGLE_CAREERS_HOST:
        raise ValueError("job URL must use the official Google Careers host")
    match = GOOGLE_JOB_PATH.fullmatch(parsed.path)
    if match is None:
        raise ValueError("official Google Careers job URL is missing a job ID")
    canonical_url = urlunparse(parsed._replace(query="", fragment=""))
    return match.group("external_id"), canonical_url


def is_google_technical_role(title: str) -> bool:
    lowered = _clean_text(title).casefold()
    return any(marker in lowered for marker in TECHNICAL_TITLE_MARKERS)


def _listing_total(soup: BeautifulSoup) -> int:
    values = {
        _clean_text(node.get_text(" ", strip=True)).replace(",", "")
        for node in soup.select(".rZt9ff .SWhIm")
        if isinstance(node, Tag)
    }
    if len(values) != 1:
        raise ValueError("Google listing is missing a stable result total")
    value = next(iter(values))
    if not value.isdigit():
        raise ValueError("Google listing result total is invalid")
    return int(value)


def parse_google_korea_listing_openings(
    html: str,
    listing_url: str,
) -> list[ParsedOpening]:
    _validate_listing_url(listing_url)
    soup = BeautifulSoup(html, "lxml")
    total = _listing_total(soup)
    links = [
        link
        for link in soup.select('a[href*="jobs/results/"]')
        if isinstance(link, Tag)
        and str(link.get("aria-label") or "").startswith("Learn more about ")
        and GOOGLE_JOB_PATH.fullmatch(
            urlparse(
                urljoin(GOOGLE_CAREERS_BASE, str(link.get("href") or ""))
            ).path
        )
    ]
    if len(links) != total:
        raise ValueError(
            f"Google listing is incomplete: expected {total}, received {len(links)}"
        )

    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()
    for link in links:
        title = _clean_text(
            str(link.get("aria-label"))[len("Learn more about ") :]
        )
        detail_url = urljoin(
            GOOGLE_CAREERS_BASE,
            str(link.get("href") or ""),
        )
        external_id, canonical_url = _job_identity(detail_url)
        if external_id in seen_ids:
            raise ValueError("Google listing contains a duplicate job ID")
        seen_ids.add(external_id)
        if not is_google_technical_role(title):
            continue

        card = link.find_parent("div", class_="Ln1EL")
        location_node = (
            card.select_one(".r0wTof") if isinstance(card, Tag) else None
        )
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


def _career_type(root: Tag, title: str) -> str | None:
    level_node = root.select_one(".op1BBf .wVSTAb, .op1BBf .BK5CCe")
    level = (
        _clean_text(level_node.get_text(" ", strip=True)).casefold()
        if isinstance(level_node, Tag)
        else ""
    )
    lowered_title = title.casefold()
    if "intern" in lowered_title or level == "early":
        return "new_comer"
    if level in {"mid", "advanced"}:
        return "experienced"
    return None


def _employment_type(title: str) -> str | None:
    lowered = title.casefold()
    if "intern" in lowered:
        return "인턴"
    if "fixed-term" in lowered or "temporary" in lowered:
        return "계약직"
    return None


def _minimum_qualification_text(root: Tag) -> str:
    for heading in root.select(".KwJkGe h3"):
        if not heading.get_text(" ", strip=True).casefold().startswith("minimum"):
            continue
        parts: list[str] = []
        for sibling in heading.next_siblings:
            if isinstance(sibling, Tag) and sibling.name == "h3":
                break
            if isinstance(sibling, Tag):
                parts.append(sibling.get_text(" ", strip=True))
        return _clean_text(" ".join(parts))
    return ""


def _career_min(root: Tag) -> int | None:
    match = EXPLICIT_YEARS_PATTERN.search(_minimum_qualification_text(root))
    return int(match.group("years")) if match is not None else None


def _description_sections(root: Tag) -> list[Tag]:
    sections: list[Tag] = []
    qualifications = root.select_one(".KwJkGe")
    if isinstance(qualifications, Tag):
        sections.extend(
            child
            for child in qualifications.children
            if isinstance(child, Tag) and child.name in {"h3", "ul", "p"}
        )
    for selector in (".aG5W3", ".BDNOWe"):
        section = root.select_one(selector)
        if isinstance(section, Tag):
            sections.append(section)
    return sections


def parse_google_job_detail(html: str, detail_url: str) -> ParsedOpening:
    external_id, canonical_url = _job_identity(detail_url)
    soup = BeautifulSoup(html, "lxml")
    root = soup.select_one(f'div.DkhPwc[data-id="{external_id}"]')
    if not isinstance(root, Tag):
        raise ValueError("Google detail is missing its matching job container")

    title_node = root.select_one("h2.p1N2lc")
    if not isinstance(title_node, Tag):
        raise ValueError("Google detail is missing its title")
    title = _clean_text(title_node.get_text(" ", strip=True))
    if not is_google_technical_role(title):
        raise ValueError("Google detail no longer represents a technical role")

    sections = _description_sections(root)
    description_text = _clean_text(
        " ".join(section.get_text(" ", strip=True) for section in sections)
    )
    if len(description_text) < 100:
        raise ValueError("Google detail description is unexpectedly short")
    description_html = "".join(str(section) for section in sections)

    locations = list(
        dict.fromkeys(
            _clean_text(node.get_text(" ", strip=True))
            for node in root.select(".op1BBf .r0wTof")
            if isinstance(node, Tag)
            and _clean_text(node.get_text(" ", strip=True))
        )
    )
    location = " · ".join(locations) or None

    return ParsedOpening(
        external_id=external_id,
        url=canonical_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_text,
        employment_type=_employment_type(title),
        career_type=_career_type(root, title),
        career_min=_career_min(root),
        career_max=None,
        location=location,
        opens_at=None,
        closes_at=None,
    )
