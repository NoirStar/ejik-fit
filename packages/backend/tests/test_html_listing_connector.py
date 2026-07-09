from ejikfit.connectors.html_listing import parse_html_listing_openings


def test_parse_html_listing_openings_maps_static_job_cards() -> None:
    html = """
    <main>
      <article class="job-card">
        <a href="/jobs/backend-1">Backend Engineer</a>
        <p>정규직 · 경력 · 서울</p>
        <span>2026.07.01 ~ 2026.07.31</span>
      </article>
      <article class="job-card">
        <a href="/jobs/backend-1">Backend Engineer</a>
        <p>Duplicate link should be ignored</p>
      </article>
      <article class="job-card">
        <a href="/culture">Culture</a>
      </article>
      <article class="job-card">
        <a href="https://example.com/jobs/data-2">Data Platform Engineer</a>
        <p>계약직 · 신입 · 판교</p>
        <time datetime="2026-08-15">마감</time>
      </article>
    </main>
    """

    openings = parse_html_listing_openings(html, "https://example.com/careers")

    assert [opening.external_id for opening in openings] == [
        "backend-1",
        "data-2",
    ]
    first = openings[0]
    assert first.url == "https://example.com/jobs/backend-1"
    assert first.title == "Backend Engineer"
    assert first.employment_type == "regular"
    assert first.career_type == "experienced"
    assert first.location == "서울"
    assert first.description_text == "Backend Engineer 정규직 · 경력 · 서울 2026.07.01 ~ 2026.07.31"
    assert first.opens_at is not None
    assert first.closes_at is not None

    second = openings[1]
    assert second.employment_type == "contract"
    assert second.career_type == "new_comer"
    assert second.location == "판교"
    assert second.closes_at is not None


def test_parse_html_listing_openings_ignores_empty_and_navigation_links() -> None:
    html = """
    <nav>
      <a href="/recruit/process">Hiring Process</a>
      <a href="/about">About Us</a>
    </nav>
    <section>
      <a href="">Backend Engineer</a>
      <a href="#top">Top</a>
      <a href="mailto:recruit@example.com">Contact</a>
    </section>
    """

    assert parse_html_listing_openings(html, "https://example.com/careers") == []
