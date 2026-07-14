# 시장 화면 서비스 UI 리디자인 구현 계획

> 실행 기준: 이 계획은 실제 API 계약과 기존 오류·빈 상태를 보존한 채, `/market`의 정보 밀도와 반응형 탐색성을 개선한다.

**목표:** 큰 랜딩 페이지처럼 보이는 현재 시장 화면을 실제 커리어 서비스의 데이터 탐색 화면으로 바꾸고, 390×844 첫 화면 안에서 핵심 표본 수와 첫 기술 수요 항목까지 확인할 수 있게 한다.

**범위:** `MarketOverview`의 정보 순서와 CSS, 관련 단위·스타일·Playwright 계약만 수정한다. 시장 모델, API 호출, 수치 계산, 필터 쿼리 계약은 변경하지 않는다.

**데이터 원칙:** 공고 수, 기술 수, 필수·우대·미분류 수, 최근 확인일, 공고 내용은 기존 API 응답에서만 가져온다. 비교 기간이 없으므로 변화율·증감 화살표·예측 문구를 만들지 않는다.

---

## 1. 현재 문제와 디자인 결정

현재 운영 화면에서 확인한 문제:

- 데스크톱 제목이 약 60px이고 상단 여백이 커서 데이터 도구보다 홍보 랜딩처럼 보인다.
- 모바일에서 14개 기술 분야가 여러 줄로 펼쳐지고 지표도 세로로 쌓여, 첫 화면에 기술 수요가 보이지 않는다.
- 현재 적용 범위 배지와 설명이 중복되고, 필터가 핵심 수치보다 먼저 나온다.
- 기술 수요와 최근 공고의 내용은 신뢰할 만하지만 상단 정보량 때문에 접근이 늦다.

적용할 결정:

- 페이지 폭과 제목 크기는 공고 탐색 화면의 공통 서비스 토큰에 맞춘다.
- DOM 순서를 소개, 시장 지표, 필터, 결과 순으로 바꾼다.
- 지표 3개는 모바일에서도 3열을 유지하고 숫자 크기를 줄인다.
- 모바일 분야·경력 필터는 각각 한 줄 가로 스크롤로 제공한다. 각 링크의 44px 터치 영역은 유지한다.
- 필터 컨테이너는 얕은 구분선과 작은 간격을 사용하며 새로운 장식 카드나 그래프는 추가하지 않는다.
- 기술 수요 패널과 최근 공고 패널은 현재 API 데이터와 링크를 그대로 유지하되 패딩과 행 높이를 압축한다.
- 긴 한글 값은 단어 단위로 줄바꿈하고 가로 오버플로는 허용하지 않는다.

## 2. 테스트 우선으로 서비스 밀도 계약 추가

**수정 파일**

- `apps/web/src/features/market/market-overview.styles.test.ts`
- `apps/web/e2e/market-overview.e2e.ts`

스타일 테스트에 다음 실패 계약을 먼저 추가한다.

- 페이지 제목이 `var(--type-page-title)`을 사용한다.
- 모바일에서도 `.metrics`가 3열을 유지한다.
- 모바일 `.filters`가 `flex-wrap: nowrap`, `overflow-x: auto`를 사용한다.
- 필터와 스킬 링크의 기존 44px 터치 영역은 유지한다.

Playwright 테스트는 1440×900과 390×844에서 다음을 확인한다.

- 필터 선택과 API 기반 수치는 기존대로 유지된다.
- 모바일 분야·경력 필터는 각각 한 행 높이 안에 있고 가로 탐색이 가능하다.
- 첫 기술 수요 링크가 스크롤 전 뷰포트 안에 들어온다.
- 제목 크기가 데스크톱과 모바일에서 34px 이하이다.
- 문서 가로 오버플로와 콘솔 오류가 없다.

실패 확인 명령:

```bash
npm test -- --run src/features/market/market-overview.styles.test.ts
npm run test:e2e -- e2e/market-overview.e2e.ts --reporter=line
```

예상 결과: 새 밀도·첫 화면 계약이 현재 구현에서 실패한다.

## 3. 시장 상단 정보 구조 재배치

**수정 파일**

- `apps/web/src/features/market/market-overview.tsx`

구현 내용:

- 기존 소개 내용은 유지하되 중복 배지를 간결한 현재 범위 표현으로 바꾼다.
- `현재 시장 스냅샷`의 `dl`을 필터보다 먼저 배치한다.
- 필터 섹션을 하나의 명확한 `aria-labelledby` 영역으로 묶는다.
- 기술 분야와 경력 조건 내비게이션의 기존 `aria-current`, 링크 URL, 모든 라벨은 유지한다.
- 오류·빈 상태·방법론·최근 공고의 의미와 DOM 접근성을 보존한다.

검증 명령:

```bash
npm test -- --run src/features/market/market-overview.test.tsx src/app/market/page.test.tsx
```

## 4. 컴팩트 반응형 스타일 구현

**수정 파일**

- `apps/web/src/features/market/market-overview.module.css`

데스크톱:

- 최대 폭을 80rem, 상단 패딩을 1.75rem 수준으로 맞춘다.
- 제목은 공통 32px 페이지 제목 토큰을 사용한다.
- 지표는 3열 얕은 스트립으로 만들고 값은 16~18px 범위로 낮춘다.
- 필터는 작은 레이블과 링크 행으로 구성하고 결과 패널까지의 간격을 줄인다.
- 기술 수요 행과 최근 공고 행의 패딩·폰트 크기를 공고 화면 밀도와 맞춘다.

모바일:

- 페이지 패딩은 1rem, 제목은 28px 이하로 유지한다.
- 지표는 3열, 각 셀은 짧은 레이블과 한 줄 값으로 구성한다.
- 각 필터 행은 44px 높이의 가로 스크롤 영역으로 만들고 스크롤바는 시각적으로 최소화한다.
- 첫 기술 수요 행이 390×844 뷰포트 안에 보이도록 상단 간격을 조정한다.
- 기술 행은 이름·분류·공고 링크와 수요 근거가 자연스럽게 두 행으로 정리되도록 한다.

검증 명령:

```bash
npm test -- --run src/features/market/market-overview.styles.test.ts src/features/market/market-overview.test.tsx
npm run lint
npm run test:e2e -- e2e/market-overview.e2e.ts --reporter=line
```

## 5. 실제 브라우저 시각 점검과 세부 보정

로컬 fixture API와 Next 개발 서버를 실행하고 다음 화면을 캡처한다.

- `/market` 1440×900
- `/market` 390×844
- `/market?category=infra&career_type=experienced` 820×900
- 같은 필터 390×844

확인 항목:

- 데스크톱에서 제목·필터·지표가 과도하게 비어 있지 않은가.
- 모바일 첫 화면에서 지표와 첫 기술 수요가 실제로 보이는가.
- 가로 필터가 다른 페이지의 가로 오버플로를 만들지 않는가.
- 선택된 분야·경력 상태가 스크롤 행에서도 분명한가.
- 긴 기술명과 공고 제목이 잘리거나 한 글자 고아 줄을 만들지 않는가.
- 하단 내비게이션이 마지막 콘텐츠를 가리지 않는가.

시각 점검에서 발견한 실제 문제는 테스트 계약을 추가한 뒤 수정한다.

## 6. 전체 검증, 리뷰, 병합 및 배포

최종 검증:

```bash
npm test -- --run --reporter=dot
npm run lint
VERCEL=1 VERCEL_ENV=production \
  VERCEL_PROJECT_PRODUCTION_URL=ejik-fit-web.vercel.app \
  API_BASE_URL=https://ejik-fit-api.vercel.app \
  npm run build
npm run test:e2e -- --reporter=line
git diff --check
```

완료 조건:

- 모든 단위 테스트, TypeScript, 프로덕션 빌드, 전체 Playwright가 통과한다.
- 코드 리뷰에서 중요도 높은 문제가 남지 않는다.
- `main`에 fast-forward 병합하고 원격 푸시한다.
- 웹과 API Vercel 상태가 성공인지 확인한다.
- 운영 `/market`을 1440×900과 390×844에서 다시 캡처해 실제 API 수치와 레이아웃을 확인한다.

