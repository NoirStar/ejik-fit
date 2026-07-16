import re
from datetime import datetime
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.types import ParsedOpening


MOBIS_CAREERS_HOST = "careers.mobis.com"
MOBIS_LISTING_PATH = "/jobs"
MOBIS_DETAIL_PATH = "/jobs-view"
MOBIS_TECHNICAL_JOB_GROUPS = {"SW/로직"}
KST = ZoneInfo("Asia/Seoul")
DATE_TIME_PATTERN = re.compile(
    r"(?P<year>20\d{2})-(?P<month>\d{1,2})-(?P<day>\d{1,2})"
    r"(?:\s+(?P<hour>\d{1,2}):(?P<minute>\d{2}))?"
)
CAREER_YEARS_PATTERN = re.compile(r"(?<!\d)(?P<years>\d{1,2})\s*년\s*이상")


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _validate_listing_url(url: str) -> None:
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname != MOBIS_CAREERS_HOST
        or parsed.path.rstrip("/") != MOBIS_LISTING_PATH
    ):
        raise ValueError(
            "Hyundai Mobis listing must use the official careers.mobis.com host"
        )


def _job_identity(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    values = query.get("seq", [])
    if (
        parsed.scheme != "https"
        or parsed.hostname != MOBIS_CAREERS_HOST
        or parsed.path.rstrip("/") != MOBIS_DETAIL_PATH
        or len(values) != 1
        or not values[0].isdigit()
    ):
        raise ValueError(
            "Hyundai Mobis job URL must contain one official numeric sequence"
        )
    external_id = values[0]
    canonical_url = urlunparse(
        parsed._replace(
            query=urlencode({"seq": external_id}),
            fragment="",
        )
    )
    return external_id, canonical_url


def _required_text(root: Tag, selector: str, label: str) -> str:
    node = root.select_one(selector)
    if not isinstance(node, Tag):
        raise ValueError(f"Hyundai Mobis job is missing its {label}")
    value = _clean_text(node.get_text(" ", strip=True))
    if not value:
        raise ValueError(f"Hyundai Mobis job has an empty {label}")
    return value


def _metadata(root: Tag) -> tuple[str, str, str, str]:
    values = [
        _clean_text(node.get_text(" ", strip=True))
        for node in root.select(".info-wrap02 > p, .view-info02 > p")
        if isinstance(node, Tag)
    ]
    if len(values) < 4 or not all(values[:4]):
        raise ValueError("Hyundai Mobis job metadata is incomplete")
    return values[0], values[1], values[2], values[3]


def _is_technical_job(job_group: str) -> bool:
    return job_group in MOBIS_TECHNICAL_JOB_GROUPS


def _career_type(value: str) -> str | None:
    has_newcomer = "신입" in value
    has_experienced = "경력" in value
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _parse_dates(value: str) -> tuple[datetime | None, datetime | None]:
    dates = [
        datetime(
            int(match.group("year")),
            int(match.group("month")),
            int(match.group("day")),
            int(match.group("hour") or 0),
            int(match.group("minute") or 0),
            tzinfo=KST,
        )
        for match in DATE_TIME_PATTERN.finditer(value)
    ]
    opens_at = dates[0] if dates else None
    closes_at = dates[1] if len(dates) > 1 else None
    return opens_at, closes_at


def _listing_total(soup: BeautifulSoup) -> int:
    node = soup.select_one("#schCnt")
    if not isinstance(node, Tag):
        raise ValueError("Hyundai Mobis listing is missing its result total")
    value = _clean_text(node.get_text(" ", strip=True)).replace(",", "")
    if not value.isdigit():
        raise ValueError("Hyundai Mobis listing result total is invalid")
    return int(value)


def parse_hyundai_mobis_listing_openings(
    html: str,
    listing_url: str,
) -> list[ParsedOpening]:
    _validate_listing_url(listing_url)
    soup = BeautifulSoup(html, "lxml")
    total = _listing_total(soup)
    rows = [
        row
        for row in soup.select("#jobList a.job-item[href]")
        if isinstance(row, Tag)
    ]
    if len(rows) != total:
        raise ValueError(
            f"Hyundai Mobis listing is incomplete: expected {total}, "
            f"received {len(rows)}"
        )

    openings: list[ParsedOpening] = []
    seen_ids: set[str] = set()
    for row in rows:
        detail_url = urljoin(listing_url, str(row.get("href") or ""))
        external_id, canonical_url = _job_identity(detail_url)
        if external_id in seen_ids:
            raise ValueError(
                "Hyundai Mobis listing contains a duplicate job sequence"
            )
        seen_ids.add(external_id)

        title = _required_text(row, ":scope > .tit", "specific title")
        career_label = _required_text(row, ".career", "career label")
        campaign = _required_text(row, ".integrated", "campaign title")
        business, job_group, specialty, location = _metadata(row)
        if not _is_technical_job(job_group):
            continue
        date_text = _required_text(row, ":scope > .date", "opening dates")
        opens_at, closes_at = _parse_dates(date_text)

        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=canonical_url,
                title=title,
                status="open",
                description_html="",
                description_text=_clean_text(
                    " ".join(
                        (
                            title,
                            campaign,
                            business,
                            job_group,
                            specialty,
                            location,
                        )
                    )
                ),
                employment_type=None,
                career_type=_career_type(career_label),
                career_min=None,
                career_max=None,
                location=location,
                opens_at=opens_at,
                closes_at=closes_at,
            )
        )
    return openings


def _career_min(description: str) -> int | None:
    match = CAREER_YEARS_PATTERN.search(description)
    return int(match.group("years")) if match is not None else None


def _clean_description_root(root: Tag) -> None:
    for node in root.select(".dict-wrap, .btn-close"):
        node.decompose()


def parse_hyundai_mobis_detail_opening(
    html: str,
    detail_url: str,
) -> ParsedOpening:
    external_id, canonical_url = _job_identity(detail_url)
    soup = BeautifulSoup(html, "lxml")
    top = soup.select_one(".view-top")
    description_root = soup.select_one(".view-cont")
    if not isinstance(top, Tag) or not isinstance(description_root, Tag):
        raise ValueError("Hyundai Mobis detail is missing its content")

    title = _required_text(top, "#viewTit", "specific title")
    career_label = _required_text(top, ".career", "career label")
    campaign = _required_text(top, ".integrated", "campaign title")
    business, job_group, specialty, location = _metadata(top)
    if not _is_technical_job(job_group):
        raise ValueError("Hyundai Mobis detail no longer represents a SW role")
    date_text = _required_text(top, ":scope > .date", "opening dates")
    opens_at, closes_at = _parse_dates(date_text)

    _clean_description_root(description_root)
    body_text = _clean_text(description_root.get_text(" ", strip=True))
    if len(body_text) < 100:
        raise ValueError(
            "Hyundai Mobis detail description is unexpectedly short"
        )
    description_text = _clean_text(
        " ".join(
            (
                campaign,
                business,
                job_group,
                specialty,
                body_text,
            )
        )
    )

    return ParsedOpening(
        external_id=external_id,
        url=canonical_url,
        title=title,
        status="open",
        description_html=str(description_root),
        description_text=description_text,
        employment_type=None,
        career_type=_career_type(career_label),
        career_min=_career_min(body_text),
        career_max=None,
        location=location,
        opens_at=opens_at,
        closes_at=closes_at,
    )
