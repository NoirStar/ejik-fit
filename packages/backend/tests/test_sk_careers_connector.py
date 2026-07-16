from ejikfit.connectors.sk_careers import (
    is_sk_careers_listing_url,
    parse_sk_careers_detail_opening,
)
from ejikfit.skill_extraction import extract_skill_matches


def test_parse_sk_careers_detail_keeps_structured_skill_requirements() -> None:
    html = """
    <main class="announcement-detail-page-content">
      <div class="detail-content-wrapper">
        <div class="detail-content-item">
          <h3 class="detail-content-title">About the job</h3>
          <div class="detail-content-box">
            <strong class="item-label">담당 업무 및 역할</strong>
            <strong class="asset-title">AI 플랫폼 아키텍처 설계 및 구축</strong>
          </div>
        </div>
        <div class="detail-content-item">
          <h3 class="detail-content-title">Who We're Looking For</h3>
          <div class="detail-content-box">
            <strong class="item-label">지원자격</strong>
            <strong class="asset-title">관련 경력 3년 이상</strong>
            <strong class="asset-title">Docker 기반 개발 환경 사용 경험</strong>
          </div>
        </div>
        <div class="detail-content-item">
          <h3 class="detail-content-title">Preferred Qualifications</h3>
          <div class="detail-content-box">
            <strong class="item-label">우대사항</strong>
            <strong class="asset-title">Kubernetes, Airflow, MLflow 등 MLOps 도구 사용 경험</strong>
            <strong class="asset-title">LLM 기반 서비스(RAG, Agent 등) 개발 경험</strong>
          </div>
        </div>
      </div>
      <div class="floating-box">
        <h2 class="box-title">SK키파운드리 AI Platform 경력 채용</h2>
        <div class="box-detail">
          <div class="box-detail-item"><div class="label">지원 기간</div><div class="value">July 10, 2026(Fri)~July 26, 2026(Sun)</div></div>
          <div class="box-detail-item"><div class="label">마감 시간</div><div class="value">23:59</div></div>
          <div class="box-detail-item"><div class="label">회사</div><div class="value">SK keyfoundry</div></div>
          <div class="box-detail-item"><div class="label">직무</div><div class="value">DT</div></div>
          <div class="box-detail-item"><div class="label">구분</div><div class="value">Experienced</div></div>
          <div class="box-detail-item"><div class="label">지역</div><div class="value">Chungcheong - 청주시 흥덕구</div></div>
          <div class="box-detail-item"><div class="label">유형</div><div class="value">Permanent</div></div>
        </div>
      </div>
    </main>
    """

    opening = parse_sk_careers_detail_opening(
        html,
        "https://www.skcareers.com/Recruit/Detail/R261542",
    )

    assert opening.external_id == "R261542"
    assert opening.title == "SK키파운드리 AI Platform 경력 채용"
    assert opening.employment_type == "regular"
    assert opening.career_type == "experienced"
    assert opening.career_min == 3
    assert opening.location == "Chungcheong - 청주시 흥덕구"
    assert opening.opens_at is not None
    assert opening.opens_at.day == 10
    assert opening.closes_at is not None
    assert opening.closes_at.day == 26
    assert opening.closes_at.hour == 23
    assert opening.closes_at.minute == 59
    assert "지원자격" in opening.description_text
    assert "Docker" in opening.description_text
    assert "우대사항" in opening.description_text
    assert "Kubernetes" in opening.description_text
    assert "LLM" in opening.description_text
    assert "RAG" in opening.description_text

    requirements = {
        match.skill: match.requirement_type.value
        for match in extract_skill_matches(
            title=opening.title,
            description_html=opening.description_html,
            description_text=opening.description_text,
        )
    }
    assert requirements["Docker"] == "required"
    assert requirements["Kubernetes"] == "preferred"
    assert requirements["MLOps"] == "preferred"
    assert requirements["LLM"] == "preferred"
    assert requirements["RAG"] == "preferred"


def test_sk_listing_url_requires_the_official_post_endpoint() -> None:
    assert is_sk_careers_listing_url(
        "https://www.skcareers.com/Recruit/GetRecruitList#sk-intellix"
    )
    assert not is_sk_careers_listing_url(
        "https://untrusted.example/Recruit/GetRecruitList"
    )
