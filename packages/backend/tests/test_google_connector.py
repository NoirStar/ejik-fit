import pytest

from ejikfit.connectors.google import (
    parse_google_job_detail,
    parse_google_korea_listing_openings,
)


LISTING_URL = (
    "https://www.google.com/about/careers/applications/jobs/results/"
    "?distance=50&location=Seoul%2C%20South%20Korea&q=engineer"
)


def _result(title: str, job_id: str, slug: str) -> str:
    return f"""
    <div class="Ln1EL">
      <h3 class="QJPWVe">{title}</h3>
      <span class="r0wTof">Seoul, South Korea</span>
      <a aria-label="Learn more about {title}"
         href="jobs/results/{job_id}-{slug}?distance=50&amp;location=Seoul">
        Learn more
      </a>
    </div>
    """


def _listing_html(total: int = 3) -> str:
    return f"""
    <div class="rZt9ff"><span class="SWhIm">{total}</span> jobs matched</div>
    {_result("Software Engineer III, Camera System Software", "100776713255822022", "software-engineer")}
    {_result("AI Customer Engineer, Google Cloud", "87907180908290758", "ai-customer-engineer")}
    {_result("Field Sales Representative, Google Cloud", "97215628095431366", "field-sales")}
    """


def test_google_listing_reconciles_total_and_keeps_only_technical_roles() -> None:
    openings = parse_google_korea_listing_openings(_listing_html(), LISTING_URL)

    assert [opening.external_id for opening in openings] == [
        "100776713255822022",
        "87907180908290758",
    ]
    assert openings[0].title == "Software Engineer III, Camera System Software"
    assert openings[0].location == "Seoul, South Korea"
    assert openings[0].url.startswith(
        "https://www.google.com/about/careers/applications/jobs/results/"
    )


def test_google_listing_rejects_an_incomplete_result_page() -> None:
    with pytest.raises(ValueError, match="expected 4, received 3"):
        parse_google_korea_listing_openings(_listing_html(total=4), LISTING_URL)


def test_google_detail_maps_qualifications_and_job_metadata() -> None:
    html = """
    <div class="DkhPwc" data-id="100776713255822022">
      <div class="sPeqm">
        <h2 class="p1N2lc">Software Engineer III, Camera System Software</h2>
      </div>
      <div class="op1BBf">
        <span class="r0wTof">Seoul, South Korea</span>
        <span class="BK5CCe">Mid</span>
      </div>
      <div class="KwJkGe">
        <h3>Minimum qualifications:</h3>
        <ul>
          <li>Bachelor's degree or equivalent practical experience.</li>
          <li>2 years of experience with software development.</li>
          <li>1 year of experience programming in C++.</li>
        </ul>
        <h3>Preferred qualifications:</h3>
        <ul><li>Experience developing camera system software with Python.</li></ul>
      </div>
      <div class="aG5W3">
        <h3>About the job</h3>
        <p>Build the camera system software stack for Pixel devices.</p>
      </div>
      <div class="BDNOWe">
        <h3>Responsibilities</h3>
        <ul><li>Design and implement reliable production software.</li></ul>
      </div>
    </div>
    """
    detail_url = (
        "https://www.google.com/about/careers/applications/jobs/results/"
        "100776713255822022-software-engineer-iii-camera-system-software"
    )

    opening = parse_google_job_detail(html, detail_url)

    assert opening.external_id == "100776713255822022"
    assert opening.title == "Software Engineer III, Camera System Software"
    assert "Minimum qualifications" in opening.description_text
    assert "Preferred qualifications" in opening.description_text
    assert opening.location == "Seoul, South Korea"
    assert opening.career_type == "experienced"
    assert opening.career_min == 2


def test_google_detail_rejects_a_non_official_job_url() -> None:
    with pytest.raises(ValueError, match="official Google Careers"):
        parse_google_job_detail("<html></html>", "https://jobs.example.com/1")
