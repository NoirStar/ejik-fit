from __future__ import annotations

from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup


MAX_DESCRIPTION_IMAGES = 3
SPARSE_DESCRIPTION_LIMIT = 600


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
        raw = next(
            (
                str(image.get(name)).strip()
                for name in ("src", "data-src", "data-original")
                if image.get(name) and str(image.get(name)).strip()
            ),
            "",
        )
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

        url = urlunsplit(
            (
                candidate.scheme,
                candidate.netloc,
                candidate.path,
                candidate.query,
                "",
            )
        )
        if url in seen:
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
