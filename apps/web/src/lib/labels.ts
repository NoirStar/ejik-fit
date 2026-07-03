const CAREER_LABELS: Record<string, string> = {
  new_comer: "신입",
  newcomer: "신입",
  experienced: "경력",
  mixed: "신입·경력",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "정규직",
  FULL_TIME_WORKER: "정규직",
  CONTRACT: "계약직",
  CONTRACT_WORKER: "계약직",
  INTERN: "인턴",
  INTERN_WORKER: "인턴",
  PART_TIME: "파트타임",
  PART_TIME_WORKER: "파트타임",
  FREELANCER: "프리랜서",
};


export function formatCareer(value: string | null): string {
  return value ? CAREER_LABELS[value] ?? value : "경력 무관";
}


export function formatEmployment(value: string | null): string {
  return value ? EMPLOYMENT_LABELS[value] ?? value : "미정";
}
