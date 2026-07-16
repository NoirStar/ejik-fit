import re
from datetime import datetime
from html import escape
from urllib.parse import urlparse, urlunparse
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.technical_roles import is_technical_role
from ejikfit.connectors.types import ParsedOpening


SK_CAREERS_HOST = "www.skcareers.com"
SK_LISTING_PATH = "/Recruit/GetRecruitList"
SK_DETAIL_PATTERN = re.compile(r"^/Recruit/Detail/(?P<external_id>R\d+)/?$")
SK_DATE_PATTERN = re.compile(
    r"(?P<month>[A-Z][a-z]+)\s+(?P<day>\d{1,2}),\s+(?P<year>20\d{2})"
)
TIME_PATTERN = re.compile(r"(?P<hour>\d{1,2}):(?P<minute>\d{2})")
CAREER_YEARS_PATTERN = re.compile(r"(?<!\d)(?P<years>\d{1,2})\s*년\s*이상")
KST = ZoneInfo("Asia/Seoul")


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def is_sk_careers_listing_url(url: str) -> bool:
    parsed = urlparse(url)
    return (
        parsed.scheme == "https"
        and parsed.hostname == SK_CAREERS_HOST
        and parsed.path.rstrip("/") == SK_LISTING_PATH
    )


def is_sk_intellix_technical_opening(opening: ParsedOpening) -> bool:
    return (
        opening.description_text.casefold().endswith(" it/it")
        and is_technical_role(
            opening.title,
            opening.description_text,
        )
    )


def is_sk_keyfoundry_technical_opening(opening: ParsedOpening) -> bool:
    context = opening.description_text.casefold()
    has_technology_group = context.endswith(" dt") or context.endswith(" 정보보안")
    return has_technology_group and is_technical_role(
        opening.title,
        opening.description_text,
    )


def _job_identity(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    match = SK_DETAIL_PATTERN.fullmatch(parsed.path)
    if (
        parsed.scheme != "https"
        or parsed.hostname != SK_CAREERS_HOST
        or match is None
    ):
        raise ValueError("SK Careers job URL must use its official detail path")
    return match.group("external_id"), urlunparse(
        parsed._replace(query="", fragment="")
    )


def _required_text(root: Tag, selector: str, label: str) -> str:
    node = root.select_one(selector)
    if not isinstance(node, Tag):
        raise ValueError(f"SK Careers detail is missing its {label}")
    value = _clean_text(node.get_text(" ", strip=True))
    if not value:
        raise ValueError(f"SK Careers detail has an empty {label}")
    return value


def _detail_value(root: Tag, label: str) -> str | None:
    for item in root.select(".box-detail-item"):
        if not isinstance(item, Tag):
            continue
        label_node = item.select_one(".label")
        value_node = item.select_one(".value")
        if not isinstance(label_node, Tag) or not isinstance(value_node, Tag):
            continue
        if _clean_text(label_node.get_text(" ", strip=True)) != label:
            continue
        value = _clean_text(value_node.get_text(" ", strip=True))
        return value or None
    return None


def _career_type(value: str | None) -> str | None:
    normalized = (value or "").casefold()
    has_newcomer = "new" in normalized or "신입" in normalized
    has_experienced = "experienced" in normalized or "경력" in normalized
    if has_newcomer and has_experienced:
        return "mixed"
    if has_newcomer:
        return "new_comer"
    if has_experienced:
        return "experienced"
    return None


def _employment_type(value: str | None) -> str | None:
    normalized = (value or "").casefold()
    if "permanent" in normalized or "정규" in normalized:
        return "regular"
    if "contract" in normalized or "계약" in normalized:
        return "contract"
    if "intern" in normalized or "인턴" in normalized:
        return "intern"
    return value


def _date_values(value: str | None) -> list[datetime]:
    if not value:
        return []
    values: list[datetime] = []
    for match in SK_DATE_PATTERN.finditer(value):
        parsed = datetime.strptime(
            (
                f"{match.group('month')} {match.group('day')}, "
                f"{match.group('year')}"
            ),
            "%B %d, %Y",
        )
        values.append(parsed.replace(tzinfo=KST))
    return values


def _opening_dates(
    date_range: str | None,
    closing_time: str | None,
) -> tuple[datetime | None, datetime | None]:
    dates = _date_values(date_range)
    opens_at = dates[0] if dates else None
    closes_at = dates[1] if len(dates) > 1 else None
    time_match = TIME_PATTERN.search(closing_time or "")
    if closes_at is not None and time_match is not None:
        closes_at = closes_at.replace(
            hour=int(time_match.group("hour")),
            minute=int(time_match.group("minute")),
        )
    return opens_at, closes_at


def _career_min(description: str) -> int | None:
    match = CAREER_YEARS_PATTERN.search(description)
    return int(match.group("years")) if match is not None else None


def _semantic_description_html(sections: list[Tag]) -> str:
    output: list[str] = []
    for section in sections:
        output.append("<section>")
        title_node = section.select_one(".detail-content-title")
        if isinstance(title_node, Tag):
            title = _clean_text(title_node.get_text(" ", strip=True))
            if title:
                output.append(f"<h3>{escape(title)}</h3>")

        for node in section.select(
            ".item-label, .asset-title, .asset-list > li"
        ):
            if not isinstance(node, Tag):
                continue
            text = _clean_text(node.get_text(" ", strip=True))
            if not text:
                continue
            tag_name = "h4" if "item-label" in (node.get("class") or []) else "p"
            output.append(f"<{tag_name}>{escape(text)}</{tag_name}>")
        output.append("</section>")
    return "".join(output)


def parse_sk_careers_detail_opening(
    html: str,
    detail_url: str,
) -> ParsedOpening:
    external_id, canonical_url = _job_identity(detail_url)
    soup = BeautifulSoup(html, "lxml")
    root = soup.select_one(".announcement-detail-page-content")
    if not isinstance(root, Tag):
        raise ValueError("SK Careers detail is missing its job container")

    title = _required_text(root, ".box-title", "title")
    sections = [
        section
        for section in root.select(".detail-content-wrapper .detail-content-item")
        if isinstance(section, Tag)
    ]
    if not sections:
        raise ValueError("SK Careers detail is missing its description sections")
    description_html = _semantic_description_html(sections)
    description_text = _clean_text(
        BeautifulSoup(description_html, "lxml").get_text(" ", strip=True)
    )
    if len(description_text) < 80:
        raise ValueError("SK Careers detail description is unexpectedly short")

    company = _detail_value(root, "회사")
    job_group = _detail_value(root, "직무")
    description_with_context = _clean_text(
        " ".join(
            value
            for value in (company, job_group, description_text)
            if value
        )
    )
    opens_at, closes_at = _opening_dates(
        _detail_value(root, "지원 기간"),
        _detail_value(root, "마감 시간"),
    )

    return ParsedOpening(
        external_id=external_id,
        url=canonical_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_with_context,
        employment_type=_employment_type(_detail_value(root, "유형")),
        career_type=_career_type(_detail_value(root, "구분")),
        career_min=_career_min(description_text),
        career_max=None,
        location=_detail_value(root, "지역"),
        opens_at=opens_at,
        closes_at=closes_at,
    )
