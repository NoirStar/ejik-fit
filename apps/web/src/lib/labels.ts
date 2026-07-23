export const PRODUCT_TERMS = {
  ownedSkills: "내 기술",
  skillMap: "스킬맵",
  unspecifiedRequirement: "필수·우대 미표기",
  unspecifiedRequirementCompact: "미표기",
  savedItems: "저장 목록",
  lastChecked: "최근 확인",
  nextSkill: "다음에 배울 기술",
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
  MILITARY_SERVICE_EXCEPTION: "병역특례",
  PART_TIME: "파트타임",
  PART_TIME_WORKER: "파트타임",
  FREELANCER: "프리랜서",
  정규: "정규직",
  계약: "계약직",
  인턴: "인턴",
};


export function formatCareer(value: string | null): string {
  return value ? CAREER_LABELS[value] ?? value : "경력 미기재";
}


export function formatEmployment(value: string | null): string {
  return value ? EMPLOYMENT_LABELS[value] ?? value : "고용 형태 미기재";
}
