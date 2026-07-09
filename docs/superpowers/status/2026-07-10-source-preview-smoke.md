# 2026-07-10 Source Preview Smoke

임시 SQLite DB에 `seed-sources`를 넣고 `preview-sources`로 2단계 후보를 확인했다. 이 작업은 운영 DB, 공고, 스냅샷, source status를 변경하지 않는다.

## 실행 환경

```bash
DATABASE_URL=sqlite+pysqlite:////tmp/ejikfit-preview.sqlite
ejikfit seed-sources
ejikfit preview-sources --status needs_connector --limit 12
ejikfit preview-sources --status needs_browser --source-type browser_public_render
ejikfit preview-source --company-slug sk-hynix
ejikfit preview-source --company-slug posco-dx
ejikfit preview-source --company-slug sk-telecom
```

브라우저 렌더링 확인 전에는 로컬 `.venv`에 `packages/backend[dev,browser]`와 Playwright Chromium을 설치했다.

## needs_connector 결과

| Source | Type | Result |
| --- | --- | --- |
| LG CNS | `static_next_data` | `unsupported_connector`: static Next data payload is not valid JSON |
| LG전자 | `static_next_data` | `unsupported_connector`: static Next data payload is not valid JSON |
| 삼성SDS | `html_listing_detail` | `discovered=0` after false-positive filtering |
| KT | `html_listing_detail` | `discovered=0` |
| 현대자동차 | `html_listing_detail` | `discovered=0` |
| CJ올리브네트웍스 | `html_listing_detail` | `discovered=0` after false-positive filtering |
| 기아 | `html_listing_detail` | `discovered=0` after false-positive filtering |
| 한화시스템 | `html_listing_detail` | `discovered=0` after false-positive filtering |

처음 실행에서는 삼성SDS 직무소개, SK Careers 블로그/유튜브, 기아/한화 채용 안내 링크가 공고처럼 잡혔다. `html_listing_detail`는 날짜 또는 직무 제목 신호가 있는 링크만 후보로 보도록 조정했고, `더보기` 직무소개 링크를 제외했다.

## needs_browser 결과

| Source | Type | Result |
| --- | --- | --- |
| 삼성전자 | `browser_public_render` | `blocked`: source returned an access challenge |

처음 실행에서 SK하이닉스는 `Page.goto`의 `networkidle` 대기 때문에 20초 timeout이 발생했다. renderer를 `domcontentloaded` 필수 대기와 5초 best-effort `networkidle` settle로 바꾼 뒤 timeout은 사라졌다.

## SK하이닉스 정적 공고 페이지 재분류

SK하이닉스 Talent Hub의 공식 공고 URL은 `https://talent.skhynix.com/hub/ko/apply/job`이다. 이 페이지는 공개 서버 렌더링 HTML로 내려오며, 현재 `7월 모집 중 공고` 영역에는 `곧 공개될 새로운 공고를 기대해 주세요.` 빈 상태가 포함되어 있다. Playwright 네트워크 관찰에서도 별도 공고 JSON/API 호출은 확인되지 않았다.

따라서 SK하이닉스는 `browser_public_render`가 아니라 `html_listing_detail`로 분류하고, 공식 공개 페이지를 오류 없이 확인할 수 있으므로 `allowed`로 승격한다. 현재 preview 결과는 정상적인 빈 상태인 `discovered=0`이다.

## 삼성전자 접근 차단 분류

삼성전자 공식 Samsung Careers 진입점은 fresh preview에서도 `blocked` / `source returned an access challenge`를 반환했다. crawler가 실제 crawl 중 동일한 차단을 만나면 `SourceStatus.BLOCKED`와 `PolicyStatus.BLOCKED`로 기록하는 패턴과 맞춰, seed에서도 삼성전자를 `blocked`로 분류한다.

이 소스는 공식 URL 추적 대상에는 남기되, 정상 수집 대기열에는 포함하지 않는다. 다음 작업은 Samsung Careers의 허용 가능한 공개 API 또는 계열사별 대체 공식 공고 페이지를 별도로 찾는 것이다.

## 포스코DX 공식 JSON API 승격

포스코DX 홈페이지의 공식 채용 링크는 `https://recruit.posco.com/`로 연결된다. 루트 페이지는 `/h22a01-front/`로 진입하고, 채용 공고 목록 화면 `H22A1000.html`은 `/h22a01-recruit/H22A1000/list` JSON API를 호출한다.

`/h22a01-recruit/H22A1000/init` 응답의 회사 목록에서 포스코DX 코드는 `SEARCH_COMP=01`로 확인했다. 따라서 seed는 `https://recruit.posco.com/h22a01-recruit/H22A1000/list?rowCount=20&pageSize=10&currPage=1&offset=0&SEARCH_TYPE=&SEARCH_ORDER=s1&SEARCH_KEYWORD=&SEARCH_COMP=01&SEARCH_VALUE=`를 `enterprise_json` / `allowed`로 사용한다.

임시 SQLite DB에서 `preview-source --company-slug posco-dx`를 실행한 결과 `discovered=5`, `error=null`이 확인됐다. 샘플에는 `(포항/광양) IT&AI 분야 경력사원 채용 [정규직]`, `기술연구 분야 신입/경력사원 채용 [정규직]` 등이 포함된다.

## SK텔레콤 공식 JSON API 승격

SK Careers의 `Recruit` 화면은 공개 POST endpoint `https://www.skcareers.com/Recruit/GetRecruitList`를 호출한다. 회사 자동완성 endpoint에서 SK telecom 코드는 `corpCode=10005`로 확인했다.

seed는 `request_method=POST`와 `request_body={"sort":"2","searchText":"","corpCode":"10005","jobRole":"0","recruitType":"","workingType":"","workingRegion":""}`를 사용한다. 이 endpoint는 JSON POST를 직접 받아주므로 별도 브라우저 렌더링이 필요 없다.

임시 SQLite DB에서 `preview-source --company-slug sk-telecom`을 실행한 결과 `discovered=8`, `error=null`이 확인됐다. 샘플에는 `SKT 뉴스룸 운영 지원 담당자`, `유선망 현황관리 및 사무지원 담당자`, `T우주 서비스 운영지원 및 정산 담당자` 등이 포함된다.

## 다음 판단

- LG전자와 LG CNS는 `static_next_data`가 아니라 공식 JSON API로 확인되어 `enterprise_json`으로 승격했다.
  - LG전자: `GET https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=20`, preview `discovered=9`
  - LG CNS: `POST https://api.careers.lg.com/rmk/job/retrieveJobNoticesList`, `companyCodeList=["CNS"]`, preview `discovered=21`
- SK하이닉스는 공식 정적 공고 페이지의 현재 빈 상태를 `html_listing_detail`로 확인하도록 승격했다.
- 삼성전자는 접근 challenge가 재현되어 `blocked`로 운영 분류했다.
- 포스코DX는 POSCO Group 공식 JSON 목록 API로 승격했고, 현재 preview `discovered=5`다.
- SK텔레콤은 SK Careers 공식 JSON 목록 API로 승격했고, 현재 preview `discovered=8`이다.

## 2026-07-10 LG API 승격

LG전자 `jobs` 페이지의 Next.js 청크에서 `https://globalcareers.lge.com/api/job/v1/jobs/` 호출을 확인했다. 응답은 `data.list` 안에 `id`, `title`, `content`, `location`, `empType`, `postCreateDtm` 등을 담고 있으며, 상세 URL은 `/jobs/{id}`로 구성된다.

LG CNS는 Vite 번들에서 `https://api.careers.lg.com/rmk` base URL과 `/job/retrieveJobNoticesList` POST 호출을 확인했다. 프론트가 보내는 검색 바디는 `lnbSearch`, `hashTagText`, `recDate`, `order`, `careerList`, `companyCodeList`, `desireLocList`, `jobGroupList`이며, `companyCodeList=["CNS"]`로 LG CNS 공고만 필터링된다.

이를 위해 `career_sources`에 `request_method`, `request_body`를 추가했고, `enterprise_json` 파서는 LG전자/LG CNS의 공개 JSON 필드와 상세 URL 파생 규칙을 처리한다. 임시 SQLite DB에서 `preview-sources --status allowed --source-type enterprise_json`을 실행해 LG CNS 21건, LG전자 9건을 저장 없이 확인했다.
