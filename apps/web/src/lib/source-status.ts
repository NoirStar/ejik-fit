import type {
  SourceActivityStatus,
  SourceDirectoryItem,
} from "@/lib/types";

type ActivityCopy = {
  detail: string;
  label: string;
};

const ACTIVITY_COPY: Readonly<Record<SourceActivityStatus, ActivityCopy>> = {
  active: {
    label: "공고 수집 정상",
    detail: "최근 수집이 정상이며 확인된 공개 공고를 반영했습니다.",
  },
  quiet: {
    label: "현재 공개 공고 없음",
    detail: "최근 정상 확인 결과 공개 공고가 없습니다.",
  },
  attention: {
    label: "수집 상태 점검 필요",
    detail: "최근 수집 상태를 점검 중이므로 0건으로 단정하지 않습니다.",
  },
  preparing: {
    label: "연결 준비",
    detail: "공식 채용페이지 연결을 준비하고 있습니다.",
  },
};

type PreparationCopy = {
  detail: string;
  label: string;
};

const PREPARATION_COPY: Readonly<
  Record<NonNullable<SourceDirectoryItem["preparation_reason"]>, PreparationCopy>
> = {
  access_limited: {
    label: "공식 사이트 접근 제한",
    detail: "보안 확인을 우회하지 않아 자동 수집을 보류했습니다.",
  },
  connector_pending: {
    label: "연결 방식 개발 중",
    detail: "공식 페이지 구조에 맞는 수집 연결을 준비하고 있습니다.",
  },
  policy_review: {
    label: "수집 기준 검토 중",
    detail: "공개 범위와 수집 정책을 확인하고 있습니다.",
  },
};

const DEFAULT_PREPARATION_COPY: PreparationCopy = {
  label: "연결 준비",
  detail: "공식 출처 연결 방식을 확인하고 있습니다.",
};

export function getSourceActivityCopy(status: SourceActivityStatus): ActivityCopy {
  return ACTIVITY_COPY[status];
}

export function getSourcePreparationCopy(
  reason: SourceDirectoryItem["preparation_reason"],
): PreparationCopy {
  return reason ? PREPARATION_COPY[reason] : DEFAULT_PREPARATION_COPY;
}
