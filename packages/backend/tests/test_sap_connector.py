import pytest

from ejikfit.connectors.sap import (
    parse_sap_job_detail,
    parse_sap_korea_listing_openings,
)


LISTING_URL = "https://jobs.sap.com/search/?q=&locationsearch=Korea"


def _listing_html(total: int = 3) -> str:
    return f"""
    <div class="paginationLabel">Results <b>1 – {total}</b> of <b>{total}</b></div>
    <table id="searchresults"><tbody>
      <tr class="data-row">
        <td class="colTitle"><a class="jobTitle-link"
          href="/job/Seoul-HANA-Cloud-Developer-06578/1270982501/">
          HANA Cloud Developer
        </a></td>
        <td class="colLocation"><span class="jobLocation">Seoul, KR, 06578</span></td>
      </tr>
      <tr class="data-row">
        <td class="colTitle"><a class="jobTitle-link"
          href="/job/Seoul-Solution-Sales-Executive-07326/1402673633/">
          Solution Sales Executive, South Korea
        </a></td>
        <td class="colLocation"><span class="jobLocation">Seoul, KR, 07326</span></td>
      </tr>
      <tr class="data-row">
        <td class="colTitle"><a class="jobTitle-link"
          href="/job/Seoul-SAP-Business-AI-Principal-Architect-07326/1381972533/">
          SAP Business AI Principal Architect
        </a></td>
        <td class="colLocation"><span class="jobLocation">Seoul, KR, 07326</span></td>
      </tr>
    </tbody></table>
    """


def test_sap_listing_reconciles_total_and_keeps_only_technical_roles() -> None:
    openings = parse_sap_korea_listing_openings(_listing_html(), LISTING_URL)

    assert [opening.external_id for opening in openings] == [
        "1270982501",
        "1381972533",
    ]
    assert [opening.title for opening in openings] == [
        "HANA Cloud Developer",
        "SAP Business AI Principal Architect",
    ]
    assert openings[0].location == "Seoul, KR, 06578"


def test_sap_listing_rejects_an_incomplete_result_page() -> None:
    with pytest.raises(ValueError, match="expected 4, received 3"):
        parse_sap_korea_listing_openings(_listing_html(total=4), LISTING_URL)


def test_sap_detail_maps_official_description_and_job_metadata() -> None:
    html = """
    <div itemscope itemtype="http://schema.org/JobPosting">
      <meta itemprop="datePosted" content="Sun Jun 21 02:00:00 UTC 2026">
      <h1><span itemprop="title" data-careersite-propertyid="title">
        HANA Cloud Developer
      </span></h1>
      <span data-careersite-propertyid="department">Development</span>
      <span itemprop="description" data-careersite-propertyid="description">
        <p>Build and operate SAP HANA Cloud database services with Python and SQL.</p>
        <p>At least 5 years of professional software engineering experience is required.</p>
      </span>
      <span data-careersite-propertyid="customfield3">Professional</span>
      <span data-careersite-propertyid="shifttype">Regular Full Time</span>
      <span data-careersite-propertyid="location">Seoul, KR, 06578</span>
    </div>
    """
    detail_url = (
        "https://jobs.sap.com/job/Seoul-HANA-Cloud-Developer-06578/1270982501/"
    )

    opening = parse_sap_job_detail(html, detail_url)

    assert opening.external_id == "1270982501"
    assert opening.title == "HANA Cloud Developer"
    assert opening.description_text.startswith("Development Build and operate")
    assert opening.employment_type == "정규직"
    assert opening.career_type == "experienced"
    assert opening.career_min == 5
    assert opening.location == "Seoul, KR, 06578"
    assert opening.opens_at is not None
