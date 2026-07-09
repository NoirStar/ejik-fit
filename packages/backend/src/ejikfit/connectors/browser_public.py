from collections.abc import Callable

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


def _rendered_html_parsers() -> tuple[OpeningParser, ...]:
    return (
        parse_jsonld_openings,
        parse_static_next_data_openings,
        parse_html_listing_openings,
    )
