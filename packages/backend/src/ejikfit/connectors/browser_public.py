from collections.abc import Callable
from urllib.parse import urlencode, urljoin

from bs4 import BeautifulSoup
from bs4.element import Tag

from ejikfit.connectors.html_listing import parse_html_listing_openings
from ejikfit.connectors.jsonld import parse_jsonld_openings
from ejikfit.connectors.next_data import parse_static_next_data_openings
from ejikfit.connectors.types import ParsedOpening


OpeningParser = Callable[[str, str], list[ParsedOpening]]


def parse_browser_public_render_openings(
    html: str,
    page_url: str,
) -> list[ParsedOpening]:
    openings: list[ParsedOpening] = []
    seen_external_ids: set[str] = set()
    seen_urls: set[str] = set()

    for parser in _rendered_html_parsers():
        try:
            parsed = parser(html, page_url)
        except (KeyError, TypeError, ValueError):
            continue

        for opening in parsed:
            if opening.external_id in seen_external_ids or opening.url in seen_urls:
                continue
            seen_external_ids.add(opening.external_id)
            seen_urls.add(opening.url)
            openings.append(opening)

    return openings


def _clean_text(value: str) -> str:
    return " ".join(value.split())


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


def _kia_card_location(card: Tag) -> str | None:
    work_items = [
        _clean_text(item.get_text(" ", strip=True))
        for item in card.select(".work__list li")
    ]
    return work_items[2] if len(work_items) >= 3 else None


def _parse_kia_rendered_apply_cards(
    html: str,
    page_url: str,
) -> list[ParsedOpening]:
    soup = BeautifulSoup(html, "lxml")
    openings: list[ParsedOpening] = []

    for card in soup.select("li.cont__box[data-recuyy][data-recutype][data-recucls]"):
        if not isinstance(card, Tag):
            continue
        title_node = card.select_one("h3.tit")
        if not isinstance(title_node, Tag):
            continue
        title = _clean_text(title_node.get_text(" ", strip=True))
        if not title:
            continue
        recu_yy = str(card.get("data-recuyy") or "").strip()
        recu_type = str(card.get("data-recutype") or "").strip()
        recu_cls = str(card.get("data-recucls") or "").strip()
        if not recu_yy or not recu_type or not recu_cls:
            continue
        query = urlencode(
            {
                "recuYy": recu_yy,
                "recuType": recu_type,
                "recuCls": recu_cls,
            }
        )
        url = urljoin(page_url, f"/apply/applyView.kc?{query}")
        description_text = _clean_text(card.get_text(" ", strip=True))
        openings.append(
            ParsedOpening(
                external_id=f"{recu_yy}-{recu_type}-{recu_cls}",
                url=url,
                title=title,
                status="open",
                description_html="",
                description_text=description_text,
                employment_type=_employment_type(description_text),
                career_type=_career_type(description_text),
                career_min=None,
                career_max=None,
                location=_kia_card_location(card),
                opens_at=None,
                closes_at=None,
            )
        )

    return openings


def _rendered_html_parsers() -> tuple[OpeningParser, ...]:
    return (
        parse_jsonld_openings,
        parse_static_next_data_openings,
        _parse_kia_rendered_apply_cards,
        parse_html_listing_openings,
    )
