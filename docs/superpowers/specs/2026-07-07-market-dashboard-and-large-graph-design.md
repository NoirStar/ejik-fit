# ejik 시장 적합도 대시보드와 대규모 그래프 설계

## 제품 의도

ejik의 핵심 화면은 그래프 체험 페이지가 아니라 시장 적합도 대시보드다.

사용자가 원하는 답은 다음 순서다.

1. 내가 가진 스킬이 어느 분야와 연결되는가
2. 회사들이 함께 요구하는 기술 조합은 무엇인가
3. 내 스킬과 맞는 공고는 얼마나 있는가
4. 부족한 핵심 스킬은 무엇인가
5. 특정 스킬을 눌렀을 때 관련 공고와 다음 준비가 어떻게 바뀌는가

따라서 UI는 그래프를 크게 보여주되, 그래프 조절 도구를 주인공으로 두지 않는다. 기본 화면은 스킬 입력, 시장 fit, 다음 준비, 분야 신호, 관련 공고가 한 번에 읽혀야 한다.

## 이번 구현 결정

- `/skills/graph`는 `시장 적합도 대시보드`로 재정의한다.
- 기본 그래프 모드는 `선택 주변`이다. 사용자가 노드를 누르면 local graph로 전환하고 오른쪽 인사이트가 함께 갱신된다.
- Obsidian식 고급 옵션인 분야 필터, 라벨, 물리 값은 `그래프 설정` 뒤로 숨긴다.
- 기본 움직임은 꺼 둔다. 클릭과 선택 변화가 분명해야 하므로 무한 시뮬레이션을 기본값으로 두지 않는다.
- 랜딩 문구는 그래프 기술 소개보다 `내 기술이 시장에서 어디로 이어지는지`를 먼저 말한다.

## 현재 그래프 엔진의 한계

현재 프론트엔드는 `force-graph`의 2D Canvas 렌더러와 브라우저 내 d3-force 계열 시뮬레이션을 사용한다. 이 구조는 MVP와 수백에서 수천 개 수준의 상호작용에는 적합하지만, 몇만 노드의 Obsidian global graph 최종형에는 적합하지 않다.

대규모에서 병목이 되는 지점은 다음이다.

- 프론트에서 매번 force layout을 돌리는 구조
- 공고 근거 노드와 스킬 노드를 모두 같은 밀도로 렌더링하는 구조
- zoom level과 중요도에 따른 label, edge LOD가 부족한 구조
- 메인 스레드에서 simulation, hover, label draw가 같이 일어나는 구조

## 대규모 최종 구조

수만 노드 이상은 다음 구조로 전환해야 한다.

```txt
수집/정규화 데이터
↓
서버 또는 빌드 단계 graph artifact 생성
↓
degree, community, domain, demand score 계산
↓
좌표 precompute 또는 WebGL/GPU layout
↓
frontend는 WebGL renderer로 표시
```

권장 엔진 순위는 다음과 같다.

1. Cosmograph 또는 cosmos.gl
   - WebGL/GPU 기반 대규모 point/link graph에 가장 적합하다.
   - 수만에서 수십만 노드 목표에 맞다.
2. Sigma.js + Graphology
   - Graphology로 graph data model, degree, community, layout을 관리하고 Sigma.js로 WebGL 렌더링한다.
   - 프로덕션 통합과 알고리즘 확장이 안정적이다.
3. PixiJS + 커스텀 force/layout
   - 완전 커스텀 Obsidian 클론이 필요할 때만 선택한다.

## 프론트 데이터 인터페이스 목표

최종 렌더러는 현재 컴포넌트에서 직접 엔진에 묶이지 않고 다음 형태의 artifact를 받아야 한다.

```ts
type MarketGraphNode = {
  id: string;
  label: string;
  kind: "skill" | "posting" | "company" | "domain";
  x: number;
  y: number;
  size: number;
  color: string;
  domain?: string;
  degree?: number;
  demandCount?: number;
  owned?: boolean;
};

type MarketGraphEdge = {
  source: string;
  target: string;
  weight: number;
  kind: "cooccurrence" | "evidence" | "domain";
};
```

## Obsidian식 동작 원칙

- global graph는 멀리서 점구름과 community 구조를 보여준다.
- local graph는 선택한 스킬 기준 depth 1에서 2를 선명하게 보여준다.
- 멀리서는 라벨 대부분을 숨기고, zoom과 중요도에 따라 hub label만 표시한다.
- hover와 click은 주변 노드와 edge를 밝히고 나머지는 낮은 opacity로 내린다.
- 공고 상세와 fit 분석은 그래프 밖 패널에 둔다.
- 사용자가 처음 보는 옵션은 3개 이하로 둔다.

## 다음 구현 항목

1. [x] `GraphRenderer` 인터페이스를 만들고 현재 Canvas renderer를 어댑터로 분리한다.
2. [x] 대규모 artifact 생성 API를 설계한다.
3. Cosmograph 또는 Sigma.js 중 하나로 `/skills/graph`의 renderer를 교체하는 spike를 만든다.
4. 5천, 2만, 5만 노드 fixture로 렌더링 시간을 측정한다.
   - [x] 5천, 2만, 5만 노드 fixture와 artifact/renderer decision 벤치를 추가한다.
   - [ ] 브라우저에서 Canvas/WebGL renderer 실제 render timing을 측정한다.
5. LOD 규칙을 구현한다.
   - zoom 낮음: node only
   - zoom 중간: hub label
   - zoom 높음: selected neighborhood label과 edge
6. 모바일은 global graph보다 검색, 선택 주변, 관련 공고를 우선한다.

## 대규모 fixture 벤치 기록

2026-07-07 로컬 `npm run bench:graph` 기준으로 renderer 선택과 artifact 변환 비용은 다음과 같다.

| 노드 수 | 평균 시간 |
| --- | ---: |
| 5,000 | 7.52ms |
| 20,000 | 41.88ms |
| 50,000 | 167.23ms |

이 수치는 브라우저 실제 렌더 시간이 아니라 데이터 변환 비용이다. 따라서 다음 병목 검증은 Canvas/WebGL renderer의 mount, zoom, hover, selected-neighborhood timing에서 해야 한다.
