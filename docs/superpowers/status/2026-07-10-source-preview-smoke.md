# 2026-07-10 Source Preview Smoke

임시 SQLite DB에 `seed-sources`를 넣고 `preview-sources`로 2단계 후보를 확인했다. 이 작업은 운영 DB, 공고, 스냅샷, source status를 변경하지 않는다.

## 실행 환경

```bash
DATABASE_URL=sqlite+pysqlite:////tmp/ejikfit-preview.sqlite
ejikfit seed-sources
ejikfit preview-sources --status needs_connector --limit 12
ejikfit preview-sources --status needs_browser --source-type browser_public_render
ejikfit preview-source --company-slug sk-hynix
ejikfit preview-source --company-slug samsung-electronics
ejikfit preview-source --company-slug samsung-sds
ejikfit preview-source --company-slug posco-dx
ejikfit preview-source --company-slug sk-telecom
ejikfit preview-source --company-slug kt
ejikfit preview-source --company-slug hyundai-motor
ejikfit preview-source --company-slug kia
ejikfit preview-source --company-slug cj-olivenetworks
ejikfit preview-source --company-slug hanwha-systems
```

브라우저 렌더링 확인 전에는 로컬 `.venv`에 `packages/backend[dev,browser]`와 Playwright Chromium을 설치했다.

## needs_connector 결과

| Source | Type | Result |
| --- | --- | --- |
| LG CNS | `static_next_data` | `unsupported_connector`: static Next data payload is not valid JSON |
| LG전자 | `static_next_data` | `unsupported_connector`: static Next data payload is not valid JSON |
| 삼성SDS | `html_listing_detail` | `discovered=0` after false-positive filtering |
| 한화시스템 | `html_listing_detail` | `discovered=0` after false-positive filtering |

처음 실행에서는 삼성SDS 직무소개, SK Careers 블로그/유튜브, 기아/한화 채용 안내 링크가 공고처럼 잡혔다. `html_listing_detail`는 날짜 또는 직무 제목 신호가 있는 링크만 후보로 보도록 조정했고, `더보기` 직무소개 링크를 제외했다.

2026-07-10 한화시스템 승격 후 임시 DB에서 `preview-sources --status needs_connector --limit 12`를 재확인한 결과, 남은 항목은 삼성SDS 1개뿐이다.

2026-07-10 삼성SDS 승격 후 임시 DB에서 `preview-sources --status needs_connector --limit 12`를 재확인한 결과, 남은 항목은 없다.

## needs_browser 결과

| Source | Type | Result |
| --- | --- | --- |
| 삼성전자 | `browser_public_render` | `blocked`: source returned an access challenge |

처음 실행에서 SK하이닉스는 `Page.goto`의 `networkidle` 대기 때문에 20초 timeout이 발생했다. renderer를 `domcontentloaded` 필수 대기와 5초 best-effort `networkidle` settle로 바꾼 뒤 timeout은 사라졌다.

2026-07-10 Samsung Careers `hr/list.data` form POST endpoint를 확인한 뒤 삼성전자를 `html_listing_detail`로 승격했다. 임시 DB에서 `preview-sources --status blocked --limit 12`와 `preview-sources --status needs_browser --limit 12`를 재확인한 결과, 남은 항목은 없다.

## SK하이닉스 정적 공고 페이지 재분류

SK하이닉스 Talent Hub의 공식 공고 URL은 `https://talent.skhynix.com/hub/ko/apply/job`이다. 이 페이지는 공개 서버 렌더링 HTML로 내려오며, 현재 `7월 모집 중 공고` 영역에는 `곧 공개될 새로운 공고를 기대해 주세요.` 빈 상태가 포함되어 있다. Playwright 네트워크 관찰에서도 별도 공고 JSON/API 호출은 확인되지 않았다.

따라서 SK하이닉스는 `browser_public_render`가 아니라 `html_listing_detail`로 분류하고, 공식 공개 페이지를 오류 없이 확인할 수 있으므로 `allowed`로 승격한다. 현재 preview 결과는 정상적인 빈 상태인 `discovered=0`이다.

## 삼성전자 공식 HTML fragment 승격

Samsung Careers 루트 `https://www.samsungcareers.com/`는 브라우저에서 reCAPTCHA 스크립트를 함께 로드하지만, 공고 목록 자체는 공개 form POST endpoint `https://www.samsungcareers.com/hr/list.data`로 받을 수 있다. 채용공고 화면 `https://www.samsungcareers.com/hr/`은 `currentPageNo=1`, `strCompany`, `strType`, `strOrderBy` 등을 form-urlencoded로 전송한다.

관계사 소개 페이지 `https://www.samsungcareers.com/subsid/`에서 삼성전자 관계사 코드는 `삼성전자 DX부문=C10CAA`, `삼성전자 DS부문=C10CAH`로 확인했다. seed는 이 두 코드와 프론트의 상위 코드 전송 방식에 맞춰 `strCompany=["C10CAA","C10","C10CAH","C10"]` form body를 사용한다.

현재 해당 필터 응답은 공식 빈 상태 `현재 채용중인 공고가 없습니다.`이며, 임시 SQLite DB에서 `preview-source --company-slug samsung-electronics`를 실행한 결과 `discovered=0`, `error=null`이 확인됐다. 따라서 삼성전자는 `blocked`가 아니라 공식 빈 목록을 확인 가능한 `html_listing_detail` / `allowed` 소스로 분류한다.

## 삼성SDS 공식 HTML fragment 승격

삼성SDS 공식 채용 페이지 `https://www.samsungsds.com/kr/careers/overview/about_care_over.html`의 `지원하기` 버튼은 SDS 전용 공고 URL이 아니라 Samsung Careers `https://www.samsungcareers.com/` 루트로 연결된다. Samsung Careers 채용공고 화면 `https://www.samsungcareers.com/hr/`은 공개 form POST endpoint `https://www.samsungcareers.com/hr/list.data`를 호출한다.

관계사 소개 페이지에서 삼성SDS 코드는 `C60`으로 확인했다. 프론트는 관계사 선택 시 회사 코드를 그대로 한 번, 앞 3자리 코드를 한 번 더 보내지만, `strCompany=C60` 단독 POST도 정상 동작한다. seed는 이 endpoint를 `request_method=POST`, form body `currentPageNo=1`, `strCompany=C60`으로 호출한다.

응답은 JSON이 아니라 `<li>` 카드 HTML 조각이며, 각 카드에는 `data-value`, `.company`, `.title`, `.period`, `.flagWrap`가 포함된다. 상세 공유 URL은 프론트와 동일하게 `https://www.samsungcareers.com/hr/?no={data-value}`로 구성한다.

현재 `strCompany=C60` 응답은 공식 빈 상태 `현재 채용중인 공고가 없습니다.`이며, 임시 SQLite DB에서 `preview-source --company-slug samsung-sds`를 실행한 결과 `discovered=0`, `error=null`이 확인됐다.

## 포스코DX 공식 JSON API 승격

포스코DX 홈페이지의 공식 채용 링크는 `https://recruit.posco.com/`로 연결된다. 루트 페이지는 `/h22a01-front/`로 진입하고, 채용 공고 목록 화면 `H22A1000.html`은 `/h22a01-recruit/H22A1000/list` JSON API를 호출한다.

`/h22a01-recruit/H22A1000/init` 응답의 회사 목록에서 포스코DX 코드는 `SEARCH_COMP=01`로 확인했다. 따라서 seed는 `https://recruit.posco.com/h22a01-recruit/H22A1000/list?rowCount=20&pageSize=10&currPage=1&offset=0&SEARCH_TYPE=&SEARCH_ORDER=s1&SEARCH_KEYWORD=&SEARCH_COMP=01&SEARCH_VALUE=`를 `enterprise_json` / `allowed`로 사용한다.

임시 SQLite DB에서 `preview-source --company-slug posco-dx`를 실행한 결과 `discovered=5`, `error=null`이 확인됐다. 샘플에는 `(포항/광양) IT&AI 분야 경력사원 채용 [정규직]`, `기술연구 분야 신입/경력사원 채용 [정규직]` 등이 포함된다.

## SK텔레콤 공식 JSON API 승격

SK Careers의 `Recruit` 화면은 공개 POST endpoint `https://www.skcareers.com/Recruit/GetRecruitList`를 호출한다. 회사 자동완성 endpoint에서 SK telecom 코드는 `corpCode=10005`로 확인했다.

seed는 `request_method=POST`와 `request_body={"sort":"2","searchText":"","corpCode":"10005","jobRole":"0","recruitType":"","workingType":"","workingRegion":""}`를 사용한다. 이 endpoint는 JSON POST를 직접 받아주므로 별도 브라우저 렌더링이 필요 없다.

임시 SQLite DB에서 `preview-source --company-slug sk-telecom`을 실행한 결과 `discovered=8`, `error=null`이 확인됐다. 샘플에는 `SKT 뉴스룸 운영 지원 담당자`, `유선망 현황관리 및 사무지원 담당자`, `T우주 서비스 운영지원 및 정산 담당자` 등이 포함된다.

## KT 공식 JSON API 승격

KT 그룹 채용 화면은 Nuxt 앱이며 `https://recruit.kt.com/api/recruit?isPost=1&isInprogress=1&isContainsContents=0` JSON API를 직접 호출한다. 응답은 `data[]` 안에 `recruitNoticeSn`, `recruitNoticeName`, `recruitNoticeUrl`, `recruitClassName`, `receiveStartDatetime`, `receiveEndDatetime`, `company`, `recruitSectorList`를 포함한다.

seed는 이 endpoint를 `enterprise_json` / `allowed`로 사용한다. 임시 SQLite DB에서 `preview-source --company-slug kt`를 실행한 결과 `discovered=55`, `error=null`이 확인됐다. 샘플에는 `[KT] 2026년 경력채용 (AX기술연구 및 개발)`, `[KT] 2026년 KT 경력채용(네트워크 보안기술 연구개발)`, `[KT] 2026년 경력채용(데이터센터 네트워크 기술 연구)` 등이 포함된다.

## 현대자동차 공식 JSON API 승격

현대자동차 인재채용 Apply 화면은 공개 목록 API `https://talent.hyundai.com/api/rec/AP-HM-FO-02700?hgrCd=1&lang=en&page=1&pageblock=100&searchFieldList=&searchOccupList=&searchPlaceList=&searchSectorList=&searchText=&jdSec=&srcOrd=`를 호출한다. 응답은 `data.list[]` 안에 `recuYy`, `recuType`, `recuCls`, `recuNoticeNm`, `secCodeNm`, `fldCodeNm`, `workPlaceCodeNm`, `channelCodeNm`, `applyStartDt`, `applyEndDt`를 포함한다.

목록 카드 클릭 시 실제 상세 페이지는 `https://talent.hyundai.com/eng/apply/applyView.hc?recuYy={recuYy}&recuType={recuType}&recuCls={recuCls}`로 이동하는 것을 Playwright 네트워크 관찰로 확인했다. seed는 이 endpoint를 `enterprise_json` / `allowed`로 사용한다.

임시 SQLite DB에서 `preview-source --company-slug hyundai-motor`를 실행한 결과 `discovered=30`, `error=null`이 확인됐다. 샘플에는 `[Security] Service Security Engineer - Application Security`, `[Security] Information Security Inspection - Containers and Kubernetes Security`, `[ICT] Service Planner - Global Owner App` 등이 포함된다.

## 기아 공식 렌더 목록 승격

기아 Jobs 메인 `https://career.kia.com/job/jobs.kc`는 지역별 공고 수를 보여주고, 국내 본사 공고는 `https://career.kia.com/apply/applyList.kc`에서 렌더링된다. 일반 HTTP로 `AP-KM-FO-02700` API를 직접 호출하면 400 HTML이 반환되지만, 공개 페이지를 브라우저로 렌더링하면 목록 HTML 안에 `li.cont__box` 카드와 `data-recuyy`, `data-recutype`, `data-recucls`가 포함된다.

목록 카드 클릭 시 실제 상세 페이지는 `https://career.kia.com/apply/applyView.kc?recuYy={recuYy}&recuType={recuType}&recuCls={recuCls}`로 이동하는 것을 Playwright 네트워크 관찰로 확인했다. seed는 이 공개 렌더 페이지를 `browser_public_render` / `allowed`로 사용한다.

임시 SQLite DB에서 `preview-source --company-slug kia`를 실행한 결과 `discovered=3`, `error=null`이 확인됐다. 샘플에는 `[계약직] 기아 채용운영`, `[계약직] 렌터카사업 운영 지원`, `[계약직] AutoLand화성 의전 지원 및 차량 관리 업무`가 포함된다.

## CJ올리브네트웍스 공식 JSONP API 승격

CJ올리브네트웍스 공식 홈페이지 `job_notice` 페이지는 `/js/recruit.js`를 통해 CJ Group 채용 JSONP endpoint `https://recruit.cj.net/recruit/ko/common/common/jobListInfo.fo`를 호출한다. 회사 코드는 `COMPANY=E10`, 비즈니스 유닛은 `BUSINESS_UNIT=E10BU`로 고정되어 있으며, `ZZ_TARGET_1=Z`, `ROWNO=100`, `PAGENO=1`로 전체 채용 목록을 받을 수 있다.

응답은 `list([...])` JSONP이며 각 항목은 `ZZ_JO_NUM`, `ZZ_TITLE`, `ZZ_TARGET_1`, `ZZ_STR_DT`, `ZZ_END_DT`, `RNUM`, `ACTIVE_CNT`를 포함한다. `ZZ_JO_NUM`이 숫자가 아니면 프론트와 동일하게 `bestDetail.fo?zz_jo_num={ZZ_JO_NUM}` 상세 URL을 사용하고, `RNUM > ACTIVE_CNT`인 닫힌 공고는 제외한다.

임시 SQLite DB에서 `preview-source --company-slug cj-olivenetworks`를 실행한 결과 `discovered=40`, `error=null`이 확인됐다. 샘플에는 `[경력] 팩토리사업 영업대표`, `[경력] 프로젝트 DBA`, `[경력] CJ ONE 회원 서비스 백엔드 개발자` 등이 포함된다.

## 한화시스템 공식 JSON API 승격

한화시스템 공식 채용 안내 페이지 `https://www.hanwhasystems.com/kr/recruit/recruit3.do`는 실제 공고 확인/지원 동선을 한화인 `https://www.hanwhain.com/`으로 연결한다. 한화인 `지원하기 > 채용공고` 화면은 공개 POST endpoint `https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/search-rcrt`를 호출한다.

계열사 목록 endpoint `search-sbsd`에서 한화시스템 계열사 코드는 `한화시스템/ICT=215`, `한화시스템/방산=328`로 확인했다. seed는 `request_method=POST`와 `sdSeqList=[215,328]`, `size=100`을 포함한 한화인 프론트와 동일한 검색 body를 사용한다.

응답은 `data.list[]` 안에 `rtSeq`, `rtNm`, `sdNm`, `rtAcptStrtDttm`, `rtAcptEndDttm`, `rtNrcrtYn`, `rtCarrYn`, `rtIntnYn`, `rtPermanentWorkYn`, `rtTempWorkYn`를 포함한다. 상세 URL은 한화인 공유 URL과 동일하게 `https://www.hanwhain.com/portal/apply/recruit/detail?rtSeq={rtSeq}`로 구성한다.

임시 SQLite DB에서 `preview-source --company-slug hanwha-systems`를 실행한 결과 `discovered=24`, `error=null`이 확인됐다. 샘플에는 `한화시스템 구미사업장 운영지원 및 홍보/의전 계약직 채용`, `한화시스템 Talent Sourcer 계약직 채용`, `한화시스템 통신단말 및 ESA 빔 추적/제어 R&D 엔지니어 경력사원 채용` 등이 포함된다.

## Phase 3 게임/콘텐츠 후보 등록

2026-07-10 Phase 3 대상으로 게임/콘텐츠 회사 12개를 `INITIAL_SOURCE_CATALOG`에 추가했다.

| Source | Type | Status | Result |
| --- | --- | --- | --- |
| 크래프톤 | `lever_greenhouse` | `allowed` | Greenhouse API preview `discovered=64`, `error=null` |
| 네오위즈 | `lever_greenhouse` | `allowed` | Lever API preview `discovered=31`, `error=null` |
| 펄어비스 | `html_listing_detail` | `allowed` | HTML listing preview `discovered=2`, `error=null` |
| 스마일게이트 | `enterprise_json` | `allowed` | announcement API preview `discovered=127`, `error=null` |
| 넥슨 | `browser_public_render` | `needs_browser` | direct HTTP preview returns public anti-bot page |
| 엔씨소프트 | `browser_public_render` | `needs_browser` | listing page references JS apply APIs |
| 넷마블 | `browser_public_render` | `needs_browser` | official announcement page needs browser/API extraction |
| 카카오게임즈 | `static_next_data` | `needs_connector` | Greeting-powered custom page embeds listing data; detail mapping pending |
| 위메이드 | `static_next_data` | `needs_connector` | Next data embeds Ninehire links; Ninehire-aware parser pending |
| 컴투스 | `browser_public_render` | `needs_browser` | recruiter.co.kr Next page needs browser/API extraction |
| 데브시스터즈 | `static_next_data` | `needs_connector` | Greeting-powered custom page currently exposes no open postings |
| 시프트업 | `html_listing_detail` | `needs_connector` | official recruit page needs site-specific HTML parser |

임시 SQLite DB에서 `seed-sources`를 재실행한 결과 `created=42`가 확인됐다.

`preview-source --company-slug krafton` 결과는 `discovered=64`, 샘플에는 `[AI Frontier Div.] AI Native Full Stack Engineer (7년 이상)`, `[AI Research Div.] AI Companion Team Internship (2년 이상 / 인턴)` 등이 포함된다.

`preview-source --company-slug neowiz` 결과는 `discovered=31`, 샘플에는 `[Onetake Studio] JRPG 신작 프로젝트 시니어 클라이언트 프로그래머` 등이 포함된다.

`preview-source --company-slug pearl-abyss` 결과는 `discovered=2`, 샘플은 `[경력] 네트워크 엔지니어 모집`, `[경력] 개인정보보호 담당자 모집`이다. Pearl Abyss 상세 URL은 `detail?_jobOpeningNo={id}` 형태라 generic HTML 파서가 쿼리 기반 공고 번호를 external id로 사용하도록 보강했다.

Smilegate 공고 화면 `https://careers.smilegate.com/apply/announce?mainCategory=`는 비로그인 기준 `POST https://careers.smilegate.com/api/apply/announce/guest`를 호출한다. 검색 body는 `careerTypeCd`, `companyCd`, `gameGenreCd`, `hireTypeCd`, `jobDtlCd`, `jobMainCd`, `keyword`, `pageIndex`, `pageSize`, `projectSeq`, `usreId`로 구성된다. `pageSize=150`에서 `announceCount=127` 전체를 한 번에 받을 수 있음을 확인했고, 임시 SQLite DB에서 preview 결과 `discovered=127`, `error=null`이 확인됐다.

## 다음 판단

- LG전자와 LG CNS는 `static_next_data`가 아니라 공식 JSON API로 확인되어 `enterprise_json`으로 승격했다.
  - LG전자: `GET https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=20`, preview `discovered=9`
  - LG CNS: `POST https://api.careers.lg.com/rmk/job/retrieveJobNoticesList`, `companyCodeList=["CNS"]`, preview `discovered=21`
- SK하이닉스는 공식 정적 공고 페이지의 현재 빈 상태를 `html_listing_detail`로 확인하도록 승격했다.
- 삼성전자는 Samsung Careers 공식 HTML fragment 목록으로 승격했고, 현재 preview `discovered=0`, `error=null`인 공식 빈 상태다.
- 삼성SDS는 Samsung Careers 공식 HTML fragment 목록으로 승격했고, 현재 preview `discovered=0`, `error=null`인 공식 빈 상태다.
- 포스코DX는 POSCO Group 공식 JSON 목록 API로 승격했고, 현재 preview `discovered=5`다.
- SK텔레콤은 SK Careers 공식 JSON 목록 API로 승격했고, 현재 preview `discovered=8`이다.
- KT는 KT Group 공식 JSON 목록 API로 승격했고, 현재 preview `discovered=55`다.
- 현대자동차는 Hyundai Motor 공식 JSON 목록 API로 승격했고, 현재 preview `discovered=30`이다.
- 기아는 Kia 공식 렌더 목록으로 승격했고, 현재 preview `discovered=3`이다.
- CJ올리브네트웍스는 CJ Group 공식 JSONP 목록 API로 승격했고, 현재 preview `discovered=40`이다.
- 한화시스템은 HanwhaIn 공식 JSON 목록 API로 승격했고, 현재 preview `discovered=24`이다.
- Phase 2 엔터프라이즈 기준 남은 `needs_connector` 항목은 없다.
- Phase 2 엔터프라이즈 기준 남은 `blocked` / `needs_browser` 항목도 없다.
- Phase 3 기준 남은 후보는 `needs_connector=4`, `needs_browser=4`이며, 다음 우선순위는 Kakao Games/Devsisters Greeting embedded listing, Wemade Ninehire Next data, Shift Up HTML parser다.

## 2026-07-10 LG API 승격

LG전자 `jobs` 페이지의 Next.js 청크에서 `https://globalcareers.lge.com/api/job/v1/jobs/` 호출을 확인했다. 응답은 `data.list` 안에 `id`, `title`, `content`, `location`, `empType`, `postCreateDtm` 등을 담고 있으며, 상세 URL은 `/jobs/{id}`로 구성된다.

LG CNS는 Vite 번들에서 `https://api.careers.lg.com/rmk` base URL과 `/job/retrieveJobNoticesList` POST 호출을 확인했다. 프론트가 보내는 검색 바디는 `lnbSearch`, `hashTagText`, `recDate`, `order`, `careerList`, `companyCodeList`, `desireLocList`, `jobGroupList`이며, `companyCodeList=["CNS"]`로 LG CNS 공고만 필터링된다.

이를 위해 `career_sources`에 `request_method`, `request_body`를 추가했고, `enterprise_json` 파서는 LG전자/LG CNS의 공개 JSON 필드와 상세 URL 파생 규칙을 처리한다. 임시 SQLite DB에서 `preview-sources --status allowed --source-type enterprise_json`을 실행해 LG CNS 21건, LG전자 9건을 저장 없이 확인했다.
