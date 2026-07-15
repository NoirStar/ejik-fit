import type { AuthorTone } from "./types";

export type MockPostComment = {
  id: string;
  authorName: string;
  authorHeadline: string;
  authorTone: AuthorTone;
  body: string;
  createdLabel: string;
};

export type MockPostDetail = {
  paragraphs: string[];
  sampleComments: MockPostComment[];
  relatedPostIds: string[];
};

export const MOCK_POST_DETAILS: Record<string, MockPostDetail> = {
  "career-move-3y-backend": {
    paragraphs: [
      "현재 팀에서는 익숙한 서비스의 유지보수 비중이 커졌습니다. 문제를 안정적으로 처리하는 법은 배웠지만, 설계 선택의 폭을 넓힐 기회가 줄었다고 느낍니다.",
      "새로 제안받은 팀은 작은 조직이라 맡을 범위가 넓고 기술 선택에도 참여할 수 있다고 합니다. 성장 기회와 운영 부담을 함께 비교해 본 분들의 기준이 궁금합니다.",
    ],
    sampleComments: [
      {
        id: "career-move-comment-1",
        authorName: "배포전확인",
        authorHeadline: "서버 개발자 · 6년차",
        authorTone: "blue",
        body: "팀 규모보다 입사 뒤 첫 6개월에 맡게 될 문제와 리뷰를 받을 동료가 있는지 먼저 확인했습니다.",
        createdLabel: "1시간 전",
      },
      {
        id: "career-move-comment-2",
        authorName: "커밋산책",
        authorHeadline: "백엔드 개발자 · 4년차",
        authorTone: "green",
        body: "제안받은 역할에서 기대하는 결과와 장애 대응 범위를 면접에서 구체적으로 물어보면 판단이 조금 쉬워졌습니다.",
        createdLabel: "38분 전",
      },
    ],
    relatedPostIds: ["startup-or-enterprise", "salary-negotiation-range"],
  },
  "platform-backend-first-round": {
    paragraphs: [
      "면접은 운영 중 발생한 지연 문제를 하나 고르고, 처음 이상을 발견한 지표부터 원인을 좁힌 순서까지 설명하는 방식으로 진행됐습니다.",
      "면접관은 결과보다 당시 확인하지 못한 가정과 다시 같은 상황을 만나면 바꿀 점을 오래 물었습니다. 답을 외우기보다 판단 근거를 시간 순서로 정리하는 준비가 도움이 될 것 같습니다.",
    ],
    sampleComments: [
      {
        id: "platform-review-comment-1",
        authorName: "관찰로그",
        authorHeadline: "플랫폼 엔지니어 · 5년차",
        authorTone: "violet",
        body: "장애 회고를 상황, 가설, 확인, 조치 순서로 다시 적어보면 비슷한 질문에 답하기 편했습니다.",
        createdLabel: "2시간 전",
      },
      {
        id: "platform-review-comment-2",
        authorName: "서버온도",
        authorHeadline: "SRE · 4년차",
        authorTone: "orange",
        body: "기술 선택보다 어떤 신호를 먼저 보고 왜 그렇게 판단했는지 묻는 흐름이 인상적이네요.",
        createdLabel: "1시간 전",
      },
    ],
    relatedPostIds: ["career-move-3y-backend", "kubernetes-experience"],
  },
  "kubernetes-experience": {
    paragraphs: [
      "개인 환경에서는 배포와 롤백까지 해봤지만, 실제 서비스에서 용량 계획이나 장애 원인을 설명해 본 경험은 없습니다. 기능 목록을 따라가는 학습만으로는 부족하다고 느꼈습니다.",
      "작은 서비스를 직접 운영하며 관찰 지표와 실패 시나리오를 남기는 방식, 공개된 장애 사례를 재현하는 방식 중 어떤 접근이 면접에서 설명 가능한 경험으로 이어졌는지 궁금합니다.",
    ],
    sampleComments: [
      {
        id: "kubernetes-comment-1",
        authorName: "클러스터노트",
        authorHeadline: "인프라 엔지니어 · 5년차",
        authorTone: "blue",
        body: "기능을 많이 쓰는 것보다 배포 실패 한 가지를 정하고 관찰, 복구, 재발 방지 기록을 남기는 편이 설명하기 좋았습니다.",
        createdLabel: "3시간 전",
      },
      {
        id: "kubernetes-comment-2",
        authorName: "메트릭수집가",
        authorHeadline: "플랫폼 개발자 · 4년차",
        authorTone: "green",
        body: "리소스 제한과 readiness 설정을 바꿨을 때 사용자 요청이 어떻게 달라지는지 비교해 보는 것도 괜찮았습니다.",
        createdLabel: "2시간 전",
      },
    ],
    relatedPostIds: ["platform-backend-first-round", "career-move-3y-backend"],
  },
  "salary-negotiation-range": {
    paragraphs: [
      "공개된 공고의 연봉 범위는 역할과 보상 구성이 달라 그대로 비교하기 어려웠습니다. 기본급, 변동 보상, 근무 조건을 나눠 적어보니 제안 사이 차이가 조금 더 분명해졌습니다.",
      "협상 전에 현재 역할에서 넓어진 책임과 다음 회사가 기대하는 범위를 각각 정리하고 있습니다. 숫자 하나보다 비교 기준을 어떻게 설명했는지 경험을 듣고 싶습니다.",
    ],
    sampleComments: [
      {
        id: "salary-comment-1",
        authorName: "조건정리",
        authorHeadline: "데이터 엔지니어 · 6년차",
        authorTone: "orange",
        body: "공고 범위는 참고만 하고 역할 범위와 총보상을 같은 표로 정리한 뒤 우선순위를 정했습니다.",
        createdLabel: "어제",
      },
      {
        id: "salary-comment-2",
        authorName: "제안비교",
        authorHeadline: "제품 개발자 · 5년차",
        authorTone: "violet",
        body: "희망 범위를 말할 때 맡게 될 책임과 기대 성과를 함께 확인하니 대화가 숫자만 오가는 느낌이 줄었습니다.",
        createdLabel: "어제",
      },
    ],
    relatedPostIds: ["career-move-3y-backend", "startup-or-enterprise"],
  },
  "saas-data-interview": {
    paragraphs: [
      "SQL 문제 뒤에는 같은 지표를 영업팀과 제품팀이 다르게 정의하는 상황이 주어졌습니다. 먼저 의사결정 목적과 집계 기준을 질문하고, 확인이 필요한 데이터를 나눠 설명했습니다.",
      "정답을 빠르게 고르는 것보다 모호한 용어를 그대로 계산하지 않는 태도를 보는 면접처럼 느껴졌습니다. 평소 분석 결과에 가정과 제외 조건을 적어둔 경험이 답변에 도움이 됐습니다.",
    ],
    sampleComments: [
      {
        id: "saas-data-comment-1",
        authorName: "지표사전",
        authorHeadline: "데이터 분석가 · 4년차",
        authorTone: "blue",
        body: "SQL 풀이 다음에 지표의 사용 목적을 묻는 면접이 늘어난 것 같아 사례 정리에 참고가 됩니다.",
        createdLabel: "2일 전",
      },
      {
        id: "saas-data-comment-2",
        authorName: "쿼리검토",
        authorHeadline: "분석 엔지니어 · 5년차",
        authorTone: "green",
        body: "같은 이름의 지표가 팀마다 다를 때 먼저 정의를 맞추는 과정 자체를 평가한 것 같네요.",
        createdLabel: "2일 전",
      },
    ],
    relatedPostIds: ["salary-negotiation-range", "platform-backend-first-round"],
  },
  "startup-or-enterprise": {
    paragraphs: [
      "작은 팀에서는 요구사항을 정리하고 배포 뒤 반응까지 넓게 볼 수 있었습니다. 규모가 큰 팀에서는 한 영역을 깊게 파고 여러 직군과 합의하는 시간을 더 많이 경험했습니다.",
      "어느 쪽이 더 성장하는 환경이라기보다 지금 보완하고 싶은 능력이 무엇인지에 따라 선택이 달라지는 것 같습니다. 다음에는 조직 이름보다 실제로 맡을 문제와 의사결정 범위를 먼저 확인하려고 합니다.",
    ],
    sampleComments: [
      {
        id: "company-size-comment-1",
        authorName: "제품경계",
        authorHeadline: "프론트엔드 개발자 · 7년차",
        authorTone: "orange",
        body: "저도 회사 규모보다 팀이 책임지는 범위와 배포 뒤 피드백을 보는 구조인지가 더 중요했습니다.",
        createdLabel: "2일 전",
      },
      {
        id: "company-size-comment-2",
        authorName: "리뷰문화",
        authorHeadline: "소프트웨어 엔지니어 · 5년차",
        authorTone: "violet",
        body: "넓게 맡을 수 있는지뿐 아니라 어려운 결정을 함께 검토할 사람이 있는지도 확인하게 됩니다.",
        createdLabel: "2일 전",
      },
    ],
    relatedPostIds: ["career-move-3y-backend", "salary-negotiation-range"],
  },
};
