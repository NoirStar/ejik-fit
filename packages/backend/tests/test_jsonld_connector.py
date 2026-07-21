from pathlib import Path

from ejikfit.connectors.jsonld import parse_jsonld_openings


def test_parses_schema_org_job_posting() -> None:
    path = (
        Path(__file__).parents[3]
        / "tests"
        / "fixtures"
        / "jsonld"
        / "job.html"
    )
    jobs = parse_jsonld_openings(
        path.read_text(),
        "https://example.com/jobs/backend-1",
    )

    assert len(jobs) == 1
    assert jobs[0].external_id == "backend-1"
    assert jobs[0].title == "신입 백엔드 개발자"
    assert jobs[0].location == "서울"
    assert jobs[0].career_type == "new_comer"
    assert jobs[0].employment_type == "FULL_TIME"
    assert jobs[0].description_text == "## 자격 요건\nPython 기초"


def test_accepts_non_zero_padded_schema_date() -> None:
    jobs = parse_jsonld_openings(
        """
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "identifier": "job-1",
          "title": "Software Engineer",
          "datePosted": "2026-5-15",
          "description": "<p>Build software.</p>"
        }
        </script>
        """,
        "https://example.com/jobs/job-1",
    )

    assert len(jobs) == 1
    assert jobs[0].opens_at is not None
    assert jobs[0].opens_at.isoformat().startswith("2026-05-15")
