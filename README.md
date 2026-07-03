# 이직핏

기업 공식 채용페이지의 IT·보안·게임·ROS 공고를 모아 검색하고, 출처와 변경 이력을 함께 보여주는 한국어 채용 정보 플랫폼입니다.

현재 저장소는 첫 번째 수직 슬라이스입니다. 그리팅 SSR과 Schema.org `JobPosting` JSON-LD를 읽고, 원문 스냅샷·공고 리비전·검색 색인을 저장한 뒤 목록과 상세 화면에 표시합니다.

## 수집 원칙

- 로그인 없이 공개된 기업 공식 채용페이지만 수집합니다.
- 인증, CAPTCHA, 접근 통제를 우회하지 않습니다.
- 401·403·CAPTCHA가 감지되면 해당 출처를 검토 상태로 바꿉니다.
- 한 번의 수집 실패로 기존 공고를 마감하지 않습니다.
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

개인별 관심 직무·스킬 핏, 신입·경력 조건 통계, 기업 발견, 공고-스킬 관계 그래프는 후속 단계에서 추가합니다. 상세 설계와 구현 계획은 [`docs/superpowers`](docs/superpowers)에 있습니다.
