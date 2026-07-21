# 기술 카탈로그와 공식 채용 출처 확장 설계

## 목적

현재 수집된 공식 공고에서 반복 등장하지만 아직 집계되지 않는 기술을 신뢰도
높게 보강하고, 실제 국내 기술 공고가 확인되는 기업을 추가한다. 카탈로그 변경은
배포 뒤 기존 공고 전체에 자동 반영되어야 하며, 기업 수를 늘리기 위해 비공식
목록이나 비어 있는 준비 상태를 만들지 않는다.

## 현재 확인한 상태

- 운영 API에는 1,700건이 넘는 공개 공고와 191개 실행 가능한 공식 출처가 있다.
- 기술 카탈로그는 79개 canonical 기술을 정의하지만, 기존 공고는 공고를 다시
  수집하기 전까지 새 기술로 재분석되지 않는다.
- 실제 공고 원문에는 Grafana, Airflow, Prometheus, Argo CD, Datadog,
  Databricks, MLflow, vLLM 같은 도구가 반복 등장한다.
- GitHub Actions의 push 경로는 source seed와 migration만 감시하고 기술
  카탈로그 변경은 감시하지 않는다.
- Bear Robotics 공식 Breezy 페이지에는 서울·창원 기반 로봇, 소프트웨어,
  플랫폼, 전자 공고가 다수 공개되어 있다.
- Atlassian 공식 careers JSON에는 한국 기반 Solutions Engineer 공고가
  공개되어 있고 설명·자격요건까지 포함되어 있다.

## 선택한 접근

### 1. 수동 승인 기술 카탈로그

본문 검색 횟수를 그대로 기술로 승격하지 않는다. `Gin`, `Lua`, `Oracle`처럼
일반 단어·회사명과 충돌할 수 있는 문자열이 있기 때문이다. 실제 공고 표본에서
기술 의미를 확인한 canonical 이름만 추가하고 별칭은 세 정책으로 나눈다.

- `distinct`: 제품명 자체로 충분히 구별되는 이름
- `contextual`: 같은 문장에 데이터, 쿠버네티스, 셸 등 기술 문맥이 있어야 확정
- `strict`: 대소문자와 기술 문맥을 모두 만족해야 확정

이번 확장 범위는 다음과 같다.

- 언어: Bash
- 프론트엔드·모바일: React Native, Vite, Webpack
- 백엔드: .NET, gRPC, RabbitMQ
- 인프라: Grafana, Prometheus, Datadog, Argo CD, GitHub Actions,
  GitLab CI, Jenkins, Ansible, Helm, Istio
- 데이터: Apache Airflow, Databricks, BigQuery, Apache Spark, Apache
  Flink, Apache Hive, dbt, Snowflake, Oracle, OpenSearch, ClickHouse
- AI: MLflow, Kubeflow, vLLM, Hugging Face, ONNX
- 임베디드: FPGA, Verilog

`Spark`, `Hive`, `Oracle`, `Snowflake`, `Helm`, `Bash`, `.NET`은 기술 문맥을
요구한다. `SystemVerilog`는 별도 수요가 충분히 쌓이기 전까지 Verilog의
명시적 별칭으로 집계한다.

### 2. 기존 공고 자동 재분석

카탈로그 또는 추출기 변경이 `main`에 push되면 production crawler workflow가
일반 백엔드 의존성만 설치하고 migration과 source seed를 수행한 뒤
`ejikfit backfill-skills`를 실행한다. 브라우저는 필요하지 않다. 정기 수집은
기존대로 6시간마다 새 공고와 변경 공고를 처리한다.

### 3. Bear Robotics용 Breezy 커넥터

Breezy의 서버 렌더링 목록에서 `/p/{id}-{slug}` 공고 링크, 지역, 고용 형태,
부서를 읽는다. 국내 위치이면서 기술 직무인 항목만 상세 페이지를 요청한다.
상세 페이지의 공개 `JobPosting` JSON-LD를 원문 설명으로 사용하여 필수·우대
기술 구분까지 보존한다.

목록이 성공적으로 파싱된 경우 필터 결과가 0건이어도 완전한 목록으로 취급하여
이전 공고를 정상적으로 reconciliation한다. 페이지 로그인, stealth, CAPTCHA
우회는 사용하지 않는다.

### 4. Atlassian 공식 JSON 커넥터

`https://www.atlassian.com/endpoint/careers/listings`의 공개 배열을 읽고,
한국 위치와 기술 직무를 동시에 만족하는 항목만 반환한다. `overview`,
`responsibilities`, `qualifications` HTML을 한 설명으로 합쳐 기술 근거를
보존한다. 현재 한국 공고가 없어지는 경우에도 성공한 빈 필터 결과로 처리하여
기존 공고를 닫을 수 있게 한다.

## 데이터 정확성 원칙

- 기술 추출은 단어 경계와 문맥 검사를 통과한 근거만 확정 수요에 포함한다.
- 새 기업은 공식 careers 원문만 사용한다.
- 국내 기술 역할만 포함하고 해외·영업·법무·마케팅 공고는 제외한다.
- 전체 목록의 완전성이 확인되지 않으면 누락 공고를 닫지 않는다.
- 기업 로고는 기존 공식 홈페이지 기반 로고 resolver와 이니셜 fallback을
  재사용하며 임의 브랜드 로고를 만들지 않는다.

## 검증 범위

모든 UI나 연결 코드를 TDD로 다루지 않는다. 회귀 위험이 큰 다음 부분만 자동화한다.

- 추가 기술의 canonical/category/metadata 계약
- 모호한 별칭의 긍정·부정 golden case
- Breezy 목록·상세 파싱과 해외/비기술 역할 제외
- Atlassian 한국 기술 역할 파싱과 상세 설명 보존
- source seed 메타데이터와 중복 방지
- catalog push 시 자동 backfill workflow 계약

마지막에는 전체 backend test, frontend type check/build, 두 공식 실데이터 preview를
실행한다.

## 비목표

- 검색 빈도만으로 기술 자동 등록
- 전체 해외 공고 수집
- 비공식 채용 플랫폼의 복제 공고 수집
- 접근 제한 우회
- 이번 묶음에서 프로필 기반 공고 매칭 구현
