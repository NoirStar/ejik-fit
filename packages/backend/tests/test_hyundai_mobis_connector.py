from ejikfit.connectors.hyundai_mobis import (
    parse_hyundai_mobis_detail_opening,
    parse_hyundai_mobis_listing_openings,
)


def test_listing_uses_official_sw_job_category_and_specific_title() -> None:
    html = """
    <main>
      <span id="schCnt">2</span>
      <div id="jobList" class="job-list">
        <a href="/jobs-view?seq=3904" class="job-item">
          <div class="info-wrap01">
            <p class="career">경력-연구직</p>
            <p class="integrated">[로보틱스사업실] 26년 7월 연구직 경력채용</p>
          </div>
          <p class="tit">로봇 핸즈 시스템 설계 (SW Architecture 설계)</p>
          <div class="info-wrap02">
            <p>로보틱스사업실</p><p>SW/로직</p><p>SW아키텍쳐</p><p>의왕연구소</p>
          </div>
          <p class="date">2026-07-06 - 2026-07-20 10:00</p>
        </a>
        <a href="/jobs-view?seq=3905" class="job-item">
          <div class="info-wrap01">
            <p class="career">경력-연구직</p>
            <p class="integrated">[로보틱스사업실] 26년 7월 연구직 경력채용</p>
          </div>
          <p class="tit">로봇 액추에이터 제어기 회로 설계</p>
          <div class="info-wrap02">
            <p>로보틱스사업실</p><p>HW</p><p>회로설계</p><p>의왕연구소</p>
          </div>
          <p class="date">2026-07-06 - 2026-07-20 10:00</p>
        </a>
      </div>
    </main>
    """

    openings = parse_hyundai_mobis_listing_openings(
        html,
        "https://careers.mobis.com/jobs",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "3904"
    assert opening.url == "https://careers.mobis.com/jobs-view?seq=3904"
    assert opening.title == "로봇 핸즈 시스템 설계 (SW Architecture 설계)"
    assert opening.career_type == "experienced"
    assert opening.location == "의왕연구소"
    assert opening.opens_at is not None
    assert opening.closes_at is not None
    assert opening.closes_at.hour == 10


def test_detail_keeps_requirements_but_removes_dictionary_popups() -> None:
    html = """
    <main>
      <div class="view-top">
        <div class="view-info01">
          <p class="career">경력-연구직</p>
          <p class="integrated">[로보틱스사업실] 26년 7월 연구직 경력채용</p>
        </div>
        <p id="viewTit" class="tit">로봇 핸즈 시스템 설계 (SW Architecture 설계)</p>
        <div class="view-info02">
          <p>로보틱스사업실</p><p>SW/로직</p><p>SW아키텍쳐</p><p>의왕연구소</p>
        </div>
        <p class="date">2026-07-06 - 2026-07-20 10:00</p>
      </div>
      <div class="view-cont">
        <div class="paragraph">
          <p class="tit job">직무상세</p>
          <div class="sentence">
            MCU/<div class="dict"><button>RTOS</button><div class="dict-wrap">
              <p class="title">현대모비스 용어사전</p><p class="desc">실시간 운영체제 설명</p>
            </div></div> 기반 실시간 제어 SW 아키텍처 설계, 센서 피드백과 통신 로직 설계
          </div>
        </div>
        <div class="paragraph">
          <p class="tit qualify">지원자격</p>
          <div class="sentence">유관 업무 5년 이상 경력자 (석사의 경우 3년 이상)</div>
        </div>
        <div class="paragraph">
          <p class="tit special">우대사항</p>
          <div class="sentence">ROS/ROS2, Matlab Simulink, Ethernet 기반 로봇 SW 개발 경험</div>
        </div>
        <div class="paragraph">
          <p class="tit keyword">키워드</p>
          <ul class="keyword-wrap"><li>#로보틱스</li><li>#소프트웨어</li></ul>
        </div>
      </div>
    </main>
    """

    opening = parse_hyundai_mobis_detail_opening(
        html,
        "https://careers.mobis.com/jobs-view?seq=3904",
    )

    assert opening.external_id == "3904"
    assert opening.title == "로봇 핸즈 시스템 설계 (SW Architecture 설계)"
    assert opening.career_type == "experienced"
    assert opening.career_min == 5
    assert opening.location == "의왕연구소"
    assert "RTOS" in opening.description_text
    assert "ROS2" in opening.description_text
    assert "Ethernet" in opening.description_text
    assert "현대모비스 용어사전" not in opening.description_text
    assert "실시간 운영체제 설명" not in opening.description_text
