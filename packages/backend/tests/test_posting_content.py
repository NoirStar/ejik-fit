from ejikfit.posting_content import posting_description_images


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
