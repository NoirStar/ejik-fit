# Vercel 배포

이 저장소는 Vercel 프로젝트를 두 개로 나눠 배포할 수 있습니다.

1. `ejik-fit-web`: Next.js 웹
2. `ejik-fit-api`: FastAPI 읽기 API

Vercel의 Python Runtime은 현재 Beta입니다. 공고 수집 worker는 장시간 실행과 큐가 필요하므로 Vercel Function에 넣지 않고 별도 상시 실행 환경에 둡니다.

## 1. 웹 프로젝트

Vercel 대시보드에서 `NoirStar/ejik-fit`을 Import한 뒤 다음 값을 지정합니다.

| 설정 | 값 |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Node.js | 20 이상 |

환경변수는 Preview와 Production 모두에 설정합니다.

```text
API_BASE_URL=https://<배포된-api-도메인>
```

`API_BASE_URL`은 브라우저 공개 변수가 아니라 Next.js 서버 전용 값입니다. 끝에 `/`를 붙이지 않습니다.

## 2. API 프로젝트

같은 GitHub 저장소를 새 Vercel 프로젝트로 한 번 더 Import합니다.

| 설정 | 값 |
| --- | --- |
| Framework Preset | FastAPI |
| Root Directory | `packages/backend` |
| Python | 3.12 |
| Build Command | 비워 둠 |
| Output Directory | 비워 둠 |

`pyproject.toml`의 `[tool.vercel]`이 `ejikfit.api.app:app`을 진입점으로 지정합니다.

최소 환경변수:

```text
EJIKFIT_ENV=production
DATABASE_URL=postgresql+psycopg://<외부-postgres-접속문자열>
MEILI_URL=https://<외부-meilisearch-주소>
MEILI_MASTER_KEY=<검색-키>
```

검색 서비스가 일시적으로 실패하면 API는 PostgreSQL 제목·본문 검색으로 대체합니다. 로컬 Docker의 `postgres`, `meilisearch`, `minio` 주소는 Vercel에서 접근할 수 없으므로 사용하면 안 됩니다.

API 배포 뒤 아래 주소를 확인합니다.

```text
https://<api-domain>/health
https://<api-domain>/api/postings?limit=1
```

## 3. 데이터베이스 준비

Vercel 배포 전에 외부 PostgreSQL에 마이그레이션과 시드를 한 번 실행합니다.

```bash
DATABASE_URL='<외부-postgres-접속문자열>' \
  .venv/bin/alembic -c packages/backend/alembic.ini upgrade head

DATABASE_URL='<외부-postgres-접속문자열>' \
  .venv/bin/ejikfit seed-sources
```

## 4. 수집 worker

웹과 읽기 API를 Vercel에 둘 수 있지만 Celery worker는 별도 호스팅이 필요합니다. worker 환경에는 PostgreSQL, Redis, Meilisearch, S3 호환 저장소의 공개 접속값을 설정합니다.

```text
DATABASE_URL
REDIS_URL
MEILI_URL
MEILI_MASTER_KEY
S3_ENDPOINT_URL
S3_ACCESS_KEY
S3_SECRET_KEY
S3_BUCKET
```

초기에는 로컬 Docker worker로 외부 서비스에 수집해도 됩니다. 이후 Railway, Fly.io, Render 같은 상시 실행 컨테이너 환경으로 옮길 수 있습니다.

## 5. 배포 순서

1. 외부 PostgreSQL·Meilisearch·S3를 준비합니다.
2. 마이그레이션과 시드를 실행합니다.
3. API 프로젝트를 배포하고 `/health`를 확인합니다.
4. 웹 프로젝트에 API 도메인을 설정해 배포합니다.
5. worker를 실행해 공고를 수집합니다.
6. 웹 목록·상세의 공식 출처와 마지막 확인 시각을 검증합니다.
