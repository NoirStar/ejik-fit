import json

import pytest

from ejikfit.connectors.types import ParsedOpening


CJ_LISTING_URL = (
    "https://recruit.cj.net/recruit/ko/common/common/jobListInfo.fo?"
    "COMPANY=E10"
)
CJ_DETAIL_URL = (
    "https://recruit.cj.net/recruit/ko/recruit/recruit/bestDetail.fo?"
    "zz_jo_num=J20260714039188"
)
HYUNDAI_LISTING_URL = (
    "https://talent.hyundai.com/api/rec/AP-HM-FO-02700?"
    "hgrCd=1&lang=en"
)
HYUNDAI_DETAIL_URL = (
    "https://talent.hyundai.com/api/rec/AP-HM-FO-02800?"
    "hgrCd=1&lang=en&recuYy=2026&recuType=N2&recuCls=268"
)
KIA_LISTING_URL = (
    "https://career.kia.com/api/rec/AP-KM-FO-02700?"
    "hgrCd=2&lang=ko&page=1&pageblock=100"
)
KIA_DETAIL_URL = (
    "https://career.kia.com/api/rec/AP-KM-FO-02800?"
    "hgrCd=2&lang=ko&recuYy=2026&recuType=N3&recuCls=12"
)
LG_LISTING_URL = (
    "https://api.careers.lg.com/rmk/job/retrieveJobNoticesList"
)
LG_DETAIL_URL = (
    "https://api.careers.lg.com/rmk/job/retrieveJobNoticesDetail"
)
HANWHA_LISTING_URL = (
    "https://hwadm.hanwhain.com/new-backend/portal/api/"
    "rcRecruit/search-rcrt"
)
HANWHA_DETAIL_URL = (
    "https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/get-rcrt"
)
SMILEGATE_LISTING_URL = (
    "https://careers.smilegate.com/api/apply/announce/guest"
)
SMILEGATE_DETAIL_URL = (
    "https://careers.smilegate.com/api/apply/announce/guest/6169?"
    "type=finalSelect"
)


def _opening(
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


def _parse(
    raw: str,
    response_url: str,
    connector_family: str,
    listing_url: str,
    opening: ParsedOpening,
) -> ParsedOpening:
    from ejikfit.connectors.enterprise_detail import parse_enterprise_detail

    return parse_enterprise_detail(
        raw,
        response_url,
        connector_family,
        listing_url,
        opening,
    )


def _cj_html(
    *,
    title: str = "[경력] CJ 유통 계열사 글로벌 SAP FI 운영/개발",
    sparse: bool = False,
) -> str:
    body = "SAP" if sparse else (
        "CJ 유통 계열사의 글로벌 SAP FI 모듈을 운영하고 GL, AA, AR, "
        "AP 및 세무 프로세스의 안정성과 성능을 개선합니다. 국가별 재무 "
        "규제 변경을 분석해 시스템에 반영하고 인터페이스 장애를 해결하며 "
        "Java 기반 연계 서비스와 데이터 정합성 검증 자동화를 설계합니다."
    )
    return f"""
    <html><body>
      <main class="detail-wrap">
        <h1 class="title">{title}</h1>
        <section class="detail-list">
          <h3 class="tit">직무소개</h3><p>{body}</p>
        </section>
      </main>
      <footer>개인정보 처리방침과 공통 푸터</footer>
    </body></html>
    """


def test_parse_cj_detail_keeps_only_job_sections() -> None:
    listing = _opening(
        "J20260714039188",
        CJ_DETAIL_URL,
        "[경력] CJ 유통 계열사 글로벌 SAP FI 운영/개발",
    )

    opening = _parse(
        _cj_html(),
        CJ_DETAIL_URL,
        "enterprise_json",
        CJ_LISTING_URL,
        listing,
    )

    assert opening.url == listing.url
    assert "### 직무소개" in opening.description_text
    assert "SAP FI 모듈" in opening.description_text
    assert "Java 기반" in opening.description_text
    assert "개인정보 처리방침" not in opening.description_text
    assert "footer" not in opening.description_html
    assert opening.employment_type == listing.employment_type

    with pytest.raises(ValueError, match="title"):
        _parse(
            _cj_html(title="다른 공고"),
            CJ_DETAIL_URL,
            "enterprise_json",
            CJ_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="sparse"):
        _parse(
            _cj_html(sparse=True),
            CJ_DETAIL_URL,
            "enterprise_json",
            CJ_LISTING_URL,
            listing,
        )


def test_enterprise_detail_rejects_credentialed_listing_url() -> None:
    from ejikfit.connectors.enterprise_detail import enterprise_detail_request

    listing = _opening(
        "J20260714039188",
        CJ_DETAIL_URL,
        "[경력] CJ 유통 계열사 글로벌 SAP FI 운영/개발",
    )

    with pytest.raises(ValueError, match="official"):
        enterprise_detail_request(
            "enterprise_json",
            CJ_LISTING_URL.replace("https://", "https://crawler@"),
            listing,
        )


def test_enterprise_detail_rejects_nonstandard_opening_port() -> None:
    from ejikfit.connectors.enterprise_detail import enterprise_detail_request

    listing = _opening(
        "J20260714039188",
        CJ_DETAIL_URL.replace("recruit.cj.net", "recruit.cj.net:8443"),
        "[경력] CJ 유통 계열사 글로벌 SAP FI 운영/개발",
    )

    with pytest.raises(ValueError, match="official"):
        enterprise_detail_request(
            "enterprise_json",
            CJ_LISTING_URL,
            listing,
        )


def test_enterprise_detail_rejects_fragmented_response_url() -> None:
    listing = _opening(
        "J20260714039188",
        CJ_DETAIL_URL,
        "[경력] CJ 유통 계열사 글로벌 SAP FI 운영/개발",
    )

    with pytest.raises(ValueError, match="official"):
        _parse(
            _cj_html(),
            f"{CJ_DETAIL_URL}#untrusted",
            "enterprise_json",
            CJ_LISTING_URL,
            listing,
        )


def _hyundai_payload(
    *,
    recu_cls: int = 268,
    title: str = "[Manufacturing Robotics] Robotics Data Engineer",
    sparse: bool = False,
) -> str:
    fields = (
        {"aboutTeamNtc": "Python"}
        if sparse
        else {
            "aboutTeamNtc": (
                "We develop mobile robot application solutions and validate "
                "manufacturing use cases before production deployment."
            ),
            "privJdDtl": (
                "Design cloud data pipelines for robotics video collection, "
                "storage, processing, annotation, validation, and distribution."
            ),
            "privMustReq": (
                "Experience building Python data systems and operating Kafka "
                "workloads with automated quality checks is required."
            ),
            "prefReq": (
                "Kubernetes, computer vision, and large-scale model training "
                "pipeline experience is preferred."
            ),
            "etc": "Collaborate with manufacturing and cloud platform teams.",
        }
    )
    return json.dumps(
        {
            "status": 200,
            "message": "OK",
            "data": {
                "applyInfo": {
                    "recuYy": "2026",
                    "recuType": "N2",
                    "recuCls": recu_cls,
                    "recuNoticeNm": title,
                    **fields,
                }
            },
        },
        ensure_ascii=False,
    )


def test_parse_hyundai_detail_builds_named_sections() -> None:
    listing = _opening(
        "2026-N2-268",
        (
            "https://talent.hyundai.com/eng/apply/applyView.hc?"
            "recuYy=2026&recuType=N2&recuCls=268"
        ),
        "[Manufacturing Robotics] Robotics Data Engineer",
    )

    opening = _parse(
        _hyundai_payload(),
        HYUNDAI_DETAIL_URL,
        "enterprise_json",
        HYUNDAI_LISTING_URL,
        listing,
    )

    assert "## 팀 소개" in opening.description_text
    assert "## 직무 상세" in opening.description_text
    assert "## 필수 요건" in opening.description_text
    assert "Python data systems" in opening.description_text
    assert "Kafka" in opening.description_text
    assert "Kubernetes" in opening.description_text

    with pytest.raises(ValueError, match="identity"):
        _parse(
            _hyundai_payload(recu_cls=999),
            HYUNDAI_DETAIL_URL,
            "enterprise_json",
            HYUNDAI_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="title"):
        _parse(
            _hyundai_payload(title="Different job"),
            HYUNDAI_DETAIL_URL,
            "enterprise_json",
            HYUNDAI_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="sparse"):
        _parse(
            _hyundai_payload(sparse=True),
            HYUNDAI_DETAIL_URL,
            "enterprise_json",
            HYUNDAI_LISTING_URL,
            listing,
        )


def test_parse_kia_detail_uses_shared_hkmc_fields() -> None:
    title = (
        "기아 글로벌 채용전환형 인턴십 - "
        "제조 로봇 데이터 엔지니어링 (제조솔루션)"
    )
    listing = _opening(
        "2026-N3-12",
        (
            "https://career.kia.com/apply/applyView.kc?"
            "recuYy=2026&recuType=N3&recuCls=12"
        ),
        title,
    )
    payload = json.dumps(
        {
            "status": 200,
            "message": "OK",
            "data": {
                "applyInfo": {
                    "recuYy": "2026",
                    "recuType": "N3",
                    "recuCls": 12,
                    "recuNoticeNm": title,
                    "aboutTeamNtc": (
                        "제조 로봇의 학습 데이터를 수집하고 생산 현장에 "
                        "적용하는 데이터 엔지니어링 팀입니다."
                    ),
                    "privJdDtl": (
                        "Python 기반 데이터 파이프라인을 설계하고 로봇 센서 "
                        "데이터의 수집, 정제, 검증과 배포를 자동화합니다."
                    ),
                    "privMustReq": (
                        "분산 데이터 처리와 SQL, 클라우드 스토리지 운영 및 "
                        "장애 분석 경험이 필요합니다."
                    ),
                    "prefReq": (
                        "Kafka, Kubernetes와 컴퓨터 비전 데이터셋 구축 "
                        "경험을 우대합니다."
                    ),
                    "etc": "채용전환형 인턴십으로 운영합니다.",
                }
            },
        },
        ensure_ascii=False,
    )

    opening = _parse(
        payload,
        KIA_DETAIL_URL,
        "kia_enterprise_json_tech",
        KIA_LISTING_URL,
        listing,
    )

    assert "## 팀 소개" in opening.description_text
    assert "Python 기반 데이터 파이프라인" in opening.description_text
    assert "Kafka, Kubernetes" in opening.description_text
    assert opening.url == listing.url

    mismatched = json.loads(payload)
    mismatched["data"]["applyInfo"]["recuCls"] = 99
    with pytest.raises(ValueError, match="identity"):
        _parse(
            json.dumps(mismatched, ensure_ascii=False),
            KIA_DETAIL_URL,
            "kia_enterprise_json_tech",
            KIA_LISTING_URL,
            listing,
        )


def _lg_payload(
    *,
    job_id: int = 1001310,
    title: str = "[LG CNS] 보안 분야 전문가 모집(경력)",
    sparse: bool = False,
) -> str:
    detail_context = "보안" if sparse else (
        "클라우드 환경의 애플리케이션 보안 아키텍처를 설계하고 Python "
        "자동화 도구로 취약점 진단과 대응 프로세스를 개선합니다."
    )
    return json.dumps(
        {
            "status": "S",
            "data": {
                "jobNoticesDetail": {
                    "jobNoticesDetail": {
                        "jobNoticeId": job_id,
                        "jobNoticeName": title,
                        "qualForAppInfo": (
                            "해외여행에 결격 사유가 없고 관련 분야의 실무 "
                            "경험과 협업 역량을 갖춘 분을 찾습니다."
                        ),
                        "recProcessInfo": (
                            "서류 검토, 실무 면접, 리더 면접과 건강검진 "
                            "순서로 전형을 진행합니다."
                        ),
                        "submitMethodInfo": "LG Careers를 통해 온라인 지원합니다.",
                    },
                    "recList": [
                        {
                            "jobNoticeId": job_id,
                            "orgName": "보안사업담당",
                            "jobGroupName": "AI보안",
                            "detailContext": f"<p>{detail_context}</p>",
                            "requiredItem": (
                                "<ul><li>웹 서비스와 네트워크 보안에 대한 "
                                "깊은 이해와 장애 분석 경험</li></ul>"
                            ),
                            "preferredItem": (
                                "<p>AWS, Kubernetes, SIEM 운영 경험 우대</p>"
                            ),
                        }
                    ],
                }
            },
        },
        ensure_ascii=False,
    )


def test_parse_lg_detail_combines_notice_and_role_sections() -> None:
    listing = _opening(
        "1001310",
        "https://careers.lg.com/apply/detail?id=1001310",
        "[LG CNS] 보안 분야 전문가 모집(경력)",
    )

    opening = _parse(
        _lg_payload(),
        LG_DETAIL_URL,
        "enterprise_json",
        LG_LISTING_URL,
        listing,
    )

    assert "## 보안사업담당 · AI보안" in opening.description_text
    assert "Python 자동화" in opening.description_text
    assert "AWS, Kubernetes" in opening.description_text
    assert "## 지원 자격 및 안내" in opening.description_text
    assert "<p>" not in opening.description_text

    with pytest.raises(ValueError, match="identity"):
        _parse(
            _lg_payload(job_id=999),
            LG_DETAIL_URL,
            "enterprise_json",
            LG_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="title"):
        _parse(
            _lg_payload(title="Different job"),
            LG_DETAIL_URL,
            "enterprise_json",
            LG_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="sparse"):
        sparse = json.loads(_lg_payload(sparse=True))
        row = sparse["data"]["jobNoticesDetail"]["recList"][0]
        row["requiredItem"] = None
        row["preferredItem"] = None
        _parse(
            json.dumps(sparse, ensure_ascii=False),
            LG_DETAIL_URL,
            "enterprise_json",
            LG_LISTING_URL,
            listing,
        )


def _hanwha_payload(
    *,
    rt_seq: int = 19210,
    title: str = "한화시스템 전자전 개발 부문 경력사원 채용",
    sparse: bool = False,
) -> str:
    role = "MATLAB" if sparse else (
        "전자전 체계 아키텍처를 설계하고 실험 데이터 기반 성능 검증과 "
        "신호처리 알고리즘을 개발합니다. MATLAB, Simulink와 Python을 "
        "활용한 모델링 및 자동화 경험이 필요합니다."
    )
    return json.dumps(
        {
            "success": True,
            "data": {
                "item": {
                    "rtSeq": rt_seq,
                    "rtNm": title,
                    "unitDt": [
                        {
                            "rtSeq": rt_seq,
                            "ruNm": "전자전 체계종합",
                            "ruDtlJob": role,
                            "ruWorkpl": "용인",
                        }
                    ],
                    "rtExmQlf": (
                        "관련 분야 학사 이상이며 해외여행과 보안 신원조회에 "
                        "결격 사유가 없어야 합니다."
                    ),
                    "rtExmProc": "서류, 면접, 조직적합도 검사와 건강검진 진행",
                    "rtRctPrd": "한화인 채용 홈페이지를 통한 온라인 지원",
                    "rtEct": "허위 기재 시 합격이 취소될 수 있습니다.",
                }
            },
        },
        ensure_ascii=False,
    )


def test_parse_hanwha_detail_combines_units_and_common_guidance() -> None:
    listing = _opening(
        "19210",
        (
            "https://www.hanwhain.com/portal/apply/recruit/detail?"
            "rtSeq=19210"
        ),
        "한화시스템 전자전 개발 부문 경력사원 채용",
    )

    opening = _parse(
        _hanwha_payload(),
        HANWHA_DETAIL_URL,
        "enterprise_json",
        HANWHA_LISTING_URL,
        listing,
    )

    assert "## 전자전 체계종합" in opening.description_text
    assert "MATLAB, Simulink" in opening.description_text
    assert "## 공통 자격" in opening.description_text
    assert "## 전형 절차" in opening.description_text
    assert "## 지원 방법" in opening.description_text

    with pytest.raises(ValueError, match="identity"):
        _parse(
            _hanwha_payload(rt_seq=999),
            HANWHA_DETAIL_URL,
            "enterprise_json",
            HANWHA_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="title"):
        _parse(
            _hanwha_payload(title="Different job"),
            HANWHA_DETAIL_URL,
            "enterprise_json",
            HANWHA_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="sparse"):
        sparse = json.loads(_hanwha_payload(sparse=True))
        item = sparse["data"]["item"]
        item["rtExmQlf"] = None
        item["rtExmProc"] = None
        item["rtRctPrd"] = None
        item["rtEct"] = None
        _parse(
            json.dumps(sparse, ensure_ascii=False),
            HANWHA_DETAIL_URL,
            "enterprise_json",
            HANWHA_LISTING_URL,
            listing,
        )


def _smilegate_payload(
    *,
    announce_seq: int = 6169,
    title: str = "[샌드박스] 개발 PM 담당",
    sparse: bool = False,
) -> str:
    if sparse:
        fields = {"workInfo": "개발", "description": None}
    else:
        fields = {
            "workInfo": (
                "샌드박스 UGC 에디터 개발 일정과 마일스톤을 관리하고 "
                "기획, 개발, QA 조직의 이슈를 조율합니다."
            ),
            "qualificationDesc": (
                "소프트웨어 개발 프로세스와 애자일 프로젝트 운영 경험이 "
                "필요합니다."
            ),
            "abilityDesc": (
                "다수의 이해관계자와 원활하게 소통하고 기술 리스크를 "
                "사전에 분석할 수 있어야 합니다."
            ),
            "specialDesc": (
                "UGC 에디터, 게임 툴 또는 플랫폼 연동 프로젝트 경험자 우대"
            ),
            "description": (
                "&lt;p&gt;근무지는 판교이며 자동화된 테스트와 안정적인 "
                "배포 경험을 우대합니다.&lt;/p&gt;"
            ),
        }
    return json.dumps(
        {
            "announceSeq": announce_seq,
            "title": title,
            **fields,
        },
        ensure_ascii=False,
    )


def test_parse_smilegate_detail_decodes_and_structures_fields() -> None:
    listing = _opening(
        "6169",
        (
            "https://careers.smilegate.com/apply/announce/view?"
            "seq=6169"
        ),
        "[샌드박스] 개발 PM 담당",
    )

    opening = _parse(
        _smilegate_payload(),
        SMILEGATE_DETAIL_URL,
        "smilegate_api",
        SMILEGATE_LISTING_URL,
        listing,
    )

    assert "## 담당 업무" in opening.description_text
    assert "UGC 에디터 개발" in opening.description_text
    assert "## 자격 요건" in opening.description_text
    assert "## 필요 역량" in opening.description_text
    assert "## 우대 사항" in opening.description_text
    assert "## 기타 안내" in opening.description_text
    assert "<p>" not in opening.description_text
    assert "&lt;" not in opening.description_text

    with pytest.raises(ValueError, match="identity"):
        _parse(
            _smilegate_payload(announce_seq=999),
            SMILEGATE_DETAIL_URL,
            "smilegate_api",
            SMILEGATE_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="title"):
        _parse(
            _smilegate_payload(title="Different job"),
            SMILEGATE_DETAIL_URL,
            "smilegate_api",
            SMILEGATE_LISTING_URL,
            listing,
        )
    with pytest.raises(ValueError, match="sparse"):
        _parse(
            _smilegate_payload(sparse=True),
            SMILEGATE_DETAIL_URL,
            "smilegate_api",
            SMILEGATE_LISTING_URL,
            listing,
        )
