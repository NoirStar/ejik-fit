# 이직핏 Supabase·Vercel 운영 배포 설계

## 목표

이직핏의 첫 운영 환경을 낮은 비용으로 구성한다. 사용자가 사이트를 방문하지 않아도 기업 공식 채용페이지를 6시간마다 원격 수집하고, 웹과 API는 한국 사용자가 빠르게 조회할 수 있어야 한다.

운영 수집은 로컬 컴퓨터에 의존하지 않는다. 로컬 Docker 환경은 개발과 테스트에만 사용한다.

## 선택한 구조

```text
사용자
  │
  ▼
Vercel Next.js Web ──▶ Vercel FastAPI ──▶ Supabase PostgreSQL
                                              ▲
                                              │
GitHub Actions (6시간마다) ──▶ Python crawler ├──▶ Supabase Storage
```

- Vercel은 Next.js 웹과 FastAPI 읽기 API를 각각 별도 프로젝트로 배포한다.
- Supabase는 PostgreSQL 운영 데이터베이스와 비공개 원문 HTML 저장소를 제공한다.
- GitHub Actions는 기존 Python 수집기를 6시간마다 실행한다.
- 운영 환경에서는 Redis, Celery, MinIO, Meilisearch를 사용하지 않는다.
- 로컬 Docker Compose는 현재 개발 경험과 통합 테스트를 위해 유지한다.

이 구조는 현재 코드를 재사용하면서 상시 서버 비용을 제거한다. 전용 worker와 별도 검색엔진은 수집 시간이 20분을 지속적으로 넘거나, 열린 공고가 수만 건으로 증가하거나, 예약 실행 지연이 제품 요구사항을 침해할 때 도입한다.

## 대안과 선택 이유

### Next.js에서 Supabase 직접 조회

네트워크 홉은 하나 줄지만 읽기 정책과 통계 로직이 프론트엔드와 데이터베이스 함수로 분산된다. 이후 스킬 통계, 핏 계산, 관계 그래프 API를 확장하기 어려워 선택하지 않는다.

### 상시 API·worker 컨테이너

지연시간과 예약 정확도는 가장 좋지만 초기 단계부터 월 비용과 운영 대상이 늘어난다. 현재 수집량과 6시간 주기에는 과도하다.

### Supabase Edge Function 수집

기존 Python 수집기를 TypeScript/Deno로 다시 작성해야 하고 함수 실행시간과 CPU 제한에 맞춰 작업을 세분화해야 한다. 코드 중복과 운영 복잡도가 커져 선택하지 않는다.

## 리전과 연결

- Supabase 프로젝트는 가능하면 서울 리전을 선택한다.
- Vercel Functions도 서울 또는 가장 가까운 지원 리전에서 실행한다.
- Vercel FastAPI는 Supabase의 Transaction Pooler 연결 문자열을 사용한다.
- GitHub Actions의 마이그레이션과 수집은 Session Pooler 연결 문자열을 사용한다.
- SQLAlchemy는 서버리스 API에서 애플리케이션 연결 풀과 prepared statement를 비활성화해 transaction pooling과 충돌하지 않게 한다.

운영 환경은 용도별 데이터베이스 URL을 구분한다.

- `DATABASE_URL`: Vercel API용 Transaction Pooler
- `CRAWLER_DATABASE_URL`: GitHub Actions용 Session Pooler

## 검색

운영 검색은 PostgreSQL을 기준 저장소이자 검색 백엔드로 사용한다.

1. 제목, 기업명, 본문, 근무지, 경력 유형을 검색한다.
2. Supabase 운영 DB에서는 PGroonga 확장과 한국어 전문 검색 인덱스를 활성화한다.
3. PGroonga를 제공하지 않는 로컬 PostgreSQL에서는 같은 API 인터페이스가 인덱스 기반 부분 일치 검색으로 대체한다.
4. Meilisearch 장애 전환 코드는 로컬 호환성을 위해 남기되 운영 설정에서는 호출하지 않는다.

검색 구현은 환경변수로 백엔드를 명시하며, 운영 기본값은 PostgreSQL이다. 외부 검색엔진 연결 실패를 정상 제어 흐름으로 사용하지 않는다.

## 원문 저장

Supabase Storage의 S3 호환 엔드포인트를 사용한다. 기존 `boto3` 스냅샷 저장 코드는 다음 운영 환경변수만 교체한다.

- `S3_ENDPOINT_URL`
- `S3_REGION`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`

`raw-snapshots` 버킷은 비공개로 유지한다. S3 접근키는 GitHub Actions에만 저장하며 브라우저와 Vercel Web에는 전달하지 않는다. 원문 객체 키는 현재와 같이 SHA-256 해시를 기반으로 하므로 같은 HTML을 다시 저장하지 않는다.

## 원격 수집 흐름

GitHub Actions workflow는 다음 두 방식으로 실행한다.

- `schedule`: 매 6시간, 정각을 피한 17분에 실행
- `workflow_dispatch`: 운영자가 수동 실행

한 실행의 순서는 다음과 같다.

1. 저장소를 checkout하고 Python 3.12를 준비한다.
2. 백엔드 패키지를 설치한다.
3. Alembic migration을 적용한다.
4. 초기 공식 출처를 멱등하게 seed한다.
5. 허용 상태인 모든 출처를 순차 수집한다.
6. 출처별 성공·실패·발견·변경·마감 수를 Actions Summary에 기록한다.
7. 하나의 출처 실패는 나머지 출처 수집을 중단하지 않지만 전체 실행은 부분 실패로 표시한다.

workflow에는 같은 환경의 중복 실행을 막는 concurrency group을 둔다. 실행 중 새 예약이 들어오면 기존 실행을 취소하지 않고 새 실행이 대기한다.

## 수집 안전성과 오류 처리

- 로그인이나 CAPTCHA를 우회하지 않는다.
- 401, 403, 접근 challenge는 해당 출처를 검토 상태로 전환한다.
- 목록 요청 자체가 실패하면 누락 횟수를 증가시키지 않는다.
- 정상 목록에서 3회 연속 사라진 공고만 마감한다.
- 변경되지 않은 공고는 새 revision을 만들지 않는다.
- 네트워크 오류는 제한된 횟수만 지수 백오프로 재시도한다.
- Actions 실행 결과와 출처별 오류는 비밀값을 제거한 뒤 로그와 Summary에 남긴다.

## 보안

- GitHub Actions secrets에는 crawler용 DB와 Storage 자격증명만 저장한다.
- Vercel API에는 읽기 API용 DB URL만 저장한다.
- Vercel Web에는 서버 전용 `API_BASE_URL`만 저장한다.
- Supabase S3 access key와 DB 비밀번호를 `NEXT_PUBLIC_*` 변수로 만들지 않는다.
- Storage bucket은 private으로 유지한다.
- 공개 웹은 원문 HTML을 직접 렌더링하지 않고 정규화된 텍스트만 표시한다.
- 운영 secret은 저장소, Actions 로그, 빌드 결과물에 포함하지 않는다.

## Vercel 프로젝트와 도메인

Vercel에는 같은 GitHub 저장소로 프로젝트 두 개를 만든다.

### Web

- Root Directory: `apps/web`
- Framework: Next.js
- 환경변수: `API_BASE_URL=https://api.<사용자-도메인>`
- 사용자 도메인의 apex 또는 `www`를 연결한다.

### API

- Root Directory: `packages/backend`
- Framework: FastAPI
- 환경변수: `DATABASE_URL`, `SEARCH_BACKEND=postgres`
- `api.<사용자-도메인>`을 연결한다.

DNS 레코드의 실제 값은 Vercel이 도메인 등록 시 제시하는 값을 사용한다. apex와 `www` 중 사용자가 선택한 하나를 canonical host로 삼고 다른 하나는 redirect한다.

## Supabase 배포

Supabase 프로젝트를 만든 뒤 다음 순서로 준비한다.

1. GitHub Actions에서 사용할 Session Pooler URL을 발급한다.
2. Vercel API에서 사용할 Transaction Pooler URL을 발급한다.
3. Alembic migration을 적용한다.
4. `raw-snapshots` private bucket과 S3 access key를 만든다.
5. GitHub repository secrets를 등록한다.
6. `workflow_dispatch`로 첫 원격 수집을 실행한다.
7. 수집된 공고와 원문 객체를 확인한 뒤 예약 workflow를 활성화한다.

## 테스트와 배포 검증

코드 수준 검증:

- crawler 전체 출처 실행과 부분 실패 테스트
- PostgreSQL 검색 백엔드 테스트
- transaction pooling 설정 테스트
- Actions workflow 정적 검사
- secret 누출 검사
- 기존 백엔드·웹 전체 테스트

운영 검증:

- GitHub Actions 수동 수집 성공
- 두 번째 수집에서 동일 공고 revision 수가 유지됨
- Vercel API `/health`와 `/api/postings` 응답
- Vercel Web 목록·상세 응답
- 사용자 도메인 HTTPS와 canonical redirect
- 공식 출처 URL과 마지막 확인 시각 노출

## 비용과 확장 기준

초기에는 Vercel, Supabase, GitHub Actions의 무료 또는 저비용 범위에서 운영한다. 요금제별 제공량은 바뀔 수 있으므로 실제 프로젝트 생성 시 대시보드의 현재 한도를 확인한다.

다음 중 하나가 발생하면 전용 worker와 검색 서비스를 검토한다.

- 수집 실행이 반복적으로 20분을 넘는다.
- GitHub Actions 예약 지연이 사용자에게 영향을 준다.
- 열린 공고가 수만 건을 넘어 PostgreSQL 검색 지연이 확인된다.
- 소스별 병렬 처리와 정교한 재시도 큐가 필요하다.

확장은 기존 connector, ingestion, search 인터페이스를 유지한 채 실행기와 검색 구현만 교체한다.

## 완료 조건

- 운영 수집이 로컬 컴퓨터 없이 6시간마다 실행된다.
- 운영 데이터와 원문 스냅샷이 Supabase에 저장된다.
- Vercel의 Web과 API가 사용자 도메인에서 HTTPS로 동작한다.
- 운영 환경에 Redis, Celery, MinIO, Meilisearch 의존성이 없다.
- 전체 테스트와 첫 원격 수집, 중복 수집 검증이 통과한다.
