import { createServer } from "node:http";

const postings = {
  total: 2,
  items: [
    {
      id: "job-python",
      title: "Python Backend Engineer",
      company_name: "NAVER",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://recruit.navercorp.com/job-python",
      last_verified_at: "2026-07-14T03:00:00.000Z",
      opens_at: null,
      closes_at: "2026-07-31T03:00:00.000Z",
      required_skills: ["Python", "Docker"],
      preferred_skills: ["Kubernetes"],
      unspecified_skills: [],
    },
    {
      id: "job-go",
      title: "Go Platform Engineer",
      company_name: "S2W",
      career_type: "new_comer",
      employment_type: "FULL_TIME_WORKER",
      career_min: null,
      career_max: null,
      location: "성남",
      status: "open",
      source_url: "https://s2w.career.greetinghr.com/ko/o/199550",
      last_verified_at: "2026-07-13T03:00:00.000Z",
      opens_at: null,
      closes_at: null,
      required_skills: ["Go"],
      preferred_skills: [],
      unspecified_skills: ["Linux"],
    },
  ],
};

const postingDetails = {
  "job-python": {
    ...postings.items[0],
    description_html: "<p>Do not render this HTML</p>",
    description_text:
      "제품 소개입니다. ### 주요 업무 * Python API를 개발합니다. * Docker 기반 배포 환경을 운영합니다. ### 우대 사항 • Kubernetes 운영 경험",
    skills: ["Python", "Docker", "Kubernetes"],
    skill_details: [
      {
        skill: "Python",
        category: "language",
        requirement_type: "required",
        evidence_text: "Python API를 개발합니다.",
        confidence: 1,
        match_reason: "distinct_alias",
      },
      {
        skill: "Docker",
        category: "infra",
        requirement_type: "required",
        evidence_text: "Docker 기반 배포 환경을 운영합니다.",
        confidence: 1,
        match_reason: "distinct_alias",
      },
      {
        skill: "Kubernetes",
        category: "infra",
        requirement_type: "preferred",
        evidence_text: "Kubernetes 운영 경험",
        confidence: 1,
        match_reason: "distinct_alias",
      },
    ],
  },
};

const skillStats = {
  total: 2,
  items: [
    { skill: "Python", category: "language", count: 1 },
    { skill: "Go", category: "language", count: 1 },
  ],
};

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const detailId = pathname.match(/^\/api\/postings\/([^/]+)$/)?.[1];
  const body = detailId
    ? postingDetails[detailId] ?? null
    : pathname === "/api/postings"
      ? postings
      : pathname === "/api/skills/stats"
        ? skillStats
        : null;

  response.setHeader("content-type", "application/json; charset=utf-8");
  if (body === null) {
    response.statusCode = 404;
    response.end(JSON.stringify({ detail: "Not found" }));
    return;
  }
  response.end(JSON.stringify(body));
});

server.listen(8011, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
