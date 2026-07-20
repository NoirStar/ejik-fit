# 이직핏

기업 공식 채용페이지의 IT·보안·게임·ROS 공고를 모아 검색하고, 출처와 변경 이력을 함께 보여주는 한국어 채용 정보 플랫폼입니다.

현재 저장소는 첫 번째 수직 슬라이스입니다. 그리팅 SSR과 Schema.org `JobPosting` JSON-LD를 읽고, 원문 스냅샷·공고 리비전·검색 색인을 저장한 뒤 목록과 상세 화면에 표시합니다.

## 수집 원칙

- 로그인 없이 공개된 기업 공식 채용페이지만 수집합니다.
- 인증, CAPTCHA, 접근 통제를 우회하지 않습니다.
- 401·403·CAPTCHA가 감지되면 해당 출처를 검토 상태로 바꿉니다.
- 한 번의 수집 실패로 기존 공고를 마감하지 않습니다.
- 실행할 수 없는 출처가 72시간 동안 재검증되지 않으면 기존 공개 공고를
  `delayed`로 격리합니다. 이는 마감이 아니며, 정상 검색과 통계에는 `open`
  공고만 포함합니다.
- 정상 목록에서 3회 연속 사라진 공고만 마감 처리합니다.
- 모든 공고에 공식 출처 URL과 마지막 확인 시각을 표시합니다.

## 구성

- Next.js 16.2: 한국어 공고 검색·목록·상세
- FastAPI·SQLAlchemy·Alembic: 읽기 API와 기준 데이터
- Celery·Redis: 출처 수집 작업
- PostgreSQL 17: 기업·출처·공고·리비전
- Meilisearch: 한국어 공고 검색
- MinIO: SHA-256 기반 원문 HTML 스냅샷

## 빠른 시작

요구 도구는 Docker Engine, Docker Compose v2, GNU Make, curl입니다.

```bash
cp .env.example .env
make up
make migrate
make seed
make sources
make crawl SOURCE_ID=$(docker compose exec -T api ejikfit list-sources --first-id)
make smoke
```

웹은 <http://localhost:3000>, API 문서는 <http://localhost:8000/docs>, Meilisearch는 <http://localhost:7700>, MinIO 콘솔은 <http://localhost:9001>에서 확인합니다.

전체 테스트는 다음 명령으로 실행합니다.

```bash
make test
```

## 공개 브라우저 렌더링 출처

일부 공식 채용 페이지는 로그인 없이 공개되어 있지만 JavaScript 렌더링 후에만
공고 목록이 보입니다. 이런 출처는 `browser_public_render`로 등록하고, Playwright
Chromium으로 렌더링한 HTML을 기존 JSON-LD, Next data, HTML listing 파서에 다시
통과시킵니다.

로컬에서 브라우저 렌더링 출처를 미리보기하려면 browser extra와 Chromium을 설치합니다.

```bash
.venv/bin/pip install -e 'packages/backend[dev,browser]'
.venv/bin/python -m playwright install chromium
ejikfit preview-source --company-slug samsung-electronics --source-type html_listing_detail
```

넥슨 통합 채용 페이지는 일반 headless 요청 대신 화면이 있는 Chromium에서 공개
목록을 로드해야 합니다. Linux에서는 Xvfb 안에서 미리보기를 실행합니다.

```bash
xvfb-run -a ejikfit preview-source --company-slug nexon --source-type browser_public_render
```

이 경로는 로그인 상태, 프록시, stealth 패치나 CAPTCHA 우회를 사용하지 않는 일반
Playwright Chromium입니다. 한 번 받은 공식 목록은 넥슨코리아·네오플 등 등록된
13개 법인별로 나누어 처리합니다. 과거 자동 접근 오류 때문에 남은
`blocked`/`review` 상태는 다음 source seed에서 재검증 가능한 상태로 복구하되,
운영자가 명시적으로 중지한 `stopped` 출처는 자동으로 변경하지 않습니다.

2단계 후보를 묶어서 점검할 때는 batch preview를 씁니다.

```bash
ejikfit preview-sources --status needs_connector --limit 12
ejikfit preview-sources --status needs_browser --source-type browser_public_render
```

미리보기 결과가 정상이고 정책상 공개 수집이 가능할 때만 명시적으로 승격합니다.

```bash
ejikfit set-source-status --company-slug samsung-electronics --source-type html_listing_detail allowed
```

CAPTCHA, 로그인, Cloudflare challenge, 접근 통제는 우회하지 않습니다. 이런 화면이
감지되면 해당 출처는 `blocked` 또는 `review`로 남기고 대체 공식 출처를 찾습니다.

`20260709_0005`부터 `20260710_0012`까지의 출처 레지스트리 마이그레이션은
PostgreSQL enum 값과 운영 상태 데이터를 추가하므로 의도적으로 역방향 실행을
지원하지 않습니다. 되돌려야 할 때는 기존 enum 값을 그대로 둔 채 별도의 forward
data migration으로 상태와 행을 변환해야 합니다.

## 기술 스킬 인텔리전스

공고 제목과 본문에서 기술 스킬을 사전 기반으로 추출해(별도 LLM 없음) 수요 통계를 제공합니다.

- 수집(`crawl-all`) 시 자동으로 `posting_skills`에 저장됩니다.
- 기존 공고를 다시 수집하지 않고 스킬만 다시 채우려면 backfill을 씁니다.
- 상세 API는 스킬별 필수·우대 구분, 원문 근거, 규칙 기반 신뢰도를 제공합니다.
- `C`, `Go`, `R`과 일반 단어형 기술명은 별칭별 문맥 정책으로 검증합니다.
- 신뢰도 `0.80` 미만 후보는 보존하지만 공개 통계와 기본 화면에서는 제외합니다.

```bash
ejikfit backfill-skills            # 저장된 모든 공고의 스킬 재추출
# API
GET /api/skills/stats?career_type=new_comer   # 스킬 수요 랭킹
GET /api/postings/{id}                          # 응답에 skills 포함
```

사전과 매칭 규칙은 `packages/backend/src/ejikfit/skills.py`에 있습니다. 짧고 모호한 이름
(`Go`, 단독 `C`, 한글 `뷰`)은 오탐을 피하려고 명시 별칭으로만 매칭합니다.

## Vercel 배포

Next.js 웹과 FastAPI 읽기 API는 Vercel 프로젝트 두 개로 배포합니다. 운영 데이터와 원문은 Supabase PostgreSQL·Storage에 저장하고, GitHub Actions가 6시간마다 Python crawler를 실행합니다. 운영 수집은 로컬 컴퓨터, Redis, Celery, MinIO, Meilisearch에 의존하지 않습니다.

전체 설정과 배포 순서는 [`docs/deployment/vercel.md`](docs/deployment/vercel.md)를 참고하세요.
운영 접근·인증 방법과 **다른 PC에서 이어 작업하는 절차**는 [`docs/deployment/access-and-auth.md`](docs/deployment/access-and-auth.md)에 정리되어 있습니다.

로컬 도구로 빠르게 실행하려면 Python 3.12와 Node.js 20 이상이 필요합니다.

```bash
python3.12 -m venv .venv
.venv/bin/pip install -e 'packages/backend[dev]'
.venv/bin/pytest packages/backend/tests -v

cd apps/web
npm ci
npm test -- --run
npm run build
```

## 초기 공식 출처

아래 표는 프로젝트 최초 검증에 사용한 출처입니다. 현재 운영 중이거나 연결을 준비하는
전체 기업 목록은 서비스의 `/data-policy` 페이지에서 운영 DB 기준으로 확인할 수 있습니다.

| 기업 | 공식 채용페이지 |
| --- | --- |
| DeepAuto.ai | <https://deepauto-ai.career.greetinghr.com/ko> |
| NHN KCP | <https://kcp.career.greetinghr.com/ko> |
| Sionic AI | <https://sionicai.career.greetinghr.com/ko> |
| EXEM | <https://ex-em.career.greetinghr.com/ko> |
| AFI 뒤끝 | <https://thebackend.career.greetinghr.com/ko> |
| 뉴빌리티 | <https://neubility.career.greetinghr.com/ko> |
| 비트센싱 | <https://bitsensing.career.greetinghr.com/ko> |
| 오누이 | <https://onuii.career.greetinghr.com/ko> |
| 로앤컴퍼니 | <https://lawcompany.career.greetinghr.com/ko> |
| 슈퍼센트 | <https://supercent.career.greetinghr.com/ko> |

시드는 여러 번 실행해도 중복되지 않습니다. 첫 실행은 `created=10`, 다음 실행은 `created=0`을 출력합니다.

## 장애 확인

```bash
docker compose ps
docker compose logs api
docker compose logs worker
docker compose logs web
```

- API가 시작되지 않으면 `make migrate` 전후의 PostgreSQL 로그를 확인합니다.
- 검색 결과가 비면 Meilisearch 상태와 worker 로그를 확인합니다.
- 원문 저장 실패는 MinIO의 `raw-snapshots` 버킷과 `.env`의 `S3_*` 값을 확인합니다.
- 기업 페이지가 401·403 또는 CAPTCHA를 반환하면 우회하지 말고 출처 상태를 검토합니다.

## 다음 단계

직무 인텔리전스 1차(스킬 추출·수요 통계)까지 반영되었습니다. 이어서 필수·우대 조건 구분과
근거 문장 추출, 공고-스킬 관계 그래프, 수집 범위 확대(나인하이어·recruiter, 기업 100곳+),
개인별 스킬 핏과 알림을 추가합니다. 상세 설계와 로드맵은 [`docs/superpowers`](docs/superpowers)에 있습니다.
