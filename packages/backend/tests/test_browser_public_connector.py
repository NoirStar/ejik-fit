from ejikfit.connectors.browser_public import parse_browser_public_render_openings


def test_parse_browser_public_render_openings_reuses_existing_rendered_html_parsers() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "identifier": "jsonld-1",
          "title": "ML Platform Engineer",
          "url": "https://careers.example.com/jobs/jsonld-1"
        }
        </script>
      </head>
      <body>
        <article>
          <a href="/jobs/backend-2">Backend Engineer</a>
          <p>정규직 · 경력 · 서울</p>
        </article>
      </body>
    </html>
    """

    openings = parse_browser_public_render_openings(
        html,
        "https://careers.example.com/jobs",
    )

    assert [opening.external_id for opening in openings] == [
        "jsonld-1",
        "backend-2",
    ]
    assert [opening.title for opening in openings] == [
        "ML Platform Engineer",
        "Backend Engineer",
    ]


def test_parse_browser_public_render_openings_deduplicates_parser_results_by_url() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "identifier": "shared-jsonld-id",
          "title": "Backend Engineer",
          "url": "https://careers.example.com/jobs/backend-1"
        }
        </script>
      </head>
      <body>
        <article>
          <a href="/jobs/backend-1">Backend Engineer</a>
          <p>정규직 · 경력 · 서울</p>
        </article>
      </body>
    </html>
    """

    openings = parse_browser_public_render_openings(
        html,
        "https://careers.example.com/careers",
    )

    assert len(openings) == 1
    assert openings[0].external_id == "shared-jsonld-id"


def test_parse_browser_public_render_openings_maps_kia_apply_cards() -> None:
    html = """
    <section class="members_wrap">
      <ul class="box__list" id="applyList">
        <li
          data-recuyy="2026"
          data-recutype="N5"
          data-recucls="66"
          class="cont__box"
        >
          <a href="javascript:void(0);">
            <h3 class="tit">[계약직] 기아 채용운영</h3>
            <div class="day__box">
              <span class="p_red">채용시까지</span>
              <ul class="work__list">
                <li>경영지원</li>
                <li>인사관리</li>
                <li>서울 양재본사</li>
                <li>계약직</li>
              </ul>
            </div>
          </a>
        </li>
      </ul>
    </section>
    """

    openings = parse_browser_public_render_openings(
        html,
        "https://career.kia.com/apply/applyList.kc",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "2026-N5-66"
    assert opening.url == (
        "https://career.kia.com/apply/applyView.kc"
        "?recuYy=2026&recuType=N5&recuCls=66"
    )
    assert opening.title == "[계약직] 기아 채용운영"
    assert opening.employment_type == "contract"
    assert opening.location == "서울 양재본사"
    assert opening.description_text == (
        "[계약직] 기아 채용운영 채용시까지 경영지원 "
        "인사관리 서울 양재본사 계약직"
    )
