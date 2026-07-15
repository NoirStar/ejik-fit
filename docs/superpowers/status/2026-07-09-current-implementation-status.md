# 이직핏 현재 구현 현황

작성일: 2026-07-09

이 문서는 기존 스펙과 계획서를 대체하지 않는다. 여러 계획서에 흩어진 내용을 코드 기준으로 다시 묶은 현재 상태표다.

## 기준 문서

- `docs/superpowers/specs/2026-07-03-ejik-fit-design.md`: 전체 제품 방향과 로드맵
- `docs/superpowers/specs/2026-07-08-ejikfit-brand-dashboard-redesign-design.md`: 브랜드/홈 대시보드 방향
- `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`: 공식 기업 채용 소스 확장 전략
- `docs/superpowers/plans/2026-07-09-official-company-source-expansion.md`: 네이버/카카오/LINE 1차 소스 확장 구현 계획
- `docs/superpowers/plans/2026-07-09-browser-public-render.md`: 공개 JS 렌더링 출처 수집 구현 계획
- `docs/superpowers/plans/2026-07-09-dashboard-hero-dedupe-dark-tone.md`: 홈 대시보드 중복 제거와 다크 톤 개선 계획

주의: 일부 계획서의 체크박스는 실제 커밋 이후 갱신되지 않았다. 다음 구현 판단은 이 문서와 현재 코드 상태를 함께 본다.

## 완료됨

### 기반과 배포

- Next.js 웹 앱과 FastAPI/SQLAlchemy 백엔드 패키지 구조가 있다.
- Vercel 설정 파일이 웹과 백엔드에 있다.
- GitHub Actions `ci.yml`, `crawl.yml` 워크플로가 있다.
- Supabase/Vercel 운영 배포 설계 문서가 있다.

### 채용 데이터 수집 기반

- `Company`, `CareerSource`, `JobPosting`, `JobRevision`, `RawSnapshot`, `PostingSkill` 모델이 있다.
- Greeting 공식 채용 페이지 수집 경로가 있다.
- JSON-LD 기반 `JobPosting` 파서가 있다.
- 중복 공고 저장, revision 저장, missing run 기반 마감 처리 정책이 있다.
- 공고 검색과 상세 조회 API/화면이 있다.

### 1차 공식 기업 소스 확장

- 기존 Greeting 16개 소스가 `INITIAL_SOURCE_CATALOG`에 포함되어 있다.
- 네이버 공식 채용 JSON 소스가 추가되어 있다.
- 카카오 공식 채용 JSON 소스가 추가되어 있다.
- LINE Careers Gatsby page-data 소스가 추가되어 있다.
- `naver_json`, `kakao_json`, `line_gatsby` 커넥터 테스트가 있다.
- crawler가 세 커넥터 타입을 라우팅한다.

### 운영 레지스트리와 소스 상태

- `CareerSource`에 source status, policy status, connector family, sector, priority 점수 필드가 있다.
- `SourceStatus`에 `allowed`, `needs_connector`, `needs_browser`, `review`, `blocked`, `stopped`가 있다.
- `PolicyStatus`에 `allowed`, `review`, `blocked`, `stopped`가 있다.
- `last_discovered_at`, `last_verified_at`, `last_success_at`, `last_error_code`, `last_error_reason`을 기록한다.
- `source-report` CLI가 전체 상태 분포, 우선순위, 오류 출처를 JSON/Markdown으로 출력한다.
- `source-monitor` CLI가 최근 신규/변경/마감 수와 출처별 건강도를 JSON/Markdown으로 출력한다.
- `crawl-all` GitHub Actions summary에 crawl 결과, source report, source monitor가 함께 기록된다.

### 추가 커넥터와 발견 도구

- `html_listing_detail`, `static_next_data`, `enterprise_json` 커넥터가 있다.
- `lever_greenhouse`, `workday`, `sap_successfactors` 커넥터가 있다.
- `sitemap_discovery` 커넥터와 `discover-sitemap` CLI가 있다.
- `browser_public_render` 커넥터가 렌더된 HTML을 JSON-LD, Next data, HTML listing 파서로 재사용한다.
- `PlaywrightBrowserRenderer`가 공개 JS 렌더링 페이지를 렌더링하고, CAPTCHA/접근 통제는 차단 상태로 표면화한다.
- backend `browser` extra와 production crawler workflow의 Chromium 설치 경로가 있다.
- 각 커넥터 테스트가 있다.
- crawler가 구현된 커넥터 타입을 라우팅한다.
- `run_all_sources()` summary에 회사/소스 라벨을 포함하는 테스트가 있다.

### 기술 추출과 기술 그래프

- 기술 카탈로그와 alias 기반 스킬 추출기가 있다.
- 필수/우대/불명확 근거를 다루는 `PostingSkill` 확장 필드가 있다.
- `/skills/graph` 화면과 그래프 데이터/fit API가 있다.
- 대규모 그래프 렌더링을 위한 LOD, artifact, force/canvas 관련 테스트가 있다.

### 홈 대시보드와 브랜드

- `EJIK FIT` 브랜드 마크, favicon, app icon이 있다.
- 홈은 채용시장 대시보드 형태로 구현되어 있다.
- 검색어, 지역, 경력, 기간 필터가 URL 상태와 연결되어 있다.
- 내 스택은 URL/localStorage 기반으로 저장된다.
- 히어로의 중복 KPI 카드가 제거되었다.
- 전체 스택 칩과 추가/삭제 UI는 왼쪽 `내 스택 요약` 패널로 이동했다.
- 다크/라이트 모드가 유지된다.
- 최신 대시보드 변경은 브라우저 데스크톱/모바일 확인 후 `main`에 푸시되어 있다.

## 부분 구현됨

### 공식 기업 카탈로그

- 현재는 코드의 `INITIAL_SOURCE_CATALOG`를 seed registry로 사용하고, 실제 운영 상태는 `Company`/`CareerSource` 테이블에 저장한다.
- 현재 카탈로그는 42개 출처이며 `allowed` 35개, `needs_browser` 4개, `needs_connector` 3개다.
- 대기업/제조/통신 출처의 공식 목록 API와 공개 렌더링 커넥터를 실제 미리보기로 점검해 다수를 `allowed`로 승격했다.
- 별도 관리자 화면이나 DB 기반 카탈로그 편집 UI는 아직 없다.
- 100개 이상 후보 전체가 운영 카탈로그로 등록된 상태는 아니다.

### 수집 규모

- 네이버, 카카오, LINE, Greeting 16개와 검증된 기업 공식 출처를 합쳐 35개가 `allowed` 상태다.
- 네이버, 삼성전자, 현대자동차, LG CNS, 크래프톤, SK텔레콤, KT, 포스코DX, CJ올리브네트웍스, 한화시스템, 스마일게이트, 기아, 카카오게임즈 등은 2026-07-15 공개 응답 미리보기를 확인했다.
- 게임/콘텐츠, 핀테크/금융, AI/SaaS 후보는 스펙에 있지만 대부분 아직 운영 카탈로그에 없다.

### 브라우저 기반 수집

- Playwright 기반 공개 렌더러와 `browser_public_render` crawler route가 구현되어 있다.
- 기본 테스트/개발 설치는 브라우저 의존성을 포함하지 않고, `packages/backend[browser]` extra로 명시 설치한다.
- production crawler workflow는 browser extra와 Chromium을 설치한다.
- 허용 범위는 공개 JS 렌더링 결과 읽기로 제한되어 있다.
- CAPTCHA 풀이, 로그인 우회, Cloudflare/봇 차단 우회는 계속 비목표다.

### 사용자 기능

- 내 스택은 localStorage와 URL 중심이다.
- 사용자 계정, 서버 저장, 알림 설정, 관심 기업/직무 저장은 아직 구현되지 않았다.
- 좌측 메뉴의 `기업 분석`, `채용 달력`, `알림`, `설정`은 실제 기능보다 내비게이션 골격에 가깝다.

## 남은 주요 구현

### 1. 소스 카탈로그를 운영 가능한 레지스트리로 확장

- DB seed가 아닌 운영 UI 또는 관리 API로 source catalog를 편집할 수 있게 한다.
- 100개 이상 후보 회사를 실제 `CareerSource`로 확장한다.
- 출처별 기술 직무 비율과 비기술 노이즈 점수를 수집 결과에서 자동 보정한다.

### 2. 대기업/제조/통신 소스 조사와 커넥터 분류

- 남은 `needs_browser` 4개와 `needs_connector` 3개 출처를 공개 범위 안에서 추가 조사한다.
- preview 결과가 정상인 출처만 `allowed`로 승격한다.
- 구조가 맞지 않는 출처는 connector 설정 또는 전용 파서 테스트를 추가한다.
- 정책 상태와 목록 완전성 검증을 통과한 출처만 전체 수집 대상에 포함한다.

### 3. 게임/콘텐츠, 핀테크/금융, AI/SaaS 단계 확장

- 넥슨, 엔씨소프트, 넷마블, 크래프톤 등 게임사 후보를 조사한다.
- 토스 계열, 카카오뱅크, 두나무, 은행/증권/카드 IT 조직을 조사한다.
- Greeting, Ninehire, Lever, Greenhouse, Next/Notion/Super 유형을 커넥터 패밀리로 묶는다.

### 4. 수집 운영 관측

- GitHub Actions summary와 CLI에 기본 source report/source monitor는 들어왔다.
- 다음 단계는 회사별 open count, 기술 직무 비율, 평균 수집 시간, 실패 재시도 수를 더 자세히 출력하는 것이다.
- 장기적으로 관리자 화면에서 source status 분포와 개별 오류 이력을 확인한다.

### 5. 실제 사용자 기능

- 내 스택 서버 저장과 로그인/사용자 프로필을 구현한다.
- 공고 탐색 전용 페이지를 만든다.
- 관심 기업, 관심 직무, 알림 조건을 저장한다.
- 채용 달력과 기업 분석 페이지를 실제 데이터와 연결한다.

### 6. 데이터 품질과 화면 신뢰도

- 유명 회사와 다양한 직무가 충분히 들어오도록 수집량을 늘린다.
- 비기술 공고 비중이 높은 출처는 홈 대시보드 우선순위를 낮춘다.
- 홈 KPI와 그래프가 fixture 느낌이 아니라 운영 DB 집계에서 나오도록 연결 범위를 넓힌다.

## 다음 작업 추천 순서

1. 남은 7개 비허용 출처를 `preview-sources`로 점검한다.
2. 실패 출처는 `last_error_code`와 preview 결과를 기준으로 connector 설정/파서 fixture를 추가한다.
3. 게임/콘텐츠, 핀테크/금융, AI/SaaS 후보를 운영 카탈로그에 추가한다.
4. 홈 대시보드가 운영 집계 데이터를 더 직접적으로 쓰도록 연결한다.

## 마지막 확인

- 이 문서는 브라우저 렌더러 런타임 준비성 반영 이후의 feature worktree 상태를 기준으로 갱신했다.
- 문서 갱신 직전 코드 변경 사항은 모두 커밋되어 있었다.
