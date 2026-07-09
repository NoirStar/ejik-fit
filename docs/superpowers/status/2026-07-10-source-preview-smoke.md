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

- 이 smoke 결과만으로 새 `allowed` 승격 대상은 없다.
- LG 계열은 실제 응답 구조 확인 후 `static_next_data` 설정 또는 별도 엔드포인트 커넥터가 필요하다.
- SK하이닉스는 브라우저 렌더링 이후 공개 JSON/API 탐색 또는 추가 wait/selector 전략이 필요하다.
- 삼성전자는 접근 challenge가 확인되어 `blocked` 또는 `review`로 운영 분류하는 편이 안전하다.
- 포스코DX는 네트워크 접근성 확인 후 대체 공식 출처를 찾아야 한다.
