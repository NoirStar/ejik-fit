import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from urllib.parse import urljoin, urlparse


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
