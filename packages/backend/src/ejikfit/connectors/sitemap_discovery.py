import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, replace
from urllib.parse import parse_qs, urljoin, urlparse

from bs4 import BeautifulSoup

from ejikfit.connectors.jsonld import parse_jsonld_openings
from ejikfit.connectors.types import OpeningRef, ParsedOpening
from ejikfit.html_text import structured_plain_text


JOB_MARKERS = (
    "career",
    "careers",
    "job",
    "jobs",
    "recruit",
    "recruiting",
    "position",
    "positions",
    "opening",
    "openings",
    "apply",
)
ROBOTS_SITEMAP_PATTERN = re.compile(r"^\s*sitemap:\s*(?P<url>\S+)\s*$", re.I)
URL_PATTERN = re.compile(r"https?://[^\s<>\"]+|/[A-Za-z0-9_./?&=%-]+")


@dataclass(frozen=True)
class DiscoveryCandidate:
    url: str
    source: str
    reason: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


def _job_reason(url: str) -> str | None:
    parsed = urlparse(url)
    text = f"{parsed.path} {parsed.query}".lower()
    if any(marker in text for marker in ("job", "position", "opening", "apply")):
        return "job_url"
    if any(marker in text for marker in ("career", "recruit")):
        return "career_url"
    return None


def _candidate_url(raw_url: str, source_url: str) -> str | None:
    stripped = raw_url.strip()
    if not stripped:
        return None
    url = urljoin(source_url, stripped)
    return url if _job_reason(url) is not None else None


def _dedupe(candidates: list[DiscoveryCandidate]) -> list[DiscoveryCandidate]:
    deduped: list[DiscoveryCandidate] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate.url in seen:
            continue
        seen.add(candidate.url)
        deduped.append(candidate)
    return deduped


def _parse_xml_sitemap(raw: str, source_url: str) -> list[DiscoveryCandidate]:
    root = ET.fromstring(raw)
    candidates: list[DiscoveryCandidate] = []
    for node in root.iter():
        if not node.tag.lower().endswith("loc") or node.text is None:
            continue
        url = _candidate_url(node.text, source_url)
        if url is None:
            continue
        reason = _job_reason(url)
        if reason is None:
            continue
        candidates.append(
            DiscoveryCandidate(
                url=url,
                source="sitemap",
                reason=reason,
            )
        )
    return _dedupe(candidates)


def _parse_robots(raw: str, source_url: str) -> list[DiscoveryCandidate]:
    candidates: list[DiscoveryCandidate] = []
    for line in raw.splitlines():
        sitemap_match = ROBOTS_SITEMAP_PATTERN.match(line)
        if sitemap_match is not None:
            raw_urls = [sitemap_match.group("url")]
        else:
            raw_urls = URL_PATTERN.findall(line)

        for raw_url in raw_urls:
            url = _candidate_url(raw_url, source_url)
            if url is None:
                continue
            reason = _job_reason(url)
            if reason is None:
                continue
            candidates.append(
                DiscoveryCandidate(
                    url=url,
                    source="robots",
                    reason=reason,
                )
            )
    return _dedupe(candidates)


def parse_sitemap_discovery(
    raw: str,
    source_url: str,
) -> list[DiscoveryCandidate]:
    try:
        return _parse_xml_sitemap(raw, source_url)
    except ET.ParseError:
        return _parse_robots(raw, source_url)


def _detail_external_id(url: str) -> str | None:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    for key in ("job_id", "jobId", "gh_jid", "id", "openingId"):
        values = query.get(key)
        if values and values[0]:
            return values[0]

    segments = [segment for segment in parsed.path.split("/") if segment]
    if not segments:
        return None
    tail = segments[-1]
    if tail.endswith(".xml") or tail.casefold() in {
        "apply",
        "career",
        "careers",
        "job",
        "jobs",
        "recruit",
    }:
        return None
    if any(
        marker in {segment.casefold() for segment in segments[:-1]}
        for marker in (
            "career",
            "careers",
            "job",
            "jobs",
            "recruit",
            "role",
            "opening",
            "openings",
            "position",
        )
    ):
        return tail
    return None


def discover_sitemap_openings(raw: str, source_url: str) -> list[OpeningRef]:
    refs: list[OpeningRef] = []
    seen: set[str] = set()
    source_hostname = urlparse(source_url).hostname
    for candidate in parse_sitemap_discovery(raw, source_url):
        candidate_hostname = urlparse(candidate.url).hostname
        if (
            source_hostname is None
            or candidate_hostname is None
            or candidate_hostname.casefold() != source_hostname.casefold()
        ):
            continue
        external_id = _detail_external_id(candidate.url)
        if external_id is None or external_id in seen:
            continue
        seen.add(external_id)
        refs.append(OpeningRef(external_id=external_id, url=candidate.url))
    if not refs:
        raise ValueError("sitemap contains no job detail URLs")
    return refs


def parse_sitemap_detail_opening(
    html: str,
    page_url: str,
    external_id: str,
    connector_family: str | None = None,
) -> ParsedOpening:
    openings = parse_jsonld_openings(html, page_url)
    if not openings:
        raise ValueError("job detail has no schema.org JobPosting data")

    opening = replace(openings[0], external_id=external_id, url=page_url)
    if connector_family != "furiosa_webflow_korea_tech":
        return opening

    soup = BeautifulSoup(html, "lxml")
    description = soup.select_one(
        "main .rich-text.w-richtext, .rich-text-component .w-richtext"
    )
    if description is None:
        raise ValueError("Furiosa job detail has no visible requirements body")

    description_html = str(description)
    return replace(
        opening,
        description_html=description_html,
        description_text=structured_plain_text(description_html),
        # Furiosa currently places the workplace mode (for example, On-site)
        # in schema.org's employmentType field. Do not expose that as a
        # full-time/contract classification.
        employment_type=None,
    )
