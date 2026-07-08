# 공식 기업 채용 소스 확장 설계

## 목적

이직핏은 한국 IT 커리어 시장을 신뢰할 수 있게 보여줘야 한다. 현재는 일부 Greeting 기반 회사와 제한된 공고에 의존하고 있어, 사용자가 기대하는 네이버, 카카오, 삼성전자, 현대자동차, LG, SK, 게임사, 핀테크, AI 스타트업의 기술 채용 흐름을 충분히 보여주지 못한다.

이번 설계의 목적은 회사별 임시 크롤러를 계속 추가하는 것이 아니라, 공식 채용 출처를 계속 확장할 수 있는 카탈로그와 커넥터 체계를 만드는 것이다.

## 제품 원칙

1. 최대한 많은 공식 공고를 수집한다.
2. 검색 포털, 채용 포털, 커뮤니티는 발견 보조 수단으로만 사용하고, 실제 저장 데이터는 회사 공식 채용 출처를 우선한다.
3. 회사별 하드코딩보다 채용 플랫폼/페이지 구조별 커넥터를 재사용한다.
4. 공고 수만 늘리지 않고 기술 직무 신호가 강한 소스를 우선한다.
5. 차단, CAPTCHA, 로그인, 권한 오류는 숨기지 않고 출처 상태로 기록한다.

## 접근 통제와 CloakBrowser 기준

기존 2026-07-03 설계는 `로그인, 인증, CAPTCHA 또는 접근 통제 우회`를 비목표로 두고, CloakBrowser를 기본 의존성과 수집 경로에서 제외했다. 이 원칙은 유지한다.

다만 수집량 확대 단계에서는 일반 HTTP만으로 공개 JavaScript 렌더링 페이지를 읽기 어려운 경우가 많다. 따라서 브라우저 기반 수집기는 다음 용도로만 도입할 수 있다.

- 허용: 공개 페이지의 JavaScript 렌더링 결과를 읽기 위한 Playwright 또는 CloakBrowser 기반 렌더러
- 허용: 공개 네트워크 응답을 관찰해 공식 JSON/API 엔드포인트를 찾아 커넥터화
- 허용: 무한 스크롤, 클라이언트 라우팅, 정적 빌드 데이터 추출
- 금지: CAPTCHA 풀이, 로그인 우회, Cloudflare/봇 차단 우회, 세션 위장, 이용약관상 금지된 대량 수집
- 처리: CAPTCHA/보안 검사/인증 화면이 감지되면 해당 소스는 `review` 또는 `blocked`로 기록하고 대체 공식 출처를 탐색한다.

이 기준은 상업용 여부와 무관하게 적용한다. 지금은 제품 검증 단계이므로 더더욱 삭제 요청, 차단, 과도한 요청에 대응 가능한 보수적 기본값을 둔다.

## 회사 소스 카탈로그

새 카탈로그는 코드 안의 튜플이 아니라 데이터베이스에 저장되는 운영 레지스트리가 된다.

필드:

```text
company_slug
company_name
aliases
brand_tier
sector
career_url
homepage_url
source_type
connector_family
source_status
policy_status
tech_job_priority
expected_job_volume
last_discovered_at
last_success_at
last_error_code
last_error_reason
notes
```

상태:

- `allowed`: 공식 공개 출처이며 현재 커넥터로 수집 가능
- `needs_connector`: 공식 출처는 확인됐지만 커넥터가 없음
- `needs_browser`: 공개 페이지지만 JavaScript 렌더링이 필요
- `review`: 정책, 품질, 중복, 비기술 공고 비중 검토 필요
- `blocked`: CAPTCHA, 로그인, 접근 통제, 명시적 차단
- `stopped`: 수집 중단 요청 또는 장기 장애로 비활성화

우선순위 점수:

```text
priority_score =
  brand_tier_weight
+ tech_job_priority
+ expected_job_volume
+ connector_reuse_score
- policy_risk
- non_tech_noise
```

## 커넥터 패밀리

현재 구현:

- `greeting`: Greeting 채용 페이지
- `json_ld`: Schema.org `JobPosting`

1차로 추가할 커넥터:

- `naver_json`: 네이버 공식 채용 `loadJobList.do` JSON 목록
- `kakao_json`: 카카오 공식 채용 `public/api/job-list` JSON 목록
- `line_gatsby`: LINE Careers Gatsby `page-data/jobs/page-data.json`

2차로 추가할 커넥터:

- `enterprise_json`: 대기업 자체 채용 사이트의 공개 JSON 응답
- `static_next_data`: Next.js `__NEXT_DATA__` 또는 정적 JSON 데이터
- `workday`: Workday 기반 글로벌/대기업 채용 페이지
- `sap_successfactors`: SAP SuccessFactors 기반 대기업 채용 페이지
- `lever_greenhouse`: 해외 ATS를 쓰는 국내/글로벌 기업
- `html_listing_detail`: 정적 목록과 상세 HTML

3차로 추가할 커넥터:

- `browser_public_render`: 공개 JS 렌더링 전용 브라우저 수집
- `sitemap_discovery`: sitemap, robots, RSS, 정적 route manifest 기반 발견
- `source_monitor`: 출처별 수집 성공률, 차단 감지, 구조 변경 감지

## 100개 이상 후보 카탈로그 1차

이 목록은 한 번에 모두 수집한다는 뜻이 아니다. 공식 URL과 커넥터 가능성을 검증하면서 `allowed`, `needs_connector`, `needs_browser`, `review`, `blocked`로 나눠 단계적으로 활성화한다.

### 플랫폼/빅테크

1. 네이버
2. 네이버웹툰
3. 네이버클라우드
4. 네이버랩스
5. 카카오
6. 카카오페이
7. 카카오뱅크
8. 카카오모빌리티
9. 카카오엔터프라이즈
10. LINE Plus
11. LINE Pay Plus
12. LINE NEXT
13. 토스
14. 토스뱅크
15. 토스페이먼츠
16. 당근
17. 우아한형제들
18. 쿠팡
19. 쿠팡페이
20. 컬리
21. 무신사
22. 29CM
23. 야놀자
24. 여기어때
25. 쏘카
26. 티맵모빌리티
27. 리디
28. 왓챠
29. 웨이브
30. 하이퍼커넥트

### 대기업/제조/통신 IT

31. 삼성전자
32. 삼성SDS
33. 삼성디스플레이
34. 삼성SDI
35. 삼성전기
36. 현대자동차
37. 기아
38. 현대모비스
39. 현대오토에버
40. HD현대
41. LG전자
42. LG CNS
43. LG유플러스
44. LG에너지솔루션
45. LG이노텍
46. SK하이닉스
47. SK텔레콤
48. SK C&C
49. SK스퀘어
50. KT
51. KT DS
52. 포스코DX
53. 롯데이노베이트
54. CJ올리브네트웍스
55. 한화시스템
56. 두산디지털이노베이션
57. GS ITM
58. LS ITC
59. 효성ITX
60. 코오롱베니트

### 게임/콘텐츠

61. 넥슨
62. 엔씨소프트
63. 넷마블
64. 크래프톤
65. 스마일게이트
66. 펄어비스
67. 네오위즈
68. 카카오게임즈
69. 위메이드
70. 컴투스
71. 데브시스터즈
72. 시프트업
73. NHN
74. 웹젠
75. 라인게임즈

### 금융/핀테크/증권 IT

76. KB국민은행
77. 신한은행
78. 하나은행
79. 우리은행
80. NH농협은행
81. 신한DS
82. 우리FIS
83. KB증권
84. 미래에셋증권
85. 키움증권
86. 한국투자증권
87. 현대카드
88. BC카드
89. 삼성카드
90. 두나무
91. 빗썸
92. 코빗
93. 넥스트증권

### AI/보안/SaaS/스타트업

94. 업스테이지
95. 리벨리온
96. 퓨리오사AI
97. 마키나락스
98. 루닛
99. 보이저엑스
100. S2W
101. 몰로코
102. 채널코퍼레이션
103. 센드버드
104. 원티드랩
105. 뤼이드
106. 매스프레소
107. 클래스101
108. 클라썸
109. 딥오토
110. 노타AI
111. 가우디오랩
112. 스캐터랩
113. 뤼튼
114. 슈퍼브에이아이
115. 베스핀글로벌
116. 메가존클라우드
117. 오케스트로
118. NHN Cloud
119. 플래티어
120. 래블업

## 수집 단계

### 1단계: 즉시 수확

대상:

- 네이버
- 카카오
- LINE
- 기존 Greeting 소스

작업:

- `naver_json`, `kakao_json`, `line_gatsby` 커넥터 구현
- 회사 소스 카탈로그 모델 추가
- 기존 `INITIAL_GREETING_SOURCES`를 카탈로그 기반 시드로 이관
- 운영 크롤러 요약에 회사별 발견/인입/실패 수 표시

완료 기준:

- 네이버, 카카오, LINE 공식 공고가 운영 API `/api/postings`에 노출된다.
- 각 커넥터가 fixture 테스트와 live smoke check를 통과한다.
- 실패한 출처가 기존 정상 공고를 잘못 마감하지 않는다.

### 2단계: 대기업/제조/통신

대상:

- 삼성전자, 삼성SDS, 현대자동차, 기아, LG전자, LG CNS, SK하이닉스, SK텔레콤, KT, 포스코DX, CJ올리브네트웍스, 한화시스템

작업:

- 공식 채용 URL과 네트워크 응답 조사
- 공개 JSON/API가 있으면 `enterprise_json`
- 정적 HTML이면 `html_listing_detail`
- JS 렌더링만 가능하면 `needs_browser`
- CAPTCHA/로그인/차단이면 `blocked` 또는 `review`

완료 기준:

- 최소 12개 대기업 출처가 카탈로그에 등록된다.
- 이 중 6개 이상이 `allowed`로 수집된다.

### 3단계: 게임/콘텐츠

대상:

- 넥슨, 엔씨소프트, 넷마블, 크래프톤, 스마일게이트, 펄어비스, 네오위즈, 카카오게임즈, 위메이드, 컴투스, 데브시스터즈, 시프트업

작업:

- Cloudflare/CAPTCHA 여부 확인
- 가능한 경우 정적/JSON/API 커넥터화
- 차단형 사이트는 대체 공식 채용 출처 또는 공개 ATS 페이지를 탐색

완료 기준:

- 게임/콘텐츠 후보 12개 이상이 카탈로그에 등록된다.
- 기술 직무 공고가 있는 allowed 소스 5개 이상 확보된다.

### 4단계: 핀테크/금융 IT

대상:

- 토스 계열, 카카오뱅크, 두나무, 빗썸, 코빗, 주요 은행/증권/카드 IT 조직

작업:

- 공개 ATS/공식 채용 페이지 우선 조사
- 금융권 대형 채용 시스템은 경력 IT 공고가 페이지 내부에 묻혀 있으므로 검색/필터 파라미터를 커넥터 설정으로 분리

완료 기준:

- 금융/핀테크 출처 15개 이상 등록
- 기술 직무 공고가 있는 allowed 소스 7개 이상 확보

### 5단계: 스타트업/AI/SaaS

대상:

- AI, 보안, B2B SaaS, 클라우드, 데이터 인프라 기업

작업:

- Greeting, Ninehire, Lever, Greenhouse, 자체 Notion/Super/Next 페이지 유형을 묶어 커넥터 재사용
- 비기술 채용만 많은 회사는 `review`로 유지

완료 기준:

- 스타트업/AI/SaaS 출처 30개 이상 등록
- allowed 소스 20개 이상 확보

## 데이터 품질 규칙

- 회사명과 계열사명을 분리 저장한다.
- 같은 공고가 그룹 채용 사이트와 계열사 채용 사이트에 동시에 있으면 canonical URL 기준으로 중복 제거한다.
- 기술 직무 판정은 제목, 직군, 설명, 스킬 추출 결과를 함께 본다.
- 비기술 공고만 많은 회사는 홈 대시보드에서 낮은 우선순위로 내려보낸다.
- 마감 판정은 기존 정책처럼 한 번의 실패로 처리하지 않는다.
- 원문 링크를 항상 유지하고, 이직핏은 원문 전체 대체물이 되지 않는다.

## 운영 관측

수집량이 늘어나면 공고가 “많아 보이는지”보다 출처가 건강한지 보는 기능이 필요하다.

운영 지표:

- 회사별 open posting count
- 기술 직무 비율
- 최근 24시간 신규/변경/마감 수
- connector별 성공률
- source status 분포
- blocked/review 원인 TOP
- 평균 수집 시간과 실패 재시도 수

관리 화면은 추후 기능으로 둔다. 우선 GitHub Actions summary와 CLI 출력에 회사별 요약을 추가한다.

## 구현 우선순위

1. 회사 소스 카탈로그 모델과 시드 구조
2. `naver_json` 커넥터
3. `kakao_json` 커넥터
4. `line_gatsby` 커넥터
5. 기존 Greeting 시드의 카탈로그 이관
6. 운영 크롤러 summary 개선
7. 대기업 2단계 출처 조사와 커넥터 분류
8. 브라우저 공개 렌더러 검토

## 명확한 비목표

- CAPTCHA 자동 풀이
- 로그인 세션 확보 또는 계정 기반 수집
- 접근 통제 우회
- 공식 원문 전체를 대체하는 상세 페이지 제공
- 회사별로 유지보수 불가능한 일회성 스크래퍼 100개 작성

## 성공 기준

첫 확장 완료 시점:

- 네이버, 카카오, LINE 공식 공고가 운영 DB와 API에 반영된다.
- 기존 Greeting 포함 20개 이상 공식 출처가 활성 상태다.
- 전체 open posting count가 유의미하게 증가한다.
- 실패/차단 소스가 숨겨지지 않고 상태로 남는다.

중기 성공 기준:

- 100개 이상 후보 회사가 카탈로그에 존재한다.
- 50개 이상 공식 출처가 allowed 또는 needs_connector로 분류된다.
- 30개 이상 공식 출처에서 정기 수집이 성공한다.
- 대기업/빅테크/게임/핀테크/AI 스타트업이 모두 대시보드 데이터에 섞인다.
