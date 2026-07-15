# Supabase·Vercel 운영 배포

운영 환경은 다음 네 부분으로 나뉩니다.

```text
Vercel Web → Vercel API → Supabase PostgreSQL
                              ↑
GitHub Actions crawler → Supabase Storage
```

로컬 Docker는 개발과 테스트에만 사용합니다. 운영 공고 수집은 GitHub Actions가 6시간마다 실행합니다.

## 1. Supabase 프로젝트

Supabase에서 `ejik-fit` 프로젝트를 만들고 가능한 경우 Seoul 리전을 선택합니다.

Database의 Connect 화면에서 연결 문자열 두 개를 준비합니다.

| 용도 | 연결 방식 | 포트 |
| --- | --- | ---: |
| Vercel API | Transaction Pooler | 6543 |
| GitHub Actions crawler | Session Pooler | 5432 |

두 연결 문자열 모두 SQLAlchemy 형식으로 바꿉니다.

```text
postgresql+psycopg://사용자:비밀번호@호스트:포트/postgres
```

Transaction Pooler는 Vercel의 `DATABASE_URL`, Session Pooler는 GitHub의 `CRAWLER_DATABASE_URL`에만 저장합니다.

### Storage

1. Storage에 `raw-snapshots` private bucket을 만듭니다.
2. Storage 설정에서 S3 protocol을 활성화합니다.
3. 서버 전용 S3 Access Key와 Secret Key를 생성합니다.
4. S3 endpoint와 region을 함께 기록합니다.

S3 key는 전체 bucket 권한을 가지므로 브라우저와 Vercel Web에 넣지 않습니다.

## 2. GitHub Actions 원격 수집

GitHub 저장소 Settings → Secrets and variables → Actions에 다음 Repository secret을 등록합니다.

| 이름 | 값 |
| --- | --- |
| `CRAWLER_DATABASE_URL` | Supabase Session Pooler SQLAlchemy URL |
| `SUPABASE_S3_ENDPOINT_URL` | Supabase Storage S3 endpoint |
| `SUPABASE_S3_REGION` | Storage S3 region |
| `SUPABASE_S3_ACCESS_KEY` | 서버 전용 S3 access key |
| `SUPABASE_S3_SECRET_KEY` | 서버 전용 S3 secret key |

`.github/workflows/crawl.yml`은 다음 조건으로 동작합니다.

- 6시간마다 17분에 예약 실행
- Actions 화면의 Run workflow로 수동 실행
- 동시 실행 방지
- backend `browser` extra와 Playwright Chromium 설치
- migration → source seed → 전체 출처 수집
- 출처별 결과를 Actions Summary에 기록
- 현재 44개 이상 출처를 순차 처리할 수 있도록 실행 한도 120분 적용

`browser_public_render` 출처는 공개 JavaScript 렌더링 결과만 읽습니다. CAPTCHA,
로그인, Cloudflare challenge, 접근 통제는 우회하지 않고 출처 상태로 남깁니다.

workflow는 기본 브랜치에 들어간 뒤 예약 실행됩니다. 처음에는 수동 실행하고 Supabase의 공고와 Storage 객체를 확인합니다.

## 3. Vercel API 프로젝트

Vercel에서 `NoirStar/ejik-fit`을 Import해 `ejik-fit-api` 프로젝트를 만듭니다.

| 설정 | 값 |
| --- | --- |
| Framework Preset | FastAPI |
| Root Directory | `packages/backend` |
| Function Region | Seoul (`icn1`) |
| Python | 3.12 |

Production과 Preview 환경변수:

```text
DATABASE_URL=Supabase Transaction Pooler SQLAlchemy URL
DATABASE_POOL_MODE=transaction
SEARCH_BACKEND=postgres
POSTGRES_SEARCH_MODE=pgroonga
```

`DATABASE_POOL_MODE=transaction`은 SQLAlchemy client pool과 prepared statement를 비활성화해 Supabase Transaction Pooler와 충돌하지 않게 합니다.

배포 뒤 다음 주소를 확인합니다.

```text
https://API프로젝트주소/health
https://API프로젝트주소/api/postings?limit=1
```

## 4. Vercel Web 프로젝트

같은 저장소를 한 번 더 Import해 `ejik-fit-web` 프로젝트를 만듭니다.

| 설정 | 값 |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Function Region | Seoul (`icn1`) |

환경변수:

```text
API_BASE_URL=https://API프로젝트주소
NEXT_PUBLIC_SITE_URL=https://웹프로젝트주소
NEXT_PUBLIC_SUPABASE_URL=https://Supabase프로젝트참조.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=Supabase publishable key
```

`API_BASE_URL`은 Next.js 서버 전용 값이며 끝에 `/`를 붙이지 않습니다.
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 브라우저 인증용 공개 키입니다. 서버
전용 secret key나 service-role key는 Vercel Web에 넣지 않습니다.

Supabase Authentication의 Site URL은 Web 운영 주소로 설정하고 Redirect URLs에
`https://웹프로젝트주소/auth/callback`을 등록합니다. 로컬 개발에서는 사용하는
호스트의 `/auth/callback`만 추가합니다.

## 5. 사용자 도메인

도메인은 다음처럼 나눕니다.

```text
사용자 기본 도메인 또는 www → ejik-fit-web
api 서브도메인             → ejik-fit-api
```

1. Web 프로젝트 Settings → Domains에 기본 도메인을 추가합니다.
2. API 프로젝트에 같은 도메인의 `api` 서브도메인을 추가합니다.
3. 도메인 DNS 관리 화면에 Vercel이 제시하는 레코드만 등록합니다.
4. 인증 완료 후 Web의 `API_BASE_URL`을 `https://api.사용자도메인`으로 바꿉니다.
5. Web을 다시 배포합니다.
6. apex와 `www` 중 하나를 canonical host로 정하고 다른 주소는 redirect합니다.

DNS 값은 계정과 도메인 공급자에 따라 달라지므로 저장소에 하드코딩하지 않습니다.

## 6. 배포 검증

다음 순서로 운영 상태를 확인합니다.

1. GitHub Actions 수동 crawler가 성공합니다.
2. Supabase에 기업, 출처, 공고, revision이 생성됩니다.
3. `raw-snapshots` bucket에 원문 객체가 생성됩니다.
4. API `/health`와 `/api/postings`가 HTTP 200을 반환합니다.
5. Web 목록과 상세가 사용자 도메인에서 열립니다.
6. 공고에 공식 출처와 마지막 확인 시각이 표시됩니다.
7. 같은 내용을 다시 수집해도 revision 수가 증가하지 않습니다.

## 장애 확인

- 예약 수집은 GitHub Actions의 workflow run과 Summary를 확인합니다.
- API 연결 오류는 Supabase Transaction Pooler URL과 `DATABASE_POOL_MODE`를 확인합니다.
- crawler 연결 오류는 Session Pooler URL을 확인합니다.
- 원문 저장 오류는 S3 endpoint, region, key와 private bucket 이름을 확인합니다.
- GitHub Actions 예약은 혼잡할 때 늦게 시작할 수 있으므로 정각을 피합니다.
