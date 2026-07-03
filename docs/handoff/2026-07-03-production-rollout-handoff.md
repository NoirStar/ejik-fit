# 이직핏 운영 배포 작업 인계

작성 시점: 2026-07-03  
저장소: `NoirStar/ejik-fit`  
로컬 경로: `/root/work/ejik-fit`

## 사용자가 확정한 목표

- 한국 IT·보안·게임·ROS 중심의 기업 공식 채용공고 플랫폼
- 운영 Web/API는 Vercel
- 운영 PostgreSQL과 원문 HTML 저장소는 Supabase
- Python crawler는 로컬이 아니라 GitHub Actions에서 6시간마다 실행
- 비용은 무료 또는 저비용을 우선하고, 한국 사용자 응답속도를 위해 운영 리전을 가깝게 배치
- 사용자가 보유한 custom domain을 Web과 API에 연결

확정된 운영 구조:

```text
사용자
  │
  ▼
Vercel Next.js Web ──▶ Vercel FastAPI ──▶ Supabase PostgreSQL
                                              ▲
                                              │
GitHub Actions crawler ──▶ Supabase Storage ──┘
```

운영 환경에서는 Redis, Celery, MinIO, Meilisearch를 사용하지 않는다. 이 서비스들은 로컬 Docker 개발 환경에만 남긴다.

## 현재 Git 상태

- 현재 브랜치: `codex/supabase-production`
- 원격 추적 브랜치: `origin/codex/supabase-production`
- 마지막으로 검증·게시된 제품 코드 커밋: `d5881be chore: configure Vercel and Supabase production`
- Draft PR: <https://github.com/NoirStar/ejik-fit/pull/1>
- PR base/head: `main` ← `codex/supabase-production`
- PR은 현재 mergeable 상태다.

기존 `feat/foundation-vertical-slice` 원격 브랜치는 별도 체크포인트 커밋 때문에 로컬 이력과 갈라져 있다. 이를 강제 푸시하지 않고 새 `codex/supabase-production` 브랜치를 만들었다. 기존 브랜치를 force push하지 않는다.

## 반드시 보존할 미커밋 작업

현재 working tree에는 CI 오류 수정 중인 파일 두 개가 있다.

```text
 M packages/backend/alembic/versions/20260703_0002_pgroonga_search.py
?? packages/backend/tests/test_migration_offline.py
```

변경 목적:

- PR backend CI가 `alembic upgrade head --sql`에서 실패했다.
- 원인은 PGroonga migration이 Alembic offline 모드의 `MockConnection`에 `exec_driver_sql()`을 호출한 것이다.
- migration에 offline 분기를 추가해 DB introspection 대신 조건부 PostgreSQL `DO` SQL을 출력하도록 수정 중이다.
- `test_migration_offline.py`는 생성된 SQL에 `pg_available_extensions`와 `ix_job_postings_pgroonga`가 포함되는지 검증한다.

마지막 검증 명령은 사용자가 중단했으므로 이 수정은 아직 통과했다고 간주하면 안 된다. 두 파일을 삭제하거나 되돌리지 말고 먼저 다음 명령을 실행한다.

```bash
cd /root/work/ejik-fit

PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
  .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_migration_offline.py -v

.venv/bin/alembic \
  -c packages/backend/alembic.ini \
  upgrade head --sql >/tmp/ejikfit-migration.sql

rg -n 'pg_available_extensions|ix_job_postings_pgroonga' \
  /tmp/ejikfit-migration.sql
```

호스트에 ROS pytest plugin이 자동 로드되므로 로컬 pytest에는 `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`과 `-p pytest_asyncio.plugin`을 사용한다. Docker의 `make test`에는 이 우회가 필요 없다.

위 검증이 통과하면:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
  .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests -v

make test

git add \
  packages/backend/alembic/versions/20260703_0002_pgroonga_search.py \
  packages/backend/tests/test_migration_offline.py
git commit -m "fix: support offline PGroonga migrations"
git push
```

그 다음 PR 검사를 확인한다.

```bash
gh pr checks 1 --repo NoirStar/ejik-fit --watch
```

## PR과 CI 상태

현재 PR #1 검사:

- `web`: 성공
- `backend`: 실패

실패한 run:

<https://github.com/NoirStar/ejik-fit/actions/runs/28628995813>

backend 실패는 제품 테스트가 아니라 Alembic offline SQL 생성 단계 하나다. 위 미커밋 수정이 이 실패를 대상으로 한다.

## 이미 구현된 범위

- FastAPI, SQLAlchemy, Alembic 기반 API
- Company, CareerSource, RawSnapshot, JobPosting, JobRevision 모델
- 공식 Greeting 채용페이지 10개 초기 seed
- Greeting `__NEXT_DATA__` parser
- Schema.org `JobPosting` JSON-LD parser
- SHA-256 원문 snapshot과 공고 revision 멱등 저장
- 정상 목록에서 3회 연속 사라진 공고만 마감하는 안전장치
- CAPTCHA/401/403을 우회하지 않고 출처를 review 상태로 전환
- Meilisearch 로컬 검색과 PostgreSQL 운영 검색 분리
- Supabase에서 PGroonga가 있으면 한국어 검색 index 생성
- Next.js 한국어 공고 목록·상세 UI
- Docker Compose 개발환경과 smoke test
- GitHub Actions 6시간 주기 remote crawler
- Vercel Web/API 설정과 서울 region 설정
- Supabase Storage S3 region 설정

핵심 운영 파일:

- `.github/workflows/crawl.yml`
- `apps/web/vercel.json`
- `packages/backend/vercel.json`
- `packages/backend/alembic/versions/20260703_0002_pgroonga_search.py`
- `docs/deployment/vercel.md`

설계와 실행 계획:

- `docs/superpowers/specs/2026-07-03-supabase-vercel-production-design.md`
- `docs/superpowers/plans/2026-07-03-supabase-vercel-production.md`

## 마지막으로 통과했던 검증

미커밋 CI 수정 전 원격 커밋 `d5881be` 기준:

- Backend: 27 tests passed
- Web: Vitest passed
- TypeScript: passed
- Docker API/Web/worker builds: passed
- Docker services health checks: passed
- Alembic online migration `20260703_0002`: passed
- seed 재실행 `created=0`: passed
- 실제 비트센싱 공고 7건 재수집: passed
- 같은 내용 재수집 시 revision 수 유지: passed
- Vercel mode Next.js build: passed
- npm audit: 0 vulnerabilities
- secret pattern scan: no matches

미커밋 offline migration 수정 후에는 fresh full verification이 필요하다.

## GitHub 인증 상태

- `gh` 설치 완료
- GitHub 계정 `NoirStar` 로그인 완료
- OAuth scope: `repo`, `workflow`, `read:org`, `gist`
- 새 브랜치 push와 Draft PR 생성 완료

확인:

```bash
gh auth status
gh pr view 1 --repo NoirStar/ejik-fit
```

토큰 값이나 기존 device verification code를 문서, 로그, 채팅에 출력하지 않는다.

## Supabase 현재 상태

Supabase CLI 로그인 완료.

사용자가 새로 만든 운영 프로젝트:

```text
name: ejik-fit
project ref: lsqwfrvwuxievitogucc
region: ap-northeast-2
database host: db.lsqwfrvwuxievitogucc.supabase.co
PostgreSQL: 17
status: ACTIVE_HEALTHY
```

이 프로젝트는 Seoul region이므로 저장소의 Vercel `icn1` 설정과 일치한다.

아직 하지 않은 작업:

- 저장소와 Supabase project link
- Alembic migration 적용
- source seed
- `raw-snapshots` private bucket 생성
- Supabase S3 protocol 활성화
- 서버 전용 S3 access key 생성
- GitHub Actions repository secrets 등록
- 첫 원격 crawl

DB 비밀번호와 S3 secret은 사용자에게 채팅으로 요청하지 않는다. Supabase CLI의 secure prompt 또는 Supabase Dashboard에서 사용자가 직접 입력하게 한다.

Supabase 상태 확인:

```bash
npx --yes supabase@latest --agent no projects list --output json
```

연결 시도:

```bash
npx --yes supabase@latest --agent no link \
  --project-ref lsqwfrvwuxievitogucc
```

CLI가 DB password를 요구하면 사용자가 직접 입력해야 한다. 비밀번호를 명령행 인자, 문서, Git history에 남기지 않는다.

## Supabase에서 이어서 할 작업

1. `lsqwfrvwuxievitogucc` project를 local repo에 link한다.
2. Database Connect 화면에서 두 URL을 구분해 가져온다.
   - GitHub Actions crawler: Session Pooler, port 5432
   - Vercel API: Transaction Pooler, port 6543
3. URL scheme을 `postgresql+psycopg://`로 바꾼다.
4. Session Pooler URL로 Alembic migration과 seed를 실행한다.
5. `raw-snapshots` private bucket을 만든다.
6. Storage S3 protocol을 활성화하고 server-only access key를 생성한다.
7. GitHub repository secrets를 stdin으로 등록한다.

필요한 GitHub secret 이름:

```text
CRAWLER_DATABASE_URL
SUPABASE_S3_ENDPOINT_URL
SUPABASE_S3_REGION
SUPABASE_S3_ACCESS_KEY
SUPABASE_S3_SECRET_KEY
```

값을 shell history에 남기지 않도록 `gh secret set NAME`의 stdin prompt를 사용한다. 설정 후 이름만 확인한다.

```bash
gh secret list --repo NoirStar/ejik-fit
```

## PR merge와 첫 원격 수집

예약 workflow는 default branch에 있어야 실행된다.

1. offline migration fix를 push한다.
2. PR CI가 모두 성공하는지 확인한다.
3. Draft PR을 ready 상태로 전환하고 `main`에 merge한다.
4. `crawl.yml`을 수동 실행한다.
5. Actions Summary, Supabase DB, Storage 객체를 확인한다.
6. 동일 내용을 한 번 더 수집해 revision이 늘지 않는지 확인한다.

PR을 merge하거나 branch를 삭제하는 것은 사용자 의사를 확인한 뒤 수행한다.

## Vercel 현재 상태

아직 하지 않은 작업:

- Vercel CLI 로그인
- Vercel account/team 확인
- `ejik-fit-api` project 생성·연결
- `ejik-fit-web` project 생성·연결
- production environment variables 등록
- production deploy
- GitHub repository integration 확인
- custom domain 연결

예정된 프로젝트:

```text
ejik-fit-api
  Root Directory: packages/backend
  Region: icn1

ejik-fit-web
  Root Directory: apps/web
  Region: icn1
```

API 환경변수:

```text
DATABASE_URL=Supabase Transaction Pooler URL
DATABASE_POOL_MODE=transaction
SEARCH_BACKEND=postgres
POSTGRES_SEARCH_MODE=pgroonga
```

Web 환경변수:

```text
API_BASE_URL=https://API production domain
```

`.vercel/`이 생성되기 전에 `.gitignore`에 포함됐는지 확인하고, 없으면 추가한다. Vercel project metadata나 환경변수 파일을 commit하지 않는다.

## Custom domain

사용자는 도메인을 보유하고 있지만 정확한 도메인 이름과 DNS provider는 아직 제공하지 않았다.

연결 계획:

```text
사용자 기본 도메인 또는 www → ejik-fit-web
api 서브도메인             → ejik-fit-api
```

Vercel 배포가 성공한 뒤 사용자에게 정확한 domain과 DNS provider를 한 번만 묻는다. Vercel이 프로젝트별로 표시하는 DNS record를 그대로 적용한다. apex와 `www` 중 하나를 canonical host로 선택하고 다른 하나는 redirect한다.

## 다음 에이전트의 권장 실행 순서

1. 이 문서와 두 설계/계획 문서를 읽는다.
2. working tree의 offline migration fix 두 파일을 보존한다.
3. targeted offline migration test와 SQL 생성 명령을 실행한다.
4. 전체 backend와 `make test`를 실행한다.
5. fix를 commit/push하고 PR CI를 green으로 만든다.
6. Supabase project `lsqwfrvwuxievitogucc`를 link한다.
7. Supabase migration, seed, private bucket, S3 key를 준비한다.
8. GitHub Actions secrets를 등록한다.
9. PR merge 여부를 사용자에게 확인한다.
10. merge 후 remote crawl을 수동 실행하고 검증한다.
11. Vercel API/Web 프로젝트를 연결하고 배포한다.
12. 사용자 domain을 받아 DNS와 HTTPS를 검증한다.

## 금지 사항과 주의점

- 기존 `feat/foundation-vertical-slice` 브랜치를 force push하지 않는다.
- 미커밋 migration fix를 삭제하지 않는다.
- Supabase DB password, S3 secret, GitHub token을 채팅이나 파일에 기록하지 않는다.
- 운영 crawler를 로컬 정기 작업으로 구성하지 않는다.
- CAPTCHA, 로그인, 접근 통제를 우회하지 않는다.
- CI가 green이 되기 전에 완료했다고 보고하지 않는다.
- Vercel과 Supabase 실제 배포 전에는 “배포 완료”라고 표현하지 않는다.
