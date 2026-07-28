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


def _enterprise_opening(
    external_id: str,
    url: str,
    title: str,
) -> ParsedOpening:
    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status="open",
        description_html="",
        description_text="listing metadata",
        employment_type="경력",
        career_type="experienced",
        career_min=None,
        career_max=None,
        location="서울",
        opens_at=None,
        closes_at=None,
    )


@pytest.mark.parametrize(
    ("connector_family", "listing_url", "opening", "expected"),
    [
        (
            "enterprise_json",
            (
                "https://recruit.cj.net/recruit/ko/common/common/"
                "jobListInfo.fo?COMPANY=E10"
            ),
            _enterprise_opening(
                "J20260714039188",
                (
                    "https://recruit.cj.net/recruit/ko/recruit/recruit/"
                    "bestDetail.fo?zz_jo_num=J20260714039188"
                ),
                "[경력] 글로벌 SAP FI 운영/개발",
            ),
            {
                "url": (
                    "https://recruit.cj.net/recruit/ko/recruit/recruit/"
                    "bestDetail.fo?zz_jo_num=J20260714039188"
                ),
                "method": "GET",
                "json_body": None,
            },
        ),
        (
            "enterprise_json",
            (
                "https://talent.hyundai.com/api/rec/AP-HM-FO-02700?"
                "hgrCd=1&lang=en"
            ),
            _enterprise_opening(
                "2026-N2-268",
                (
                    "https://talent.hyundai.com/eng/apply/applyView.hc?"
                    "recuYy=2026&recuType=N2&recuCls=268"
                ),
                "[Manufacturing Robotics] Robotics Data Engineer",
            ),
            {
                "url": (
                    "https://talent.hyundai.com/api/rec/AP-HM-FO-02800?"
                    "hgrCd=1&lang=en&recuYy=2026&recuType=N2&recuCls=268"
                ),
                "method": "GET",
                "json_body": None,
                "headers": {
                    "Accept": "application/json, text/plain, */*",
                    "Referer": (
                        "https://talent.hyundai.com/eng/apply/applyView.hc?"
                        "recuYy=2026&recuType=N2&recuCls=268"
                    ),
                    "X-HKMC-SERVICE": "HM",
                    "X-HKMC-TOKEN": "null",
                },
            },
        ),
        (
            "enterprise_json",
            (
                "https://api.careers.lg.com/rmk/job/"
                "retrieveJobNoticesList"
            ),
            _enterprise_opening(
                "1001310",
                "https://careers.lg.com/apply/detail?id=1001310",
                "[LG CNS] 보안 분야 전문가 모집(경력)",
            ),
            {
                "url": (
                    "https://api.careers.lg.com/rmk/job/"
                    "retrieveJobNoticesDetail"
                ),
                "method": "POST",
                "json_body": {"jobNoticeId": "1001310"},
            },
        ),
        (
            "enterprise_json",
            (
                "https://hwadm.hanwhain.com/new-backend/portal/api/"
                "rcRecruit/search-rcrt"
            ),
            _enterprise_opening(
                "19210",
                (
                    "https://www.hanwhain.com/portal/apply/recruit/detail?"
                    "rtSeq=19210"
                ),
                "한화시스템 전자전 개발 부문 경력사원 채용",
            ),
            {
                "url": (
                    "https://hwadm.hanwhain.com/new-backend/portal/api/"
                    "rcRecruit/get-rcrt"
                ),
                "method": "POST",
                "json_body": {
                    "rtSeq": 19210,
                    "hidnKey": None,
                    "langCd": "ko",
                },
                "headers": {
                    "Accept": "application/json",
                    "Referer": "https://www.hanwhain.com/",
                    "X-Menu-Path": "/apply/recruit/detail",
                },
            },
        ),
        (
            "smilegate_api",
            "https://careers.smilegate.com/api/apply/announce/guest",
            _enterprise_opening(
                "6169",
                (
                    "https://careers.smilegate.com/apply/announce/view?"
                    "seq=6169"
                ),
                "[샌드박스] 개발 PM 담당",
            ),
            {
                "url": (
                    "https://careers.smilegate.com/api/apply/announce/"
                    "guest/6169?type=finalSelect"
                ),
                "method": "GET",
                "json_body": None,
            },
        ),
    ],
)
def test_official_detail_request_builds_validated_enterprise_requests(
    connector_family: str,
    listing_url: str,
    opening: ParsedOpening,
    expected: dict[str, object],
) -> None:
    from ejikfit.connectors.official_detail import official_detail_request

    request = official_detail_request(
        connector_family,
        listing_url,
        opening,
    )

    assert request is not None
    assert request.url == expected["url"]
    assert request.method == expected["method"]
    assert request.json_body == expected["json_body"]
    if "headers" in expected:
        assert request.headers == expected["headers"]


def test_enterprise_detail_request_rejects_untrusted_opening_url() -> None:
    from ejikfit.connectors.official_detail import official_detail_request

    opening = _enterprise_opening(
        "1001310",
        "https://attacker.example/apply/detail?id=1001310",
        "[LG CNS] 보안 분야 전문가 모집(경력)",
    )

    with pytest.raises(ValueError, match="official"):
        official_detail_request(
            "enterprise_json",
            (
                "https://api.careers.lg.com/rmk/job/"
                "retrieveJobNoticesList"
            ),
            opening,
        )


def test_lg_uplus_connector_uses_the_same_validated_detail_api() -> None:
    from ejikfit.connectors.official_detail import official_detail_request

    opening = _enterprise_opening(
        "1001888",
        "https://careers.lg.com/apply/detail?id=1001888",
        "[정보보안센터] 침해사고 예방 및 대응 경력채용",
    )

    request = official_detail_request(
        "lg_careers_lguplus_tech",
        (
            "https://api.careers.lg.com/rmk/job/"
            "retrieveJobNoticesList#lg-uplus"
        ),
        opening,
    )

    assert request is not None
    assert request.url == (
        "https://api.careers.lg.com/rmk/job/retrieveJobNoticesDetail"
    )
    assert request.method == "POST"
    assert request.json_body == {"jobNoticeId": "1001888"}
