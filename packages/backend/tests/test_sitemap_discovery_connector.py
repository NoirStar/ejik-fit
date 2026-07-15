from ejikfit.connectors.sitemap_discovery import (
    discover_sitemap_openings,
    parse_sitemap_detail_opening,
    parse_sitemap_discovery,
)


def test_parse_sitemap_discovery_maps_job_like_sitemap_urls() -> None:
    xml = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/about</loc></url>
      <url><loc>https://example.com/careers</loc></url>
      <url><loc>/jobs/backend-engineer</loc></url>
      <url><loc>https://example.com/privacy</loc></url>
      <url><loc>https://example.com/jobs/backend-engineer</loc></url>
    </urlset>
    """

    candidates = parse_sitemap_discovery(xml, "https://example.com/sitemap.xml")

    assert [candidate.url for candidate in candidates] == [
        "https://example.com/careers",
        "https://example.com/jobs/backend-engineer",
    ]
    assert candidates[0].source == "sitemap"
    assert candidates[0].reason == "career_url"
    assert candidates[1].reason == "job_url"


def test_parse_sitemap_discovery_maps_robots_sitemap_and_job_urls() -> None:
    robots = """
    User-agent: *
    Allow: /
    Sitemap: https://example.com/careers-sitemap.xml
    Sitemap: /jobs-sitemap.xml
    Disallow: /private
    https://example.com/recruit/backend
    """

    candidates = parse_sitemap_discovery(robots, "https://example.com/robots.txt")

    assert [candidate.url for candidate in candidates] == [
        "https://example.com/careers-sitemap.xml",
        "https://example.com/jobs-sitemap.xml",
        "https://example.com/recruit/backend",
    ]
    assert [candidate.source for candidate in candidates] == [
        "robots",
        "robots",
        "robots",
    ]


def test_discovers_only_detail_urls_with_stable_external_ids() -> None:
    xml = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://careers.example.com/jobs/</loc></url>
      <url><loc>https://careers.example.com/jobs/role/6640363003/</loc></url>
      <url><loc>https://careers.example.com/culture</loc></url>
      <url><loc>https://careers.example.com/career/job-detail?job_id=7786567003</loc></url>
      <url><loc>https://attacker.example/jobs/role/should-not-be-fetched/</loc></url>
    </urlset>
    """

    refs = discover_sitemap_openings(
        xml,
        "https://careers.example.com/sitemap.xml",
    )

    assert [(ref.external_id, ref.url) for ref in refs] == [
        ("6640363003", "https://careers.example.com/jobs/role/6640363003/"),
        (
            "7786567003",
            "https://careers.example.com/career/job-detail?job_id=7786567003",
        ),
    ]


def test_parses_sitemap_detail_jsonld_using_sitemap_identity() -> None:
    html = """
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Software Engineer, Backend - 광고",
        "description": "<h2>자격 요건</h2><p>Kotlin, Spring 경험</p>",
        "employmentType": "FULL_TIME",
        "identifier": "source-generated-id"
      }
    </script>
    """

    opening = parse_sitemap_detail_opening(
        html,
        "https://careers.example.com/jobs/role/6640363003/",
        "6640363003",
    )

    assert opening.external_id == "6640363003"
    assert opening.url == "https://careers.example.com/jobs/role/6640363003/"
    assert opening.title == "Software Engineer, Backend - 광고"
    assert opening.description_text == "## 자격 요건\nKotlin, Spring 경험"
