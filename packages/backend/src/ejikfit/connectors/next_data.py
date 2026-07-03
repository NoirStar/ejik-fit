import json
from typing import Any

from bs4 import BeautifulSoup


def extract_next_data(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", id="__NEXT_DATA__")
    if script is None or not script.string:
        raise ValueError("__NEXT_DATA__ script is missing")

    data = json.loads(script.string)
    if not isinstance(data, dict):
        raise ValueError("__NEXT_DATA__ must contain a JSON object")
    return data
