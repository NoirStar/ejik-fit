import pytest

from ejikfit.posting_content import (
    has_substantive_posting_content,
    posting_description_images,
    require_substantive_posting_content,
)


def test_extracts_sparse_same_host_description_images() -> None:
    html = """
      <p>상시 채용입니다.</p>
      <img data-src="/upload/full.png#detail" alt="">
      <img src="https://tracker.example/pixel.png">
      <img src="/upload/full.png">
      <img src="https://user:secret@ligdna.recruiter.co.kr/private.png">
    """

    assert posting_description_images(
        html,
        "상시 채용입니다.",
        "https://ligdna.recruiter.co.kr/app/jobnotice/view?id=1",
    ) == [
        {
            "url": "https://ligdna.recruiter.co.kr/upload/full.png",
            "alt": "채용 공고 상세 내용 이미지 1",
        }
    ]


def test_uses_valid_lazy_image_when_placeholder_src_is_rejected() -> None:
    html = (
        '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yw=" '
        'data-src="/upload/detail.png" alt="직무 상세">'
    )

    assert posting_description_images(
        html,
        "짧은 공고",
        "https://example.com/jobs/1",
    ) == [
        {
            "url": "https://example.com/upload/detail.png",
            "alt": "직무 상세",
        }
    ]


def test_skips_images_for_text_rich_posting() -> None:
    assert posting_description_images(
        '<img src="/detail.png">',
        "가" * 600,
        "https://example.com/jobs/1",
    ) == []


def test_bounds_image_count_alt_text_and_invalid_sources() -> None:
    html = "".join(
        [
            '<img src="/one.png" alt=" 첫 이미지 ">',
            f'<img data-original="/two.png" alt="{"가" * 250}">',
            '<img src="/three.png">',
            '<img src="/four.png">',
            "<img>",
        ]
    )

    images = posting_description_images(
        html,
        "짧은 공고",
        "https://example.com/jobs/1",
    )

    assert [image["url"] for image in images] == [
        "https://example.com/one.png",
        "https://example.com/two.png",
        "https://example.com/three.png",
    ]
    assert images[0]["alt"] == "첫 이미지"
    assert len(images[1]["alt"]) == 200
    assert images[2]["alt"] == "채용 공고 상세 내용 이미지 3"
    assert posting_description_images(html, "짧은 공고", "http://example.com/1") == []


def test_substantive_posting_content_accepts_verified_text() -> None:
    assert has_substantive_posting_content(
        "",
        "가" * 120,
        "https://example.com/jobs/1",
    )


def test_substantive_posting_content_rejects_listing_metadata() -> None:
    assert not has_substantive_posting_content(
        "",
        "Tech Frontend NAVER WEBTOON",
        "https://example.com/jobs/1",
    )


def test_substantive_posting_content_accepts_official_image_body() -> None:
    assert has_substantive_posting_content(
        '<img src="/jobs/1/body.png">',
        "",
        "https://example.com/jobs/1",
    )


def test_substantive_posting_content_rejects_decorative_images() -> None:
    assert not has_substantive_posting_content(
        (
            '<img class="company-logo" src="/assets/logo.svg" '
            'width="64" height="64">'
            '<img src="/assets/banner.png" width="80" height="40">'
        ),
        "",
        "https://example.com/jobs/1",
    )


def test_require_substantive_posting_content_raises_without_leaking_body() -> None:
    marker = "private-listing-marker"

    with pytest.raises(ValueError, match="detail content is sparse") as raised:
        require_substantive_posting_content(
            "",
            marker,
            "https://example.com/jobs/1",
        )

    assert marker not in str(raised.value)
