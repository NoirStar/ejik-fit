from ejikfit.html_text import structured_plain_text


def test_preserves_source_block_semantics_as_plain_text() -> None:
    html = """
    <h2>자격 요건</h2>
    <p>Python과 <strong>API</strong> 개발 경험</p>
    <ul><li>Docker 운영</li><li>Kubernetes 경험</li></ul>
    <script>alert('never expose')</script>
    """

    assert structured_plain_text(html, "평탄화된 대체 텍스트") == (
        "## 자격 요건\n"
        "Python과 API 개발 경험\n"
        "• Docker 운영\n"
        "• Kubernetes 경험"
    )


def test_keeps_explicit_source_markers_without_doubling_them() -> None:
    html = "<p>### 이런 업무를 해요</p><p>* API를 개발합니다.</p>"

    assert structured_plain_text(html, "") == (
        "### 이런 업무를 해요\n* API를 개발합니다."
    )


def test_uses_stored_plain_text_when_html_has_no_visible_content() -> None:
    assert structured_plain_text("<style>body { color: red }</style>", "원문") == "원문"


def test_keeps_official_fallback_suffix_that_is_absent_from_html() -> None:
    assert structured_plain_text(
        "<p>서버 개발</p>",
        "서버 개발 RustUnique",
    ) == "서버 개발\nRustUnique"


def test_reparses_encoded_block_html_without_exposing_tags() -> None:
    html = (
        "&lt;div class=&quot;content-intro&quot;&gt;"
        "&lt;h4&gt;우리 팀을 소개합니다&lt;/h4&gt;"
        "&lt;ul&gt;&lt;li&gt;게임 서버 개발&lt;/li&gt;&lt;/ul&gt;"
        "&lt;script&gt;alert(1)&lt;/script&gt;&lt;/div&gt;"
    )

    result = structured_plain_text(html)

    assert result == "### 우리 팀을 소개합니다\n• 게임 서버 개발"
    assert "<h4>" not in result
    assert "alert" not in result


def test_keeps_literal_encoded_comparison_text() -> None:
    assert structured_plain_text("<p>지연 시간은 a &lt; b 조건입니다.</p>") == (
        "지연 시간은 a < b 조건입니다."
    )
