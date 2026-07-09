# 2026-07-10 Source Preview Smoke

임시 SQLite DB에 `seed-sources`를 넣고 `preview-sources`로 2단계 후보를 확인했다. 이 작업은 운영 DB, 공고, 스냅샷, source status를 변경하지 않는다.

## 실행 환경

```bash
DATABASE_URL=sqlite+pysqlite:////tmp/ejikfit-preview.sqlite
ejikfit seed-sources
ejikfit preview-sources --status needs_connector --limit 12
ejikfit preview-sources --status needs_browser --source-type browser_public_render
```

브라우저 렌더링 확인 전에는 로컬 `.venv`에 `packages/backend[dev,browser]`와 Playwright Chromium을 설치했다.

## needs_connector 결과

| Source | Type | Result |
| --- | --- | --- |
| LG CNS | `static_next_data` | `unsupported_connector`: static Next data payload is not valid JSON |
| LG전자 | `static_next_data` | `unsupported_connector`: static Next data payload is not valid JSON |
| 삼성SDS | `html_listing_detail` | `discovered=0` after false-positive filtering |
| KT | `html_listing_detail` | `discovered=0` |
| SK텔레콤 | `html_listing_detail` | `discovered=0` after false-positive filtering |
| 현대자동차 | `html_listing_detail` | `discovered=0` |
| CJ올리브네트웍스 | `html_listing_detail` | `discovered=0` after false-positive filtering |
| 기아 | `html_listing_detail` | `discovered=0` after false-positive filtering |
| 한화시스템 | `html_listing_detail` | `discovered=0` after false-positive filtering |

처음 실행에서는 삼성SDS 직무소개, SK Careers 블로그/유튜브, 기아/한화 채용 안내 링크가 공고처럼 잡혔다. `html_listing_detail`는 날짜 또는 직무 제목 신호가 있는 링크만 후보로 보도록 조정했고, `더보기` 직무소개 링크를 제외했다.

## needs_browser 결과

| Source | Type | Result |
| --- | --- | --- |
| SK하이닉스 | `browser_public_render` | renderer timeout resolved, current parser result `discovered=0` |
| 삼성전자 | `browser_public_render` | `blocked`: source returned an access challenge |
| 포스코DX | `browser_public_render` | `temporary_fetch_error`: `net::ERR_TUNNEL_CONNECTION_FAILED` |

처음 실행에서 SK하이닉스는 `Page.goto`의 `networkidle` 대기 때문에 20초 timeout이 발생했다. renderer를 `domcontentloaded` 필수 대기와 5초 best-effort `networkidle` settle로 바꾼 뒤 timeout은 사라졌다.

## 다음 판단

- LG전자와 LG CNS는 `static_next_data`가 아니라 공식 JSON API로 확인되어 `enterprise_json`으로 승격했다.
  - LG전자: `GET https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=20`, preview `discovered=9`
  - LG CNS: `POST https://api.careers.lg.com/rmk/job/retrieveJobNoticesList`, `companyCodeList=["CNS"]`, preview `discovered=21`
- SK하이닉스는 브라우저 렌더링 이후 공개 JSON/API 탐색 또는 추가 wait/selector 전략이 필요하다.
- 삼성전자는 접근 challenge가 확인되어 `blocked` 또는 `review`로 운영 분류하는 편이 안전하다.
- 포스코DX는 네트워크 접근성 확인 후 대체 공식 출처를 찾아야 한다.

## 2026-07-10 LG API 승격

LG전자 `jobs` 페이지의 Next.js 청크에서 `https://globalcareers.lge.com/api/job/v1/jobs/` 호출을 확인했다. 응답은 `data.list` 안에 `id`, `title`, `content`, `location`, `empType`, `postCreateDtm` 등을 담고 있으며, 상세 URL은 `/jobs/{id}`로 구성된다.

LG CNS는 Vite 번들에서 `https://api.careers.lg.com/rmk` base URL과 `/job/retrieveJobNoticesList` POST 호출을 확인했다. 프론트가 보내는 검색 바디는 `lnbSearch`, `hashTagText`, `recDate`, `order`, `careerList`, `companyCodeList`, `desireLocList`, `jobGroupList`이며, `companyCodeList=["CNS"]`로 LG CNS 공고만 필터링된다.

이를 위해 `career_sources`에 `request_method`, `request_body`를 추가했고, `enterprise_json` 파서는 LG전자/LG CNS의 공개 JSON 필드와 상세 URL 파생 규칙을 처리한다. 임시 SQLite DB에서 `preview-sources --status allowed --source-type enterprise_json`을 실행해 LG CNS 21건, LG전자 9건을 저장 없이 확인했다.
