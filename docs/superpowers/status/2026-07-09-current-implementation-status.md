# 이직핏 현재 구현 현황

작성일: 2026-07-09

이 문서는 기존 스펙과 계획서를 대체하지 않는다. 여러 계획서에 흩어진 내용을 코드 기준으로 다시 묶은 현재 상태표다.

## 기준 문서

- `docs/superpowers/specs/2026-07-03-ejik-fit-design.md`: 전체 제품 방향과 로드맵
- `docs/superpowers/specs/2026-07-08-ejikfit-brand-dashboard-redesign-design.md`: 브랜드/홈 대시보드 방향
- `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`: 공식 기업 채용 소스 확장 전략
- `docs/superpowers/plans/2026-07-09-official-company-source-expansion.md`: 네이버/카카오/LINE 1차 소스 확장 구현 계획
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

- 기존 Greeting 15개 소스가 `INITIAL_SOURCE_CATALOG`에 포함되어 있다.
- 네이버 공식 채용 JSON 소스가 추가되어 있다.
- 카카오 공식 채용 JSON 소스가 추가되어 있다.
- LINE Careers Gatsby page-data 소스가 추가되어 있다.
- `SourceType.NAVER_JSON`, `SourceType.KAKAO_JSON`, `SourceType.LINE_GATSBY`가 모델과 마이그레이션에 추가되어 있다.
- 각 커넥터 테스트가 있다.
- crawler가 세 커넥터 타입을 라우팅한다.
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

- 현재는 코드의 `INITIAL_SOURCE_CATALOG`와 `Company`/`CareerSource` 모델을 사용한다.
- 설계서의 운영 레지스트리 필드인 `brand_tier`, `sector`, `connector_family`, `policy_status`, `tech_job_priority`, `expected_job_volume`, `last_error_reason` 등은 아직 별도 DB 필드로 구현되지 않았다.
- 출처 상태는 현재 `allowed`, `review`, `stopped` 수준이다. 설계서의 `needs_connector`, `needs_browser`, `blocked` 상태는 아직 모델에 없다.

### 수집 규모

- 네이버, 카카오, LINE, Greeting 15개까지 1차 확장 기반은 들어왔다.
- 삼성전자, 현대자동차, LG, SK, 넥슨, 엔씨소프트, 토스 계열 등 2단계 이후 기업은 아직 조사/분류/커넥터 구현이 남아 있다.
- 100개 이상 후보 목록은 스펙에 있지만 운영 카탈로그로 등록된 상태는 아니다.

### 브라우저 기반 수집

- CloakBrowser/Playwright 기반 공개 렌더러는 아직 구현되지 않았다.
- 허용 범위는 공개 JS 렌더링과 공개 네트워크 응답 발견으로 제한되어 있다.
- CAPTCHA 풀이, 로그인 우회, Cloudflare/봇 차단 우회는 계속 비목표다.

### 사용자 기능

- 내 스택은 localStorage와 URL 중심이다.
- 사용자 계정, 서버 저장, 알림 설정, 관심 기업/직무 저장은 아직 구현되지 않았다.
- 좌측 메뉴의 `기업 분석`, `채용 달력`, `알림`, `설정`은 실제 기능보다 내비게이션 골격에 가깝다.

## 남은 주요 구현

### 1. 소스 카탈로그를 운영 가능한 레지스트리로 확장

- `CareerSource` 또는 별도 registry에 source status, policy status, connector family, sector, priority score 필드를 추가한다.
- 상태값에 `needs_connector`, `needs_browser`, `blocked`를 추가한다.
- 출처별 최근 성공/실패, 실패 사유, 기술 직무 비율을 기록한다.

### 2. 대기업/제조/통신 소스 조사와 커넥터 분류

- 삼성전자, 삼성SDS, 현대자동차, 기아, LG전자, LG CNS, SK하이닉스, SK텔레콤, KT, 포스코DX, CJ올리브네트웍스, 한화시스템을 우선 조사한다.
- 공개 JSON/API면 `enterprise_json`, 정적 HTML이면 `html_listing_detail`, JS 렌더링 필요면 `needs_browser`로 분류한다.
- 12개 이상 등록, 6개 이상 allowed 수집을 2단계 완료 기준으로 둔다.

### 3. 게임/콘텐츠, 핀테크/금융, AI/SaaS 단계 확장

- 넥슨, 엔씨소프트, 넷마블, 크래프톤 등 게임사 후보를 조사한다.
- 토스 계열, 카카오뱅크, 두나무, 은행/증권/카드 IT 조직을 조사한다.
- Greeting, Ninehire, Lever, Greenhouse, Next/Notion/Super 유형을 커넥터 패밀리로 묶는다.

### 4. 수집 운영 관측

- GitHub Actions summary와 CLI에 회사별 open count, 신규/변경/마감 수, 실패 원인을 더 자세히 출력한다.
- 장기적으로 관리자 화면 또는 운영 리포트에서 source status 분포를 확인한다.

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

1. 공식 소스 카탈로그 상태값과 운영 필드를 먼저 추가한다.
2. 삼성전자/현대자동차/LG/SK/KT 등 2단계 기업 12개를 조사해 `allowed`, `needs_connector`, `needs_browser`, `blocked`로 분류한다.
3. 분류 결과 중 공개 JSON/API가 있는 2-3개를 커넥터로 구현한다.
4. crawler summary에 회사별 성공/실패/신규/변경/마감 수를 더 선명하게 출력한다.
5. 홈 대시보드가 운영 집계 데이터를 더 직접적으로 쓰도록 연결한다.

## 마지막 확인

- 최신 푸시 커밋: `6b810da feat: refine dashboard stack UX`
- 현재 작업트리에서 추적되지 않은 로컬 항목: `.agents/`
