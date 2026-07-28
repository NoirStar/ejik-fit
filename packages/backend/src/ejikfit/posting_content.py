from __future__ import annotations

import re
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup
from bs4.element import Tag


MAX_DESCRIPTION_IMAGES = 3
SPARSE_DESCRIPTION_LIMIT = 600
MIN_SUBSTANTIVE_DESCRIPTION_CHARS = 120
_DECORATIVE_IMAGE_MARKER = re.compile(
    r"(?:^|[\s/_.-])(?:favicon|logo|icon)(?:$|[\s/_.-])",
    re.IGNORECASE,
)


def _dimension(image: Tag, name: str) -> float | None:
    raw = str(image.get(name) or "").strip()
    match = re.fullmatch(r"(\d+(?:\.\d+)?)(?:px)?", raw, re.IGNORECASE)
    if match is None:
        return None
    return float(match.group(1))


def _is_decorative_image(image: Tag, url: str) -> bool:
    marker_text = " ".join(
        (
            urlsplit(url).path,
            str(image.get("id") or ""),
            " ".join(str(value) for value in image.get("class") or ()),
            str(image.get("alt") or ""),
        )
    )
    if _DECORATIVE_IMAGE_MARKER.search(marker_text):
        return True

    width = _dimension(image, "width")
    height = _dimension(image, "height")
    return (
        width is not None
        and height is not None
        and max(width, height) < 160
    )


def posting_description_images(
    description_html: str,
    description_text: str,
    source_url: str,
) -> list[dict[str, str]]:
    """Return bounded, same-host images for postings with little usable text."""

    if len(description_text.strip()) >= SPARSE_DESCRIPTION_LIMIT:
        return []

    try:
        source = urlsplit(source_url)
        source_hostname = source.hostname
    except ValueError:
        return []
    if source.scheme != "https" or not source_hostname:
        return []

    images: list[dict[str, str]] = []
    seen: set[str] = set()
    soup = BeautifulSoup(description_html, "lxml")
    for image in soup.find_all("img"):
        url = ""
        for name in ("src", "data-src", "data-original"):
            raw = str(image.get(name) or "").strip()
            if not raw:
                continue
            try:
                candidate = urlsplit(urljoin(source_url, raw))
                candidate_hostname = candidate.hostname
            except ValueError:
                continue
            if (
                candidate.scheme != "https"
                or candidate_hostname != source_hostname
                or candidate.username is not None
                or candidate.password is not None
            ):
                continue

            normalized_url = urlunsplit(
                (
                    candidate.scheme,
                    candidate.netloc,
                    candidate.path,
                    candidate.query,
                    "",
                )
            )
            if normalized_url not in seen:
                url = normalized_url
                break
        if not url:
            continue
        if _is_decorative_image(image, url):
            continue
        seen.add(url)

        raw_alt = str(image.get("alt") or "").strip()
        alt = raw_alt[:200] or (
            f"채용 공고 상세 내용 이미지 {len(images) + 1}"
        )
        images.append({"url": url, "alt": alt})
        if len(images) == MAX_DESCRIPTION_IMAGES:
            break
    return images


def has_substantive_posting_content(
    description_html: str,
    description_text: str,
    source_url: str,
) -> bool:
    normalized_text = " ".join(description_text.split())
    if len(normalized_text) >= MIN_SUBSTANTIVE_DESCRIPTION_CHARS:
        return True
    return bool(
        posting_description_images(
            description_html,
            normalized_text,
            source_url,
        )
    )


def require_substantive_posting_content(
    description_html: str,
    description_text: str,
    source_url: str,
) -> None:
    if not has_substantive_posting_content(
        description_html,
        description_text,
        source_url,
    ):
        raise ValueError("detail content is sparse")
