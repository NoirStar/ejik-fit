# 운영 접근·인증 가이드 (다른 PC에서 이어 작업하기)

이 문서는 **어디에 무엇이 있고, 어떻게 인증하며, 새 PC에서 어떻게 이어서 작업하는지**를 정리한다.
비밀번호·토큰·S3 secret 등 **실제 시크릿 값은 이 문서(및 저장소)에 절대 기록하지 않는다.** 값은 각
서비스 대시보드나 gitignore된 로컬 파일에만 둔다.

최종 갱신: 2026-07-03

---

## 1. 접근 지점 한눈에

| 대상 | 위치 / 식별자 |
| --- | --- |
| GitHub 저장소 | `https://github.com/NoirStar/ejik-fit` |
| 작업 브랜치 | `codex/supabase-production` (PR #1 → `main`) |
| Supabase 대시보드 | `https://supabase.com/dashboard/project/lsqwfrvwuxievitogucc` |
| Supabase project ref | `lsqwfrvwuxievitogucc` |
| Supabase 리전 / PG | `ap-northeast-2` (Seoul) / PostgreSQL 17 |
| DB 직접 host | `db.lsqwfrvwuxievitogucc.supabase.co` |
| Pooler host | `aws-1-ap-northeast-2.pooler.supabase.com` |
| Pooler 포트 | Session `5432` (crawler) / Transaction `6543` (Vercel API) |
| DB 사용자 | `postgres.lsqwfrvwuxievitogucc` |
| Storage S3 endpoint | `https://lsqwfrvwuxievitogucc.storage.supabase.co/storage/v1/s3` |
| Storage 버킷 | `raw-snapshots` (private) |

> 위 값들은 비밀이 아니다(project ref에서 파생). **비밀은 DB 비밀번호와 S3 access/secret key뿐**이다.

연결 문자열 형식 (비밀번호만 본인 값으로 채운다):

```text
# GitHub Actions crawler — Session Pooler
postgresql+psycopg://postgres.lsqwfrvwuxievitogucc:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres

# Vercel API — Transaction Pooler
postgresql+psycopg://postgres.lsqwfrvwuxievitogucc:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres
```

---

## 2. 인증은 어떻게 했나 / 새 PC에서 재인증

각 도구는 로컬에 자격증명을 저장한다. 새 PC에서는 아래 명령으로 다시 로그인한다.

### GitHub CLI (`gh`)
- 방식: OAuth 로그인, 계정 `NoirStar`
- scope: `repo`, `workflow`, `read:org`, `gist`
- 저장 위치: `~/.config/gh/hosts.yml`
- 재인증:
  ```bash
  gh auth login          # GitHub.com → HTTPS → 브라우저/디바이스 코드
  gh auth status         # 확인
  ```
- 용도: PR 관리, `gh secret set/list`, `gh run` (Actions), `gh workflow run`

### Supabase CLI
- 방식: access token 로그인
- 저장 위치: `~/.supabase/access-token`
- 재인증 + 프로젝트 link:
  ```bash
  npx --yes supabase@latest login                       # access token 입력
  npx --yes supabase@latest link --project-ref lsqwfrvwuxievitogucc
  # DB 비밀번호 프롬프트는 비워도 link 자체는 된다(비밀번호는 DB 작업 시에만 필요)
  ```
- link 결과는 `supabase/.temp/`에 저장되며 **커밋되지 않는다**(`supabase/.gitignore`).

### Vercel CLI (아직 미로그인)
- 재인증:
  ```bash
  npx vercel login
  npx vercel link        # 프로젝트 디렉터리에서
  ```
- `.vercel/`는 `.gitignore`에 등록되어 커밋되지 않는다.

---

## 3. 시크릿을 다루는 규칙

- **채팅/커밋/로그에 시크릿 값을 남기지 않는다.**
- DB 비밀번호·S3 secret은 Supabase 대시보드 또는 secure prompt로만 입력한다.
- 로컬에서 마이그레이션/seed/crawl을 돌릴 때는 gitignore된 **`.env.production`**을 쓴다.
  - 커밋 금지 (`.gitignore`에 `.env.production`, `.env.local` 포함)
  - 형식은 아래 4절 참고
- GitHub Actions에 넣는 값은 Repository secret으로만 저장한다(이름만 공개).

### 현재 등록된 GitHub secret (값 비공개)

| Secret 이름 | 상태 |
| --- | --- |
| `CRAWLER_DATABASE_URL` | ✅ 등록됨 (Session Pooler URL) |
| `SUPABASE_S3_ENDPOINT_URL` | ✅ 등록됨 |
| `SUPABASE_S3_REGION` | ✅ 등록됨 (`ap-northeast-2`) |
| `SUPABASE_S3_ACCESS_KEY` | ⏳ 대시보드에서 키 생성 후 등록 |
| `SUPABASE_S3_SECRET_KEY` | ⏳ 대시보드에서 키 생성 후 등록 |

확인: `gh secret list --repo NoirStar/ejik-fit`

---

## 4. 새 PC에서 이어서 작업하는 절차

```bash
# 1) 저장소 + 브랜치
git clone https://github.com/NoirStar/ejik-fit.git
cd ejik-fit
git checkout codex/supabase-production

# 2) 백엔드 가상환경
python3.12 -m venv .venv
.venv/bin/pip install -e 'packages/backend[dev]'

# 3) 프런트엔드 의존성
cd apps/web && npm ci && cd ../..

# 4) 인증 (2절 참고)
gh auth login
npx --yes supabase@latest login
npx --yes supabase@latest link --project-ref lsqwfrvwuxievitogucc
# (배포 시) npx vercel login

# 5) 로컬에서 DB 작업이 필요하면 .env.production 생성 (커밋 금지)
cat > .env.production <<'EOF'
EJIKFIT_ENV=production
DATABASE_URL=postgresql+psycopg://postgres.lsqwfrvwuxievitogucc:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
DATABASE_POOL_MODE=session
SEARCH_BACKEND=postgres
POSTGRES_SEARCH_MODE=pgroonga
# S3는 대시보드에서 키 생성 후 채운다
S3_ENDPOINT_URL=https://lsqwfrvwuxievitogucc.storage.supabase.co/storage/v1/s3
S3_REGION=ap-northeast-2
S3_ACCESS_KEY=<S3_ACCESS_KEY>
S3_SECRET_KEY=<S3_SECRET_KEY>
S3_BUCKET=raw-snapshots
EOF
# <...> 자리표시자를 실제 값으로 교체한 뒤 저장
```

> **네트워크 주의:** postgres 포트(5432/6543)로 직접 나갈 수 있는 PC에서만 로컬 마이그레이션이 된다.
> HTTP 프록시만 있는 환경(일부 컨테이너/샌드박스)에서는 DB 직접 연결이 막히므로,
> 마이그레이션·seed·crawl은 **GitHub Actions**에서 실행한다(5절).

로컬 테스트 실행 (호스트에 ROS pytest 플러그인이 자동 로드되는 환경 우회 포함):

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -v
```

---

## 5. 마이그레이션·seed·수집은 GitHub Actions에서

`.github/workflows/crawl.yml`은 러너에서 다음을 순서대로 실행한다(러너는 네트워크 제약이 없다).

```text
alembic upgrade head   →   ejikfit seed-sources   →   ejikfit crawl-all
```

- 예약: 6시간마다 (`17 */6 * * *`)
- 수동 실행: `gh workflow run crawl.yml --repo NoirStar/ejik-fit` 또는 Actions 화면의 Run workflow
- 필요한 secret 5개가 모두 있어야 crawl까지 성공한다(원문 스냅샷 저장에 S3 필요).
- 실행 로그: `gh run list --workflow=crawl.yml` → `gh run view <id> --log`

---

## 6. 지금 상태 / 남은 일

**완료**
- `codex/supabase-production` 브랜치 → **PR #1 merged to `main`** (CI backend+web green)
- Supabase 프로젝트 link (`lsqwfrvwuxievitogucc`)
- GitHub secret 5개 전부 등록: `CRAWLER_DATABASE_URL`, `SUPABASE_S3_ENDPOINT_URL`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY`
- `.gitignore`: `.env.production`, `.env.local`, `.vercel/`, `supabase/.temp`
- **첫 원격 수집 성공** (run `28641234937`, 2026-07-03): migration + seed(`created=10`) + crawl(`ingested=130, failed=0, sources=10`). Supabase PostgreSQL과 `raw-snapshots` Storage에 반영됨.
- `raw-snapshots` private bucket + S3 access key 생성 완료(대시보드)

**남음**
1. Vercel API/Web 배포 (`docs/deployment/vercel.md` 참고) — Vercel CLI 로그인 필요
2. custom domain 연결 (도메인명·DNS provider 필요)
3. (선택) 멱등성 재확인: 다음 예약 수집 또는 배포된 API `/api/postings`로 revision 미증가 확인 (단위 테스트 `test_ingestion_is_idempotent_and_versions_changes`로 이미 커버됨)

관련 문서: `docs/deployment/vercel.md`, `docs/handoff/2026-07-03-production-rollout-handoff.md`
