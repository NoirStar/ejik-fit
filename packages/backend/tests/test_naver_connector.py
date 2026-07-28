import json

import pytest

from ejikfit.connectors.types import ParsedOpening


def test_parse_naver_openings_maps_public_job_list_json() -> None:
    from ejikfit.connectors.naver import parse_naver_openings

    payload = {
        "result": True,
        "list": [
            {
                "annoId": 1001,
                "annoSubject": "Backend Engineer - Search Platform",
                "jobDetailLink": (
                    "https://recruit.navercorp.com/rcrt/view.do?annoId=1001"
                ),
                "entTypeCdNm": "경력",
                "empTypeCdNm": "정규",
                "classCdNm": "Tech",
                "subJobCdNm": "Backend",
                "annoKeyword": "Java, Spring, Kubernetes",
                "sysCompanyCdNm": "NAVER",
                "staYmdTime": "2026.07.01 10:00:00",
                "endYmdTime": "2026.07.31 18:00:00",
            },
            {
                "annoId": 1002,
                "annoSubject": "",
            },
        ],
    }

    openings = parse_naver_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "1001"
    assert opening.title == "Backend Engineer - Search Platform"
    assert opening.url == "https://recruit.navercorp.com/rcrt/view.do?annoId=1001"
    assert opening.status == "open"
    assert opening.employment_type == "정규"
    assert opening.career_type == "experienced"
    assert opening.description_text == "Tech Backend Java, Spring, Kubernetes NAVER"
    assert opening.opens_at is not None
    assert opening.closes_at is not None


def test_parse_naver_openings_builds_missing_detail_link_on_listing_host() -> None:
    from ejikfit.connectors.naver import parse_naver_openings

    openings = parse_naver_openings(
        json.dumps(
            {
                "list": [
                    {
                        "annoId": 30005224,
                        "annoSubject": "[네이버웹툰] 프런트엔드 개발자",
                    }
                ]
            },
            ensure_ascii=False,
        ),
        "https://recruit.webtoonscorp.com/rcrt/loadJobList.do?lang=ko",
    )

    assert openings[0].url == (
        "https://recruit.webtoonscorp.com/rcrt/view.do?annoId=30005224"
    )


def _listing_opening() -> ParsedOpening:
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


def _detail_html(
    *,
    anno_id: str = "30005224",
    title: str = "[네이버웹툰] 프런트엔드 개발자",
    sparse: bool = False,
) -> str:
    requirements = (
        "React, TypeScript 기반 개발에 능숙하고 Next.js SSR 환경과 "
        "Node.js 서버 사이드 동작을 이해하며 복잡한 비즈니스 요구사항을 "
        "견고한 프런트엔드 모델로 설계하고 운영할 수 있는 분을 찾습니다."
    )
    preferred = (
        "Docker와 Kubernetes 배포 환경, Canvas와 WebGL 렌더링, "
        "Electron 기반 데스크톱 애플리케이션 개발 경험을 우대합니다."
    )
    if sparse:
        requirements = "React"
        preferred = ""
    return f"""
    <html>
      <body>
        <input name="annoId" value="{anno_id}">
        <h4 class="card_title">{title}</h4>
        <div class="detail_wrap">
          <div class="detail_box">
            <h4 class="detail_title">필요 역량</h4>
            <p class="detail_text"></p>
            <div>{requirements}</div>
          </div>
          <div class="detail_box">
            <h4 class="detail_title">우대 사항</h4>
            <p class="detail_text"></p>
            <div>{preferred}</div>
          </div>
        </div>
        <footer>채용 사이트 공통 푸터</footer>
        <script>window.tracker = true;</script>
      </body>
    </html>
    """


def test_parse_naver_detail_opening_reads_siblings_after_empty_detail_text() -> None:
    from ejikfit.connectors.naver import parse_naver_detail_opening

    listing = _listing_opening()
    opening = parse_naver_detail_opening(
        _detail_html(),
        listing.url,
        listing,
    )

    assert opening.external_id == listing.external_id
    assert opening.title == listing.title
    assert opening.description_text.startswith("### 필요 역량")
    assert "React, TypeScript" in opening.description_text
    assert "Docker와 Kubernetes" in opening.description_text
    assert "Electron 기반" in opening.description_text
    assert "채용 사이트 공통 푸터" not in opening.description_text
    assert "window.tracker" not in opening.description_html
    assert len(opening.description_text) >= 120
    assert opening.employment_type == listing.employment_type
    assert opening.career_type == listing.career_type


@pytest.mark.parametrize(
    ("html", "message"),
    [
        (_detail_html(anno_id="99999999"), "identity"),
        (_detail_html(title="다른 공고"), "title"),
        (_detail_html(sparse=True), "sparse"),
        ("<html><body>상세 없음</body></html>", "missing"),
    ],
)
def test_parse_naver_detail_opening_rejects_untrusted_detail(
    html: str,
    message: str,
) -> None:
    from ejikfit.connectors.naver import parse_naver_detail_opening

    listing = _listing_opening()
    with pytest.raises(ValueError, match=message):
        parse_naver_detail_opening(html, listing.url, listing)
