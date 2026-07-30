export const PRODUCT_TERMS = {
  ownedSkills: "내 기술",
  skillMap: "기술 관계",
  unspecifiedRequirement: "조건 구분 없음",
  unspecifiedRequirementCompact: "구분 없음",
  savedItems: "저장 목록",
  lastChecked: "최근 확인",
  nextSkill: "공고에서 함께 확인된 조건",
} as const;

const CAREER_LABELS: Record<string, string> = {
  new_comer: "신입",
  newcomer: "신입",
  experienced: "경력",
  mixed: "신입·경력",
  not_matter: "경력 무관",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  regular: "정규직",
  full_time: "정규직",
  contract: "계약직",
  intern: "인턴",
  part_time: "파트타임",
  freelancer: "프리랜서",
  FULL_TIME: "정규직",
  FULL_TIME_WORKER: "정규직",
  CONTRACT: "계약직",
  CONTRACT_WORKER: "계약직",
  INTERN: "인턴",
  INTERN_WORKER: "인턴",
  MILITARY_SERVICE_EXCEPTION: "병역 특례",
  PART_TIME: "파트타임",
  PART_TIME_WORKER: "파트타임",
  FREELANCER: "프리랜서",
  정규: "정규직",
  계약: "계약직",
  인턴: "인턴",
};


export function formatCareer(value: string | null): string {
  if (!value) return "경력 미기재";
  return CAREER_LABELS[value] ?? "경력 조건 확인 필요";
}


export function formatEmployment(value: string | null): string {
  if (!value) return "고용 형태 미기재";
  const labels = Array.from(
    new Set(
      value
        .split(/[,|;/]+/)
        .map((item) => EMPLOYMENT_LABELS[item.trim()])
        .filter((item): item is string => Boolean(item)),
    ),
  );
  return labels.length > 0 ? labels.join(" · ") : "고용 형태 확인 필요";
}

const LOCATION_LABELS: Record<string, string> = {
  SEOUL: "서울",
  GYEONGGI: "경기",
  INCHEON: "인천",
  BUSAN: "부산",
  DAEJEON: "대전",
  DAEGU: "대구",
  GWANGJU: "광주",
  JEJU: "제주",
  REMOTE: "원격",
};

export function formatLocation(value: string | null): string {
  if (!value?.trim()) return "근무지 미기재";
  const normalized = value.trim();
  if (LOCATION_LABELS[normalized]) return LOCATION_LABELS[normalized];
  if (/^[A-Z0-9_]+$/.test(normalized)) return "근무지 확인 필요";
  return normalized;
}
