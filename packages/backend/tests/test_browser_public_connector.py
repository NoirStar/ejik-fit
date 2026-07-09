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
