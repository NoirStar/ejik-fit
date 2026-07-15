from ejikfit.connectors.sitemap_discovery import (
    discover_sitemap_openings,
    parse_sitemap_detail_opening,
    parse_sitemap_discovery,
)
from ejikfit.skill_extraction import RequirementType, extract_skill_matches


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


def test_discovers_careers_collection_detail_urls() -> None:
    xml = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/careers</loc></url>
      <url><loc>https://example.com/careers/backend-engineer</loc></url>
    </urlset>
    """

    refs = discover_sitemap_openings(xml, "https://example.com/sitemap.xml")

    assert [(ref.external_id, ref.url) for ref in refs] == [
        ("backend-engineer", "https://example.com/careers/backend-engineer")
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


def test_furiosa_webflow_detail_uses_full_visible_job_description() -> None:
    html = """
    <script type="application/ld+json">
      {
        "@context":"https://schema.org",
        "@type":"JobPosting",
        "title":"Machine Learning Engineer",
        "description":"Machine Learning Engineer",
        "employmentType":"On-site",
        "jobLocation":{"address":{"addressLocality":"Seoul, South Korea"}}
      }
    </script>
    <main>
      <div class="rich-text-component">
        <div class="rich-text w-richtext">
          <h2>Minimum Qualifications</h2>
          <ul><li>Production experience with PyTorch</li></ul>
          <h2>Preferred Qualifications</h2>
          <ul><li>Kubernetes operations experience</li></ul>
        </div>
      </div>
    </main>
    """

    opening = parse_sitemap_detail_opening(
        html,
        "https://furiosa.ai/careers/machine-learning-engineer",
        "machine-learning-engineer",
        connector_family="furiosa_webflow_korea_tech",
    )

    assert "Minimum Qualifications" in opening.description_text
    assert opening.employment_type is None
    matches = {
        match.skill: match.requirement_type
        for match in extract_skill_matches(
            title=opening.title,
            description_html=opening.description_html,
            description_text=opening.description_text,
        )
    }
    assert matches["PyTorch"] == RequirementType.REQUIRED
    assert matches["Kubernetes"] == RequirementType.PREFERRED
