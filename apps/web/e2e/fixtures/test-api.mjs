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

const skillStats = {
  total: 2,
  items: [
    { skill: "Python", category: "language", count: 1 },
    { skill: "Go", category: "language", count: 1 },
  ],
};

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const body =
    pathname === "/api/postings"
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
