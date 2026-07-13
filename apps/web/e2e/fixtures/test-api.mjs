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
      preferred_skills: ["Docker"],
      unspecified_skills: ["Linux"],
    },
  ],
};

const postingDetails = {
  "job-python": {
    ...postings.items[0],
    description_html: "<p>Do not render this HTML</p>",
    description_text: [
      "제품 소개입니다.",
      "## 주요 업무",
      "• Python API를 개발합니다.",
      "• Docker 기반 배포 환경을 운영합니다.",
      "## 우대 사항",
      "• Kubernetes 운영 경험",
    ].join("\n"),
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
  "job-go": {
    ...postings.items[1],
    description_html: "<p>Do not render this HTML</p>",
    description_text: [
      "플랫폼 엔지니어 채용입니다.",
      "## 주요 업무",
      "• Go 서비스와 Linux 운영 환경을 개발합니다.",
      "## 우대 사항",
      "• Docker 기반 배포 경험",
    ].join("\n"),
    skills: ["Go", "Docker", "Linux"],
    skill_details: [
      {
        skill: "Go",
        category: "language",
        requirement_type: "required",
        evidence_text: "Go 서비스를 개발합니다.",
        confidence: 1,
        match_reason: "distinct_alias",
      },
      {
        skill: "Docker",
        category: "infra",
        requirement_type: "preferred",
        evidence_text: "Docker 기반 배포 경험",
        confidence: 1,
        match_reason: "distinct_alias",
      },
      {
        skill: "Linux",
        category: "infra",
        requirement_type: "unspecified",
        evidence_text: "Linux 운영 환경을 개발합니다.",
        confidence: 1,
        match_reason: "distinct_alias",
      },
    ],
  },
};

const skillStats = {
  total: 5,
  items: [
    { skill: "Docker", category: "infra", count: 2 },
    { skill: "Python", category: "language", count: 1 },
    { skill: "Go", category: "language", count: 1 },
    { skill: "Kubernetes", category: "infra", count: 1 },
    { skill: "Linux", category: "infra", count: 1 },
  ],
};

const skillGraph = {
  seed: "Kubernetes",
  nodes: [
    {
      id: "Kubernetes",
      label: "Kubernetes",
      category: "infra",
      kind: "platform",
      domains: ["cloud", "devops"],
      demand_count: 1,
      required_count: 0,
      preferred_count: 1,
      unspecified_count: 0,
      owned: false,
      seed: true,
    },
    {
      id: "Docker",
      label: "Docker",
      category: "infra",
      kind: "platform",
      domains: ["backend", "devops"],
      demand_count: 2,
      required_count: 1,
      preferred_count: 1,
      unspecified_count: 0,
      owned: false,
      seed: false,
    },
    {
      id: "Go",
      label: "Go",
      category: "language",
      kind: "language",
      domains: ["backend"],
      demand_count: 1,
      required_count: 1,
      preferred_count: 0,
      unspecified_count: 0,
      owned: false,
      seed: false,
    },
    {
      id: "Linux",
      label: "Linux",
      category: "infra",
      kind: "platform",
      domains: ["backend", "devops"],
      demand_count: 1,
      required_count: 0,
      preferred_count: 0,
      unspecified_count: 1,
      owned: false,
      seed: false,
    },
    {
      id: "Python",
      label: "Python",
      category: "language",
      kind: "language",
      domains: ["backend"],
      demand_count: 1,
      required_count: 1,
      preferred_count: 0,
      unspecified_count: 0,
      owned: false,
      seed: false,
    },
  ],
  edges: [
    {
      id: "Docker:Kubernetes",
      source: "Docker",
      target: "Kubernetes",
      score: 1,
      cooccurrence_count: 1,
      required_pair_count: 0,
      supporting_posting_ids: ["job-python"],
    },
    {
      id: "Docker:Python",
      source: "Docker",
      target: "Python",
      score: 1,
      cooccurrence_count: 1,
      required_pair_count: 1,
      supporting_posting_ids: ["job-python"],
    },
    {
      id: "Kubernetes:Python",
      source: "Kubernetes",
      target: "Python",
      score: 1,
      cooccurrence_count: 1,
      required_pair_count: 0,
      supporting_posting_ids: ["job-python"],
    },
    {
      id: "Docker:Go",
      source: "Docker",
      target: "Go",
      score: 1,
      cooccurrence_count: 1,
      required_pair_count: 0,
      supporting_posting_ids: ["job-go"],
    },
    {
      id: "Docker:Linux",
      source: "Docker",
      target: "Linux",
      score: 1,
      cooccurrence_count: 1,
      required_pair_count: 0,
      supporting_posting_ids: ["job-go"],
    },
    {
      id: "Go:Linux",
      source: "Go",
      target: "Linux",
      score: 1,
      cooccurrence_count: 1,
      required_pair_count: 0,
      supporting_posting_ids: ["job-go"],
    },
  ],
  evidence: [
    {
      posting_id: "job-python",
      title: "Python Backend Engineer",
      company_name: "NAVER",
      skills: ["Python", "Docker", "Kubernetes"],
      required: ["Python", "Docker"],
      preferred: ["Kubernetes"],
      unspecified: [],
    },
    {
      posting_id: "job-go",
      title: "Go Platform Engineer",
      company_name: "S2W",
      skills: ["Go", "Docker", "Linux"],
      required: ["Go"],
      preferred: ["Docker"],
      unspecified: ["Linux"],
    },
  ],
  meta: { limit: 30, min_confidence: 0.8 },
};

function skillGraphForSeed(requestedSeed, ownedSkills) {
  const knownSeed = skillGraph.nodes.some((node) => node.id === requestedSeed);
  if (!requestedSeed || !knownSeed) {
    return {
      ...skillGraph,
      seed: requestedSeed,
      nodes: skillGraph.nodes.map((node) => ({
        ...node,
        owned: ownedSkills.includes(node.id),
        seed: false,
      })),
      edges: requestedSeed ? [] : skillGraph.edges,
      evidence: requestedSeed ? [] : skillGraph.evidence,
    };
  }

  const seed = requestedSeed;
  const evidence = skillGraph.evidence.filter((item) => item.skills.includes(seed));
  const visibleSkills = new Set(evidence.flatMap((item) => item.skills));
  return {
    ...skillGraph,
    seed,
    nodes: skillGraph.nodes
      .filter((node) => visibleSkills.has(node.id))
      .map((node) => ({
        ...node,
        owned: ownedSkills.includes(node.id),
        seed: node.id === seed,
      })),
    edges: skillGraph.edges.filter(
      (edge) =>
        visibleSkills.has(edge.source) &&
        visibleSkills.has(edge.target) &&
        (edge.source === seed || edge.target === seed),
    ),
    evidence,
  };
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = requestUrl.pathname;
  const detailId = pathname.match(/^\/api\/postings\/([^/]+)$/)?.[1];
  const body = detailId
    ? postingDetails[detailId] ?? null
    : pathname === "/api/postings"
      ? postings
      : pathname === "/api/skills/stats"
        ? skillStats
        : pathname === "/api/graph/skills"
          ? skillGraphForSeed(
              requestUrl.searchParams.get("seed"),
              requestUrl.searchParams.getAll("owned_skills"),
            )
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
