from ejikfit.connectors.html_listing import parse_html_listing_openings


def test_parse_html_listing_openings_maps_static_job_cards() -> None:
    html = """
    <main>
      <article class="job-card">
        <a href="/jobs/backend-1">Backend Engineer</a>
        <p>정규직 · 경력 · 서울</p>
        <span>2026.07.01 ~ 2026.07.31</span>
      </article>
      <article class="job-card">
        <a href="/jobs/backend-1">Backend Engineer</a>
        <p>Duplicate link should be ignored</p>
      </article>
      <article class="job-card">
        <a href="/culture">Culture</a>
      </article>
      <article class="job-card">
        <a href="https://example.com/jobs/data-2">Data Platform Engineer</a>
        <p>계약직 · 신입 · 판교</p>
        <time datetime="2026-08-15">마감</time>
      </article>
    </main>
    """

    openings = parse_html_listing_openings(html, "https://example.com/careers")

    assert [opening.external_id for opening in openings] == [
        "backend-1",
        "data-2",
    ]
    first = openings[0]
    assert first.url == "https://example.com/jobs/backend-1"
    assert first.title == "Backend Engineer"
    assert first.employment_type == "regular"
    assert first.career_type == "experienced"
    assert first.location == "서울"
    assert first.description_text == "Backend Engineer 정규직 · 경력 · 서울 2026.07.01 ~ 2026.07.31"
    assert first.opens_at is not None
    assert first.closes_at is not None

    second = openings[1]
    assert second.employment_type == "contract"
    assert second.career_type == "new_comer"
    assert second.location == "판교"
    assert second.closes_at is not None


def test_parse_html_listing_openings_uses_query_identifier_for_detail_urls() -> None:
    html = """
    <main>
      <article>
        <a href="/Company/Careers/detail?_jobOpeningNo=757">
          <p class="title">[경력] 네트워크 엔지니어 모집</p>
          <span>상시채용 경력 정규직 과천 IT 인프라</span>
        </a>
      </article>
      <article>
        <a href="/Company/Careers/detail?_jobOpeningNo=806">
          <p class="title">[경력] 정보보안 엔지니어 모집</p>
          <span>상시채용 경력 정규직 과천 정보보안</span>
        </a>
      </article>
    </main>
    """

    openings = parse_html_listing_openings(
        html,
        "https://www.pearlabyss.com/ko-KR/Company/Careers/List",
    )

    assert [opening.external_id for opening in openings] == ["757", "806"]
    assert [opening.title for opening in openings] == [
        "[경력] 네트워크 엔지니어 모집",
        "[경력] 정보보안 엔지니어 모집",
    ]
    assert [opening.url for opening in openings] == [
        "https://www.pearlabyss.com/Company/Careers/detail?_jobOpeningNo=757",
        "https://www.pearlabyss.com/Company/Careers/detail?_jobOpeningNo=806",
    ]


def test_parse_html_listing_openings_ignores_empty_and_navigation_links() -> None:
    html = """
    <nav>
      <a href="/recruit/process">Hiring Process</a>
      <a href="/about">About Us</a>
    </nav>
    <section>
      <a href="">Backend Engineer</a>
      <a href="#top">Top</a>
      <a href="mailto:recruit@example.com">Contact</a>
    </section>
    """

    assert parse_html_listing_openings(html, "https://example.com/careers") == []


def test_parse_html_listing_openings_ignores_career_navigation_and_intro_links() -> None:
    html = """
    <main>
      <a href="/recruit/job_notice">Job Openings</a>
      <a href="/life/career.kc">Career Career</a>
      <a href="/job/aboutKia.kc">About Kia About Kia</a>
      <a href="/recruit/recruit2.do">인사제도</a>
      <a href="https://www.skcareersjournal.com/">SK Careers Blog</a>
      <a href="https://www.youtube.com/@SKCareersYoutube">SK Careers Youtube</a>
      <article>
        <a href="/careers/featured_jobs/about_care_jobs.html?index=0">
          사업 개발 사업전략을 수립하고, 신규사업을 발굴·검토하는 업무를 수행하고 있어요. 더보기
        </a>
      </article>
      <article>
        <a href="/careers/featured_jobs/about_care_jobs.html?index=4">
          아키텍처 솔루션 개발 프로젝트에서 소프트웨어 개발전략 수립을 리딩하고 있습니다. 더보기
        </a>
      </article>
      <article>
        <a href="/careers/featured_jobs/about_care_jobs.html?index=6">
          인프라 DB/서버의 안전 및 효율성 증대를 위하여 최적화 및 개선 업무를 수행해요. 더보기
        </a>
      </article>
      <article>
        <a href="/jobs/backend-1">Backend Engineer</a>
      </article>
    </main>
    """

    openings = parse_html_listing_openings(html, "https://example.com/careers")

    assert len(openings) == 1
    assert openings[0].external_id == "backend-1"
    assert openings[0].title == "Backend Engineer"


def test_parse_html_listing_openings_maps_samsung_careers_fragment() -> None:
    html = """
    <input type="hidden" class="divCnt" data-value="1" data-max="1">
    <li>
      <div>
        <div>
          <div class="btnWrap">
            <button type="button" class="btnShare" data-value="22,590"></button>
          </div>
          <a href="/#none" data-value="22,590">
            <p class="company">삼성중공업</p>
            <h3 class="title">경력사원 채용(설계, 공정관리, 구매, SW개발)</h3>
            <p class="info">
              <span>경력</span>
              <span class="period">2026.07.02 ~ 2026.07.15</span>
            </p>
          </a>
        </div>
        <div class="flagWrap">
          <span class="flag blue">D- 6</span>
          <span class="flag grey">데이터센터 설계</span>
          <span class="flag grey">SW 개발</span>
        </div>
      </div>
    </li>
    """

    openings = parse_html_listing_openings(
        html,
        "https://www.samsungcareers.com/hr/list.data",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "22590"
    assert opening.url == "https://www.samsungcareers.com/hr/?no=22590"
    assert opening.title == "경력사원 채용(설계, 공정관리, 구매, SW개발)"
    assert opening.career_type == "experienced"
    assert opening.description_text == (
        "삼성중공업 경력사원 채용(설계, 공정관리, 구매, SW개발) "
        "경력 2026.07.02 ~ 2026.07.15 데이터센터 설계 SW 개발"
    )
    assert opening.opens_at is not None
    assert opening.opens_at.isoformat() == "2026-07-02T00:00:00+09:00"
    assert opening.closes_at is not None
    assert opening.closes_at.isoformat() == "2026-07-15T00:00:00+09:00"


def test_parse_html_listing_openings_accepts_samsung_careers_empty_state() -> None:
    html = """
    <input type="hidden" class="divCnt" data-value="0" data-max="0">
    <div class="noData">
      <p class="text1">현재 채용중인 공고가 없습니다.</p>
    </div>
    """

    assert (
        parse_html_listing_openings(
            html,
            "https://www.samsungcareers.com/hr/list.data",
        )
        == []
    )
