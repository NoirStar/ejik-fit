import json

from ejikfit.connectors.next_data import parse_static_payload_openings
from ejikfit.connectors.types import ParsedOpening


def parse_enterprise_json_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    return parse_static_payload_openings(json.loads(raw_json), listing_url)
