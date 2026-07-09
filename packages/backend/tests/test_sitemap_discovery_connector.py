from ejikfit.connectors.sitemap_discovery import parse_sitemap_discovery


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
