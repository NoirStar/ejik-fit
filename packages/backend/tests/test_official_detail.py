import pytest

from ejikfit.connectors.types import ParsedOpening


def _opening() -> ParsedOpening:
    return ParsedOpening(
        external_id="30005224",
        url=(
            "https://recruit.webtoonscorp.com/rcrt/view.do?"
            "annoId=30005224"
        ),
        title="[네이버웹툰] 프런트엔드 개발자",
        status="open",
        description_html="",
        description_text="Tech Frontend NAVER WEBTOON",
        employment_type="정규",
        career_type="experienced",
        career_min=None,
        career_max=None,
        location=None,
        opens_at=None,
        closes_at=None,
    )


@pytest.mark.parametrize(
    "connector_family",
    ["naver_company_json_tech", "naver_webtoon_json_tech"],
)
def test_official_detail_request_uses_naver_opening_url(
    connector_family: str,
) -> None:
    from ejikfit.connectors.official_detail import official_detail_request

    opening = _opening()
    request = official_detail_request(
        connector_family,
        "https://recruit.webtoonscorp.com/rcrt/loadJobList.do",
        opening,
    )

    assert request is not None
    assert request.url == opening.url
    assert request.method == "GET"
    assert request.json_body is None
    assert request.headers is None


def test_official_detail_request_ignores_unregistered_connector() -> None:
    from ejikfit.connectors.official_detail import official_detail_request

    assert (
        official_detail_request(
            "enterprise_json",
            "https://example.com/jobs.json",
            _opening(),
        )
        is None
    )


def test_parse_official_detail_dispatches_to_naver_parser() -> None:
    from ejikfit.connectors.official_detail import parse_official_detail

    opening = _opening()
    body = (
        "React와 TypeScript 기반 웹 서비스를 설계하고 운영하며 "
        "Next.js 서버 렌더링과 Node.js 실행 환경을 깊이 이해합니다. "
        "사용자 경험과 성능 지표를 함께 개선하고 안정적인 테스트와 "
        "배포 자동화를 구축한 경험이 있는 개발자를 찾습니다. "
        "Docker와 Kubernetes 운영 경험을 우대합니다."
    )
    raw = f"""
    <input name="annoId" value="{opening.external_id}">
    <h4 class="card_title">{opening.title}</h4>
    <div class="detail_wrap">
      <div class="detail_box"><h4>필요 역량</h4><div>{body}</div></div>
    </div>
    """

    detailed = parse_official_detail(
        raw,
        opening.url,
        "naver_webtoon_json_tech",
        "https://recruit.webtoonscorp.com/rcrt/loadJobList.do",
        opening,
    )

    assert "React와 TypeScript" in detailed.description_text
    assert detailed.external_id == opening.external_id


def test_official_detail_request_uses_line_page_data_json() -> None:
    from ejikfit.connectors.official_detail import official_detail_request

    opening = ParsedOpening(
        external_id="2100",
        url="https://careers.linecorp.com/ko/jobs/2100",
        title="Server Engineer, Messaging Platform",
        status="open",
        description_html="",
        description_text="Engineering Backend LINE Plus Seoul Korea",
        employment_type="Full-time",
        career_type=None,
        career_min=None,
        career_max=None,
        location="Seoul, Korea",
        opens_at=None,
        closes_at=None,
    )

    request = official_detail_request(
        "line_gatsby",
        "https://careers.linecorp.com/page-data/jobs/page-data.json",
        opening,
    )

    assert request is not None
    assert request.url == (
        "https://careers.linecorp.com/page-data/ko/jobs/2100/"
        "page-data.json"
    )
    assert request.method == "GET"
