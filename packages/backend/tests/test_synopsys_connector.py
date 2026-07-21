import pytest

from ejikfit.connectors.synopsys import (
    parse_synopsys_detail_opening,
    parse_synopsys_korea_listing_openings,
)


LISTING_URL = (
    "https://careers.synopsys.com/location/"
    "south-korea-jobs/44408/1835841/2"
)


def test_synopsys_listing_keeps_complete_domestic_technical_results() -> None:
    html = """
    <section id="search-results" data-total-job-results="3">
      <section id="search-results-list">
        <ul>
          <li class="search-results-list__list-item">
            <a class="sr-job-link"
               data-job-id="95110591648"
               href="/job/seongnam-si/r-and-d-engineer-agentic-ai/44408/95110591648">
              <h2>R&amp;D Engineer - Agentic AI</h2>
              <div class="sr-wrapper">
                <span class="job-location">Seongnam-si, South Korea</span>
                <span class="category">Category: Engineering</span>
                <span class="job-date-posted">Posted: 05/14/2026</span>
                <span class="jobId">Job ID: 17451</span>
              </div>
            </a>
          </li>
          <li class="search-results-list__list-item">
            <a class="sr-job-link"
               data-job-id="96948374848"
               href="/job/seongnam-si/interface-ip-applications-engineer-sr-staff/44408/96948374848">
              <h2>Interface IP Applications Engineer, Sr Staff</h2>
              <div class="sr-wrapper">
                <span class="job-location">Seongnam-si, South Korea</span>
                <span class="job-date-posted">Posted: 06. 25. 2026</span>
              </div>
            </a>
          </li>
          <li class="search-results-list__list-item">
            <a class="sr-job-link"
               data-job-id="96637227984"
               href="/job/seoul/senior-technical-account-manager-high-tech/44408/96637227984">
              <h2>Senior Technical Account Manager (High-Tech)</h2>
              <div class="sr-wrapper">
                <span class="job-location">Seoul, South Korea</span>
              </div>
            </a>
          </li>
        </ul>
      </section>
    </section>
    <section class="recommended-jobs">
      <a class="sr-job-link" data-job-id="999"
         href="/job/vancouver/senior-devops-engineer/44408/999">
        <h2>Senior DevOps Engineer</h2>
      </a>
    </section>
    """

    openings = parse_synopsys_korea_listing_openings(html, LISTING_URL)

    assert [opening.external_id for opening in openings] == [
        "95110591648",
        "96948374848",
    ]
    assert openings[0].title == "R&D Engineer - Agentic AI"
    assert openings[0].location == "Seongnam-si, South Korea"
    assert openings[0].opens_at is not None
    assert openings[0].opens_at.isoformat() == "2026-05-14T00:00:00+09:00"
    assert openings[0].url.endswith("/44408/95110591648")


def test_synopsys_listing_rejects_incomplete_result_html() -> None:
    html = """
    <section id="search-results" data-total-job-results="2">
      <section id="search-results-list">
        <a class="sr-job-link" data-job-id="95110591648"
           href="/job/seongnam-si/r-and-d-engineer-agentic-ai/44408/95110591648">
          <h2>R&amp;D Engineer - Agentic AI</h2>
          <span class="job-location">Seongnam-si, South Korea</span>
        </a>
      </section>
    </section>
    """

    with pytest.raises(ValueError, match="incomplete"):
        parse_synopsys_korea_listing_openings(html, LISTING_URL)


def test_synopsys_detail_preserves_jobposting_body_and_listing_identity() -> None:
    listing = parse_synopsys_korea_listing_openings(
        """
        <section id="search-results" data-total-job-results="1">
          <section id="search-results-list">
            <a class="sr-job-link" data-job-id="95110591648"
               href="/job/seongnam-si/r-and-d-engineer-agentic-ai/44408/95110591648">
              <h2>R&amp;D Engineer - Agentic AI</h2>
              <span class="job-location">Seongnam-si, South Korea</span>
            </a>
          </section>
        </section>
        """,
        LISTING_URL,
    )[0]
    detail_html = """
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "identifier": "17451",
      "title": "R&D Engineer - Agentic AI",
      "url": "https://careers.synopsys.com/job/seongnam-si/r-and-d-engineer-agentic-ai/44408/95110591648",
      "datePosted": "2026-5-15",
      "description": "<h2>What You’ll Need</h2><ul><li>3+ years developing engineering applications</li><li>Strong Python and modern C++</li><li>Build LLM and RAG systems</li></ul>",
      "hiringOrganization": {"@type": "Organization", "name": "Synopsys"},
      "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "addressLocality": "Seongnam-si", "addressCountry": "Korea, Republic of"}}
    }
    </script>
    """

    opening = parse_synopsys_detail_opening(
        detail_html,
        listing.url,
        listing,
    )

    assert opening.external_id == "95110591648"
    assert opening.url == listing.url
    assert opening.title == listing.title
    assert opening.location == "Seongnam-si"
    assert opening.career_type == "experienced"
    assert opening.career_min == 3
    assert opening.opens_at is not None
    assert "Strong Python and modern C++" in opening.description_text
    assert "Build LLM and RAG systems" in opening.description_text


def test_synopsys_detail_rejects_page_without_jobposting() -> None:
    listing = parse_synopsys_korea_listing_openings(
        """
        <section id="search-results" data-total-job-results="1">
          <section id="search-results-list">
            <a class="sr-job-link" data-job-id="95110591648"
               href="/job/seongnam-si/r-and-d-engineer-agentic-ai/44408/95110591648">
              <h2>R&amp;D Engineer - Agentic AI</h2>
              <span class="job-location">Seongnam-si, South Korea</span>
            </a>
          </section>
        </section>
        """,
        LISTING_URL,
    )[0]

    with pytest.raises(ValueError, match="JobPosting"):
        parse_synopsys_detail_opening("<html></html>", listing.url, listing)
