# 스킬 요구사항 그래프와 Fit 분석 설계

작성일: 2026-07-06

## 1. 제품 목표

ejik의 핵심 기능은 공고를 많이 모으는 것 자체가 아니라, 회사들이 실제로
무엇을 요구하는지와 사용자가 가진 기술에서 어떤 준비를 더 해야 “fit한 인재”에
가까워지는지를 한눈에 보여주는 것이다.

이번 기능은 사용자가 보유 스킬을 입력하거나 특정 스킬을 클릭했을 때, 실제
채용공고에서 함께 등장한 스킬·분야·공고 근거를 Obsidian처럼 동적인 관계
그래프로 탐색하게 만든다. 예를 들어 `C++`를 선택하면 단순히 C++ 공고 목록을
보여주는 것이 아니라 `ROS`, `Python`, `SLAM`, `Linux`, `Rust`, `Go`처럼
현업 공고에서 함께 요구되는 주변 기술과 로보틱스·게임·AI·임베디드·백엔드
분기까지 함께 보여준다.

이 기능은 다음 판단을 가능하게 해야 한다.

- 내가 가진 스킬이 어떤 직무·산업 분야와 연결되는가.
- 그 분야의 공고는 어떤 스킬 조합을 필수 또는 우대로 요구하는가.
- 내가 이미 충족한 요구사항과 부족한 인접 스킬은 무엇인가.
- 어떤 기술을 추가로 준비하면 실제 공고 커버리지가 늘어나는가.
- 게임 + AI + 보안처럼 하나의 공고에 여러 분야가 섞인 경우에도 관계가
  사라지지 않고 복수 도메인으로 표현되는가.

## 2. 현재 상태와 검증 결과

현재 구현은 공고별 확정 스킬을 `posting_skills`에 저장하고, 각 스킬에 대해
`required`, `preferred`, `unspecified`, `evidence_text`, `confidence`,
`match_reason`을 보존한다. `C`, `C++`, `Go`, `R`, `Rust`처럼 오탐 위험이 있는
기술명은 문맥 기반으로 분류하며, 낮은 신뢰도 후보는 저장하되 공개 통계와 기본
UI에서는 제외한다.

2026-07-06 운영 API를 읽기 전용으로 확인한 결과:

- API 상태: 정상
- 최신 100개 공고 상세 샘플 중 확정 스킬이 있는 공고: 49개
- 샘플 내 고유 확정 스킬: 38개
- 관계 예시:
  - `C++` → `ROS`, `Python`, `Rust`, `Go`, `Java`, `C`
  - `Python` → `Kubernetes`, `Go`, `Docker`, `SQL`, `TensorFlow`
  - `ROS` → `C++`, `Python`, `SLAM`, `Linux`

따라서 그래프를 만들 기본 관계 데이터는 이미 존재한다. 다만 현재 사전은
웹·백엔드·인프라·일부 AI/게임/로보틱스 중심이며, 전문 도구와 직무 개념이
부족하다. 실제 운영 공고 본문에는 `Blender`, `Photoshop`, `Illustrator`,
`Jira`, `MLOps`, `Feature Store`, `LLM`, `ML 서빙` 같은 요구사항이 있었지만
현재 확정 스킬로 잡히지 않는 경우가 있다.

이 기능의 성공 여부는 그래프 라이브러리보다 데이터 해석 품질에 더 크게
좌우된다.

## 3. 채택 접근법

### 3.1 검토한 접근법

1. **공고-스킬 이분 그래프**
   - 장점: 실제 근거가 가장 직접적이다.
   - 단점: 공고가 늘수록 화면이 빠르게 지저분해진다.

2. **집계된 스킬-스킬 그래프 + 근거 공고 패널**
   - 장점: 사용자가 준비해야 할 주변 기술을 빠르게 볼 수 있고, 클릭 시 실제
     공고 근거를 확인할 수 있다.
   - 단점: 관계 점수 계산이 필요하다.

3. **임베딩 또는 LLM 기반 의미 그래프**
   - 장점: 표현이 다양해져도 유연하다.
   - 단점: 근거 추적과 재현성이 약해지고, 초기 제품에는 과하다.

### 3.2 결정

첫 버전은 **집계된 스킬-스킬 그래프 + 근거 공고 패널**로 만든다. 관계는 AI가
상상하지 않고 실제 확정 스킬의 공고 동시등장과 필수·우대 근거에서 계산한다.
공고 노드는 기본 그래프에 직접 뿌리지 않고, 사용자가 노드나 edge를 선택했을 때
오른쪽 패널 또는 하단 시트에서 근거 공고로 보여준다.

## 4. 데이터 모델 확장

현재 단일 `category`만으로는 `C++`, `CUDA`, `OpenCV`, `ROS`, `Unity`처럼 여러
분야에 걸친 기술을 표현하기 어렵다. 스킬 사전을 다음 구조로 확장한다.

```text
SkillDef
  canonical_name
  aliases
  kind
  domains[]
  ecosystem[]
  confidence_rules
```

### 4.1 kind

`kind`는 기술의 성격을 나타내며 하나의 대표값을 가진다.

- `language`
- `framework`
- `library`
- `engine`
- `platform`
- `protocol`
- `database`
- `cloud`
- `tool`
- `professional_tool`
- `standard`
- `certification`
- `practice`
- `hardware`

예:

- `C++`: `language`
- `ROS`: `framework`
- `Unity`: `engine`
- `Blender`: `professional_tool`
- `OWASP`: `standard`
- `MLOps`: `practice`
- `CAN`: `protocol`

### 4.2 domains

`domains`는 복수값이다. 하나의 스킬이나 공고가 여러 분야에 걸칠 수 있어야
혼합 공고를 표현할 수 있다.

초기 도메인 집합:

- `backend`
- `frontend`
- `web`
- `mobile`
- `cloud`
- `devops`
- `data`
- `ai`
- `computer_vision`
- `mlops`
- `security`
- `game`
- `graphics`
- `high_performance`
- `robotics`
- `autonomy`
- `embedded`
- `automotive`
- `hardware`
- `fintech`
- `qa`
- `design`
- `product`

예:

- `C++`: `[game, graphics, robotics, autonomy, embedded, backend, ai]`
- `CUDA`: `[ai, graphics, high_performance]`
- `OpenCV`: `[ai, computer_vision, robotics, graphics]`
- `ROS`: `[robotics, autonomy, embedded]`
- `Unity`: `[game, graphics]`
- `Jira`: `[product, qa, devops]`
- `OWASP`: `[security, web]`

도메인 작업 자체가 별도 대형 기능으로 커지는 것을 막기 위해, 첫 버전은
“완벽한 직무 분류기”가 아니라 그래프와 Fit 분석에 필요한 최소 온톨로지로
제한한다. 새 스킬은 운영 공고에서 관찰된 근거와 골든 테스트가 있을 때
안전하게 추가한다.

### 4.3 PostingSkillEvidence

현재 `posting_skills`의 근거 필드는 유지하되, 그래프 계산이 명확해지도록
개념적으로 다음 정보를 사용한다.

```text
posting_id
canonical_skill
requirement_type: required | preferred | unspecified
confidence
evidence_text
match_reason
```

첫 구현에서는 기존 `posting_skills.skill`의 canonical string을 유지하고,
스킬 사전의 `kind`, `domains`, `aliases` 메타데이터를 코드 레벨에서 결합한다.
정규화된 `skills`, `skill_aliases`, `skill_domains` 테이블은 공고량과 관리
요구가 커지는 다음 단계에서 도입한다. 공개 API는 기존 `skills: string[]`
계약을 깨지 않는다.

## 5. 관계 점수 설계

그래프 edge는 단순 동시등장 횟수만으로 만들지 않는다. `Python`, `Linux`,
`Docker`, `Git` 같은 허브 스킬은 많은 곳에 등장하므로 모든 것을 연결해버릴 수
있다.

edge 점수는 다음 요소를 조합한다.

```text
score(A, B)
  = cooccurrence_weight
  * requirement_weight
  * directional_relevance
  * hub_damping
  * evidence_confidence
```

### 5.1 cooccurrence_weight

열린 공고에서 두 스킬이 함께 확정된 횟수다. 낮은 표본의 과신을 막기 위해
최소 근거 공고 수를 응답에 포함한다. 근거가 1건뿐인 edge는 기본 화면에서
약한 선으로 표시한다.

### 5.2 requirement_weight

공고에서 두 스킬이 어떤 요구 수준으로 등장했는지를 반영한다.

- `required + required`: 가장 강함
- `required + preferred`: 중간
- `preferred + preferred`: 낮음
- `unspecified` 포함: 더 낮음

사용자가 “무엇을 준비해야 하는지”를 보려면 필수 요구사항과 단순 언급을
분리해야 한다.

### 5.3 directional_relevance

`A`를 선택한 사람이 `B`를 볼 때 중요한 것은 전체 빈도보다 조건부 관련성이다.

예:

- `P(B | A)`: A가 있는 공고 중 B도 있는 비율
- `P(A | B)`: B가 있는 공고 중 A도 있는 비율

그래프에는 seed 기준 방향성을 반영한 `relevance`를 함께 내려준다. edge 자체는
무방향으로 렌더링하되, 추천 목록에서는 seed 기준 관련성을 사용한다.

### 5.4 hub_damping

너무 흔한 스킬은 관계 점수를 감쇠한다. 감쇠 대상은 전체 공고 등장 빈도와 도메인
범용성을 기준으로 판단한다. 단, 허브 스킬을 제거하지는 않는다. `Linux`나
`Docker`가 실제로 필수인 분야가 있으므로 edge를 흐리게 하거나 순위를 낮추는
방식으로 처리한다.

## 6. Fit 분석

사용자는 로그인 없이 보유 스킬을 입력할 수 있다. 첫 버전은 브라우저
`localStorage`에 보유 스킬을 저장한다.

Fit 분석은 “취업 확률”처럼 과장하지 않고 **공고 요구사항 커버리지**로 표현한다.

### 6.1 입력

- 사용자가 직접 입력한 보유 스킬
- 그래프에서 클릭해 추가한 스킬
- 선택 필터:
  - 신입/경력
  - 도메인
  - 지역 또는 회사 필터는 첫 버전에서는 선택 사항

### 6.2 출력

- 보유 스킬과 직접 연결된 도메인
- 보유 스킬이 커버하는 공고 수
- 필수 요구사항 중 충족한 항목
- 필수 요구사항 중 부족한 항목
- 우대 요구사항 중 추가하면 좋은 항목
- “한 단계 거리” 추천 스킬
- 관련 공고 근거

예:

```text
입력: C++

주요 분기:
- 로보틱스/자율주행: ROS, Python, SLAM, Linux
- 게임/그래픽스: Unity, Unreal Engine, graphics tools
- 고성능 백엔드: Go, Rust, Java, Kafka
- AI/컴퓨터비전: Python, PyTorch, OpenCV, CUDA

다음 준비 후보:
- ROS: C++ 공고 중 로보틱스 분기에서 강한 필수 관계
- Python: C++와 AI/로보틱스 공고에서 반복 등장
- Linux: 임베디드·로보틱스 공고에서 필수 기반
```

## 7. API 설계

### 7.1 그래프 API

```http
GET /api/graph/skills?seed=C%2B%2B&limit=30&career_type=new_comer
```

응답 개념:

```json
{
  "seed": "C++",
  "nodes": [
    {
      "id": "C++",
      "label": "C++",
      "kind": "language",
      "domains": ["game", "robotics", "embedded"],
      "demand_count": 6,
      "required_count": 6,
      "preferred_count": 0,
      "owned": true
    }
  ],
  "edges": [
    {
      "id": "C++::ROS",
      "source": "C++",
      "target": "ROS",
      "score": 0.82,
      "cooccurrence_count": 3,
      "required_pair_count": 2,
      "supporting_posting_ids": ["..."]
    }
  ],
  "evidence": [
    {
      "posting_id": "...",
      "title": "[Autonomy] Planning & Control Engineer",
      "company_name": "뉴빌리티",
      "skills": ["C++", "ROS", "Linux"],
      "requirement_summary": {
        "required": ["C++", "ROS", "Linux"],
        "preferred": []
      }
    }
  ],
  "meta": {
    "limit": 30,
    "min_confidence": 0.8,
    "generated_at": "2026-07-06T00:00:00Z"
  }
}
```

### 7.2 Fit 분석 API

```http
POST /api/fit/analyze
```

요청:

```json
{
  "owned_skills": ["C++", "Python"],
  "career_type": "new_comer",
  "domains": ["robotics", "ai"]
}
```

응답 개념:

```json
{
  "coverage": {
    "matching_posting_count": 12,
    "strong_fit_posting_count": 4
  },
  "domain_branches": [
    {
      "domain": "robotics",
      "covered_skills": ["C++", "Python"],
      "missing_required_skills": ["ROS", "Linux"],
      "missing_preferred_skills": ["SLAM"]
    }
  ],
  "recommended_next_skills": [
    {
      "skill": "ROS",
      "reason": "C++ 보유자에게 로보틱스 공고에서 반복적으로 요구됨",
      "required_count": 2,
      "supporting_posting_count": 3
    }
  ]
}
```

## 8. 프론트엔드 경험

### 8.1 화면 구조

첫 버전은 `/skills/graph` 페이지를 추가한다.

- 상단: 스킬 검색/자동완성, 보유 스킬 칩
- 중앙: 동적 관계 그래프
- 오른쪽 패널: 선택한 노드/edge의 근거, 부족 스킬, 관련 공고
- 모바일: 오른쪽 패널 대신 하단 시트
- 접근성 fallback: 그래프와 같은 데이터를 목록으로도 제공

### 8.2 그래프 상호작용

- seed 또는 보유 스킬은 중앙에 크게 표시한다.
- 관련 노드는 최대 30개로 시작한다.
- 노드 크기: 수요 공고 수
- edge 굵기: 관계 점수
- 색상: 대표 도메인
- 점선 또는 흐린 선: 근거가 약한 관계
- hover: 직접 연결된 노드와 edge만 강조
- click: 해당 스킬을 중심으로 그래프 확장
- drag: 사용자가 노드를 끌 수 있음
- “내 스킬에 추가” 버튼 제공

### 8.3 애니메이션

Obsidian처럼 살아 움직이는 느낌은 주되, 계속 흔들려서 읽기 어려운 화면은
피한다.

- 첫 진입 시 seed 중심으로 결정적 radial 초기 좌표를 배치한다.
- ForceAtlas2 worker를 800~1500ms 정도 실행한 뒤 정지한다.
- 새 노드는 클릭한 노드 주변에서 나타나 자연스럽게 자리 잡는다.
- 카메라는 클릭 시 350~500ms로 이동한다.
- 사용자가 드래그 중일 때는 레이아웃을 일시 정지한다.
- `prefers-reduced-motion` 사용자는 정적 배치로 렌더링한다.
- WebGL을 사용할 수 없는 환경에서는 관계 목록 fallback을 표시한다.

### 8.4 그래프 기술 선택

Sigma.js v3 + React Sigma + Graphology + Graphology ForceAtlas2 worker를 사용한다.

선택 이유:

- Sigma.js v3는 Graphology와 함께 브라우저 그래프 렌더링과 상호작용을 제공한다.
- React Sigma는 `SigmaContainer`와 hooks를 통해 React에서 Sigma 인스턴스와
  Graphology 그래프를 다룰 수 있다.
- ForceAtlas2는 worker 실행을 지원해 레이아웃 계산을 UI 스레드에서 분리할 수
  있다.
- Sigma v4는 별도 beta 사이트로 운영되고 있어 핵심 기능의 첫 구현에는 안정
  라인인 v3를 사용한다.

구현 시 `SigmaContainer`의 `graph`와 `settings` props를 자주 바꾸지 않는다.
React Sigma 문서상 해당 props 변경은 인스턴스 재생성을 유발할 수 있으므로,
Graphology 그래프를 hooks로 갱신하는 방식으로 카메라 상태와 성능을 보존한다.

참고 문서:

- Sigma.js v3: https://www.sigmajs.org/
- React Sigma introduction: https://sim51.github.io/react-sigma/docs/start-introduction/
- Graphology ForceAtlas2: https://graphology.github.io/standard-library/layout-forceatlas2.html
- Sigma v4 beta site: https://v4.sigmajs.org/

## 9. 전문 도구와 넓은 분야 커버리지

첫 구현부터 “프로그래밍 언어 몇 개”만 보여주면 사용자가 원하는 직무 지도가
되지 않는다. 따라서 스킬 사전 확장은 다음 분야를 우선 포함한다.

### 9.1 로보틱스/임베디드/자율주행

- ROS, ROS2, SLAM, Gazebo
- C, C++, Python
- Linux, RTOS
- CAN, UART, SPI, I2C
- OpenCV

### 9.2 게임/그래픽스

- Unity, Unreal Engine
- C#, C++
- Blender, Maya, 3ds Max
- Photoshop, Illustrator
- DirectX, OpenGL, Vulkan

### 9.3 AI/ML/MLOps

- Python, R, SQL
- PyTorch, TensorFlow
- LLM, RAG, LangChain
- MLOps, Feature Store, model serving
- CUDA, OpenCV

### 9.4 보안

- OWASP, SIEM, Wireshark
- 취약점 진단, 모의해킹, 침해대응
- IAM, SSO, OAuth, JWT
- Linux, Python, cloud security

### 9.5 협업/QA/전문 도구

- Jira, Confluence, Notion
- Figma
- GitHub, GitLab
- QA, test automation, Selenium, Playwright

이 목록은 “완성된 전 세계 기술 사전”이 아니라 초기 그래프 품질을 올리기 위한
시드 팩이다. 새 항목은 다음 조건을 만족해야 한다.

- 실제 수집 공고에서 등장한다.
- 별칭과 오탐 위험을 정의한다.
- 필요한 경우 양성/음성 골든 테스트를 추가한다.
- 하나 이상의 `kind`와 복수 `domains`를 가진다.

## 10. 혼합 공고 처리

한 공고가 여러 분야를 동시에 가질 수 있어야 한다.

예:

- 게임 + AI: 게임 데이터 사이언티스트, 추천 시스템, 광고 최적화
- 게임 + 보안: 게임 서버 보안, 안티치트
- AI + 로보틱스: Physical AI, Computer Vision, SLAM
- 임베디드 + 보안: IoT 보안, 펌웨어 보안

공고의 도메인은 공고에 등장한 스킬들의 `domains`를 합산해 계산한다. 한 공고에
`Unity`, `Python`, `PyTorch`, `AWS`가 함께 있으면 게임, AI, cloud가 모두
표시된다. 그래프에서는 노드가 하나의 대표색을 갖더라도 상세 패널에는 복수
도메인을 모두 보여준다.

## 11. 오류 처리와 빈 상태

- seed 스킬이 사전에 없으면 유사 별칭과 검색 가능한 공고 키워드를 제안한다.
- 관련 edge가 부족하면 “현재 수집 공고에서는 강한 관계가 아직 부족함”을 명시하고
  해당 스킬이 등장한 공고 목록을 보여준다.
- 낮은 신뢰도 스킬은 기본 그래프에서 제외하되, 디버그 또는 관리자 확인용으로
  보존한다.
- API 응답은 최대 노드 수와 최대 근거 공고 수를 제한한다.
- 그래프 렌더링 실패 또는 WebGL 미지원 시 같은 데이터를 표/목록으로 보여준다.
- 데이터가 적은 도메인은 “표본 부족”을 표시해 사용자가 관계를 과신하지 않게
  한다.

## 12. 테스트 전략

### 12.1 백엔드

- 스킬 사전 확장 테스트
  - 모든 스킬은 `kind`와 하나 이상의 `domains`를 가진다.
  - contextual/strict 별칭은 양성/음성 골든 테스트를 가진다.
- 그래프 집계 테스트
  - 열린 공고만 포함한다.
  - `confidence >= 0.8`만 기본 그래프에 포함한다.
  - required-required edge가 preferred edge보다 강하다.
  - 허브 스킬 감쇠가 적용된다.
  - 같은 공고 내 게임 + AI + 보안 혼합 도메인이 보존된다.
- API 테스트
  - `/api/graph/skills`
  - `/api/fit/analyze`
  - seed가 없거나 edge가 부족한 경우의 응답

### 12.2 프론트엔드

- 그래프 응답을 Graphology 노드/edge로 변환하는 순수 함수 테스트
- 보유 스킬 localStorage 저장/삭제 테스트
- 근거 패널 렌더링 테스트
- 접근성 목록 fallback 테스트
- Sigma 컴포넌트는 canvas/WebGL을 mock하여 smoke test
- Next.js build 검증

### 12.3 수동 검증

- `C++` seed로 로보틱스/게임/백엔드/AI 분기가 보이는지 확인
- `Unity` seed에서 전문 도구가 보이는지 확인
- `Python` seed에서 AI/데이터/백엔드/인프라가 과도하게 뭉개지지 않는지 확인
- `ROS` seed에서 C++/Python/SLAM/Linux 근거가 보이는지 확인
- 보유 스킬 입력 후 부족한 필수 스킬과 추천 스킬이 실제 공고 근거를 갖는지 확인
- 모바일 하단 시트와 reduced motion 설정 확인

## 13. 성공 기준

첫 버전은 다음을 만족해야 한다.

- 사용자가 `C++`, `Python`, `Unity`, `ROS` 같은 seed를 입력하면 관련 기술과
  근거 공고를 1~2초 안에 확인할 수 있다.
- 그래프의 모든 edge는 실제 열린 공고 근거를 가진다.
- 관계 추천은 “취업 확률”이 아니라 “공고 요구사항 커버리지”로 표현된다.
- 혼합 공고는 여러 도메인을 동시에 가진다.
- 전문 도구와 직무 개념 누락 때문에 게임/AI/보안/로보틱스 그래프가 빈약해지는
  문제를 초기 시드 팩으로 완화한다.
- 초기 화면은 30개 이하 노드로 제한해 읽을 수 있게 유지한다.
- 사용자 보유 스킬은 로그인 없이 브라우저에 저장된다.

## 14. 명시적 비범위

첫 버전에서 다음은 하지 않는다.

- 로그인 기반 사용자 프로필
- 장기 로드맵 또는 커리큘럼 자동 생성
- LLM이 생성한 직무 조언
- 그래프 DB 도입
- 임베딩 기반 의미 검색
- 모든 산업과 모든 기술을 한 번에 완성하는 거대 온톨로지
- 도메인 작업을 별도 제품 수준으로 확장

이 비범위는 기능의 가치를 낮추기 위한 것이 아니라, 핵심인 “공고 근거 기반
요구사항 지도”를 먼저 정확하게 만들기 위한 제한이다.

## 15. 구현 순서 제안

1. 스킬 사전 메타데이터 확장
   - `kind`, `domains`, 전문 도구/직무 개념 시드 팩
2. 그래프 집계 서비스
   - 공고별 확정 스킬에서 edge 계산
   - 관계 점수와 근거 공고 산출
3. 그래프 API
   - `/api/graph/skills`
4. Fit 분석 API
   - `/api/fit/analyze`
5. 프론트엔드 데이터 계층
   - API 타입, localStorage 보유 스킬 관리
6. 그래프 UI
   - Sigma.js v3, React Sigma, Graphology, ForceAtlas2 worker
7. 근거 패널과 접근성 fallback
8. 운영 검증
   - 대표 seed별 수동 확인
   - 기존 skill evidence 테스트 회귀 확인

## 16. 최종 판단

이 설계는 사용자의 의도와 맞다. 단순 채용공고 검색이 아니라, 실제 회사들이
요구하는 기술 조합과 사용자의 현재 스킬 사이의 간격을 보여주는 기능이다.

다만 핵심 기능으로 효용을 내려면 “예쁜 그래프”가 아니라 다음 세 가지가 반드시
동시에 구현되어야 한다.

1. 실제 공고 근거 기반 관계
2. 복수 도메인과 전문 도구를 포함한 확장 가능한 스킬 온톨로지
3. 보유 스킬 기준의 부족한 필수/우대 스킬 추천

이 세 가지가 충족되면 ejik은 단순 공고 수집 사이트가 아니라, 현업 요구사항에
맞춰 사용자가 다음 준비 방향을 잡는 스킬 지도 제품이 된다.
