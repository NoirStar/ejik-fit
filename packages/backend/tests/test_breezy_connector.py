import json

from ejikfit.connectors.breezy import (
    parse_breezy_detail_opening,
    parse_breezy_listing_openings,
)


def test_breezy_listing_keeps_only_domestic_technical_roles() -> None:
    html = """
    <div class="positions-container">
      <ul class="positions location">
        <li class="position"><a href="/p/80291738be66-electronics-engineer">
          <h2>Electronics Engineer</h2>
          <ul class="meta">
            <li class="location"><span>Seoul, KR</span></li>
            <li class="type"><span>풀타임</span></li>
            <li class="department"><span>Electronics</span></li>
          </ul>
        </a></li>
        <li class="position"><a href="/p/92d930b5e0ad-robotics-field-engineer">
          <h2>Robotics Field Engineer - AMR</h2>
          <ul class="meta">
            <li class="location"><span>Changwon, KR</span></li>
            <li class="type"><span>Full Time</span></li>
            <li class="department"><span>Field Operations</span></li>
          </ul>
        </a></li>
        <li class="position"><a href="/p/e8e07f7a34e7-business-development-manager">
          <h2>Business Development Manager</h2>
          <ul class="meta"><li class="location"><span>Seoul, KR</span></li></ul>
        </a></li>
        <li class="position"><a href="/p/f0861772b503-robotics-software-engineer">
          <h2>Robotics Software Engineer</h2>
          <ul class="meta"><li class="location"><span>Redwood City, CA</span></li></ul>
        </a></li>
      </ul>
    </div>
    """

    openings = parse_breezy_listing_openings(
        html,
        "https://bear-robotics.breezy.hr/",
    )

    assert [opening.external_id for opening in openings] == [
        "80291738be66",
        "92d930b5e0ad",
    ]
    assert openings[0].url == (
        "https://bear-robotics.breezy.hr/p/80291738be66-electronics-engineer"
    )
    assert openings[0].location == "Seoul, KR"
    assert openings[0].employment_type == "풀타임"
    assert openings[0].description_text == "Electronics"


def test_breezy_detail_preserves_jobposting_html_and_listing_identity() -> None:
    listing = parse_breezy_listing_openings(
        """
        <div class="positions-container">
          <li class="position"><a href="/p/22f14e37ff59-robotics-software-engineer-machine-learning">
            <h2>Robotics Software Engineer, Machine Learning</h2>
            <ul class="meta">
              <li class="location"><span>Seoul, KR</span></li>
              <li class="type"><span>풀타임</span></li>
              <li class="department"><span>Robotics Engineering</span></li>
            </ul>
          </a></li>
        </div>
        """,
        "https://bear-robotics.breezy.hr/",
    )[0]
    detail_html = f"""
    <html><head>
      <script type="application/ld+json">{json.dumps({
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "url": f"{listing.url}?source=GoogleJobs",
        "title": listing.title,
        "description": (
            "<h2>Required Experience &amp; Qualifications</h2>"
            "<ul><li>Python과 C++ 개발 경험</li></ul>"
            "<h3>Preferred Experience and Qualifications</h3>"
            "<ul><li>ROS 사용 경험</li></ul>"
        ),
        "employmentType": "FULL_TIME",
        "datePosted": "2026-07-20",
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressCountry": "KR",
                "addressLocality": "Seoul",
            },
        },
      }, ensure_ascii=False)}</script>
    </head></html>
    """

    opening = parse_breezy_detail_opening(detail_html, listing.url, listing)

    assert opening.external_id == "22f14e37ff59"
    assert opening.url == listing.url
    assert opening.title == listing.title
    assert opening.employment_type == "FULL_TIME"
    assert opening.location == "Seoul"
    assert opening.opens_at is not None
    assert "Required Experience" in opening.description_html
    assert "Python과 C++" in opening.description_text
    assert "ROS 사용 경험" in opening.description_text


def test_breezy_detail_rejects_page_without_matching_jobposting() -> None:
    listing = parse_breezy_listing_openings(
        """
        <div class="positions-container">
          <li class="position"><a href="/p/22f14e37ff59-platform-engineer">
            <h2>Platform Engineer</h2>
            <ul class="meta"><li class="location"><span>Seoul, KR</span></li></ul>
          </a></li>
        </div>
        """,
        "https://bear-robotics.breezy.hr/",
    )[0]

    try:
        parse_breezy_detail_opening("<html></html>", listing.url, listing)
    except ValueError as error:
        assert "JobPosting" in str(error)
    else:
        raise AssertionError("missing JobPosting JSON-LD must be rejected")


def test_breezy_listing_rejects_unrecognized_or_blocked_html() -> None:
    try:
        parse_breezy_listing_openings(
            "<html><body>Access denied</body></html>",
            "https://bear-robotics.breezy.hr/",
        )
    except ValueError as error:
        assert "positions container" in str(error)
    else:
        raise AssertionError("unrecognized Breezy listing must be rejected")
