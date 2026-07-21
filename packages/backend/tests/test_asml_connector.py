from ejikfit.connectors.asml import (
    parse_asml_detail_opening,
    parse_asml_korea_listing_openings,
)


LISTING_URL = (
    "https://www.asml.com/en/careers/find-your-job?"
    "job_country=Korea%2C+Republic+of&job_type=Fix"
)


def test_asml_listing_parser_keeps_only_korean_job_cards() -> None:
    html = """
    <main>
      <a class="search-results__item"
         href="https://www.asml.com/en/careers/find-your-job/de-rd-software-engineer-metrology-scanner-sw-j00347056">
        <div class="search-results__title">
          <h2 class="search-results-title-text">
            D&amp;E(R&amp;D) Software engineer - Metrology, Scanner SW
          </h2>
          <button data-job-id="J-00347056">Save</button>
        </div>
        <ul class="search-results__fields">
          <li>Hwasung, Korea</li>
          <li>Design Engineering and Architecture</li>
        </ul>
      </a>
      <a class="search-results__item"
         href="https://www.asml.com/en/careers/find-your-job/software-engineer-san-jose-j00349999">
        <h2 class="search-results-title-text">Software Engineer</h2>
        <button data-job-id="J-00349999">Save</button>
        <ul class="search-results__fields">
          <li>San Jose, CA, US</li>
          <li>Software</li>
        </ul>
      </a>
      <a href="/en/careers/find-your-job">Search jobs</a>
    </main>
    """

    openings = parse_asml_korea_listing_openings(html, LISTING_URL)

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "J-00347056"
    assert opening.title == (
        "D&E(R&D) Software engineer - Metrology, Scanner SW"
    )
    assert opening.location == "Hwasung, Korea"
    assert opening.url.endswith(
        "/de-rd-software-engineer-metrology-scanner-sw-j00347056"
    )
    assert "Design Engineering and Architecture" in opening.description_text


def test_asml_detail_parser_maps_structured_job_data() -> None:
    html = """
    <script id="__NEXT_DATA__" type="application/json">
    {
      "props": {
        "pageProps": {
          "jobData": {
            "id": "J-00347056",
            "displayJobTitle": "D&amp;E(R&amp;D) Software engineer",
            "status": "Open",
            "datePosted": "2026-07-08T00:00:00",
            "postingExpirationDate": "2026-07-31T00:00:00",
            "location": "Hwasung, Korea",
            "experienceLevel": ["4-9 years", "10-15 years"],
            "technicalField": ["Software"],
            "team": ["Design Engineering and Architecture"],
            "programmingLanguages": ["C++", "C", "Python"],
            "timeType": "Full time",
            "jobType": "Fix",
            "descriptionExternal": "<h2>Role</h2><p>Build scanner software with C++ and Python.</p>"
          }
        }
      }
    }
    </script>
    """
    url = (
        "https://www.asml.com/en/careers/find-your-job/"
        "de-rd-software-engineer-metrology-scanner-sw-j00347056"
    )

    opening = parse_asml_detail_opening(html, url)

    assert opening.external_id == "J-00347056"
    assert opening.title == "D&E(R&D) Software engineer"
    assert opening.location == "Hwasung, Korea"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.career_min == 4
    assert opening.career_max == 15
    assert opening.opens_at is not None
    assert opening.closes_at is not None
    assert "Build scanner software with C++ and Python." in opening.description_text
    assert "Programming languages: C++, C, Python" in opening.description_text


def test_asml_detail_parser_rejects_missing_job_data() -> None:
    try:
        parse_asml_detail_opening(
            '<script id="__NEXT_DATA__" type="application/json">'
            '{"props":{"pageProps":{}}}</script>',
            "https://www.asml.com/en/careers/find-your-job/missing",
        )
    except ValueError as error:
        assert str(error) == "ASML job data is missing"
    else:
        raise AssertionError("missing ASML job data must be rejected")
