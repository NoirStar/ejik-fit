from __future__ import annotations

import re

from bs4 import BeautifulSoup


_BLOCK_TAGS = (
    "address",
    "article",
    "aside",
    "blockquote",
    "dd",
    "div",
    "dl",
    "dt",
    "figcaption",
    "figure",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "td",
    "th",
    "tr",
    "ul",
)
_HIDDEN_TAGS = ("script", "style", "noscript", "template")
_EXPLICIT_HEADING = re.compile(r"^#{2,4}\s+")
_EXPLICIT_LIST_ITEM = re.compile(r"^[*•◦-]\s+")
_SOURCE_MARKER = re.compile(r"(?:^|\s)(?:#{2,4}|[*•◦-])(?=\s)")


def _normalized_lines(text: str) -> str:
    lines = []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        normalized = re.sub(r"[^\S\n]+", " ", line).strip()
        if normalized:
            lines.append(normalized)
    return "\n".join(lines)


def _visible_comparison_text(text: str) -> str:
    without_markers = _SOURCE_MARKER.sub(" ", _normalized_lines(text))
    return re.sub(r"\s+", " ", without_markers).strip()


def structured_plain_text(html: str, fallback: str = "") -> str:
    """Keep source block boundaries while returning text that is safe to render."""

    if not html.strip():
        return _normalized_lines(fallback)

    soup = BeautifulSoup(html, "lxml")
    for tag in soup.find_all(_HIDDEN_TAGS):
        tag.decompose()

    for heading in soup.find_all(("h1", "h2", "h3", "h4", "h5", "h6")):
        text = heading.get_text(" ", strip=True)
        if text and not _EXPLICIT_HEADING.match(text):
            marker = "## " if heading.name in {"h1", "h2"} else "### "
            heading.insert(0, marker)

    for item in soup.find_all("li"):
        text = item.get_text(" ", strip=True)
        if text and not _EXPLICIT_LIST_ITEM.match(text):
            item.insert(0, "• ")

    for break_tag in soup.find_all("br"):
        break_tag.replace_with("\n")

    for block in soup.find_all(_BLOCK_TAGS):
        block.insert_after("\n")

    structured = _normalized_lines(soup.get_text("", strip=False))
    normalized_fallback = _normalized_lines(fallback)
    if not structured:
        return normalized_fallback

    structured_visible = _visible_comparison_text(structured)
    fallback_visible = _visible_comparison_text(normalized_fallback)
    if structured_visible and fallback_visible.startswith(
        f"{structured_visible} "
    ):
        suffix = fallback_visible[len(structured_visible) :].strip()
        if suffix:
            return f"{structured}\n{suffix}"
    return structured
