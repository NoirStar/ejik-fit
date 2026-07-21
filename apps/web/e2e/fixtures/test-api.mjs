import { createServer } from "node:http";

const postings = {
  total: 2,
  items: [
    {
      id: "job-python",
      title: "Python Backend Engineer",
      company_name: "NAVER",
      company_slug: "naver",
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
      company_slug: "s2w",
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

function marketSkill(
  skill,
  category,
  count,
  requiredCount,
  preferredCount,
) {
  return {
    skill,
    category,
    count,
    required_count: requiredCount,
    preferred_count: preferredCount,
    unspecified_count: Math.max(0, count - requiredCount - preferredCount),
  };
}

const marketSkillStats = [
  marketSkill("Python", "language", 63, 27, 8),
  marketSkill("LLM", "ai", 59, 33, 11),
  marketSkill("Kubernetes", "infra", 39, 9, 12),
  marketSkill("RAG", "ai", 33, 27, 2),
  marketSkill("Docker", "infra", 27, 7, 5),
  marketSkill("Java", "language", 25, 11, 6),
  marketSkill("SQL", "data", 24, 12, 5),
  marketSkill("AWS", "infra", 21, 6, 7),
  ...[
    ["TypeScript", "language"],
    ["React", "frontend"],
    ["Spring Boot", "backend"],
    ["Go", "language"],
    ["Linux", "infra"],
    ["Kafka", "data"],
    ["PostgreSQL", "data"],
    ["Redis", "data"],
    ["Node.js", "backend"],
    ["MySQL", "data"],
    ["C++", "language"],
    ["Git", "infra"],
    ["Terraform", "infra"],
    ["JavaScript", "language"],
    ["FastAPI", "backend"],
    ["PyTorch", "ai"],
    ["GCP", "infra"],
    ["MongoDB", "data"],
    ["Jenkins", "infra"],
    ["Next.js", "frontend"],
    ["Kotlin", "language"],
    ["C", "language"],
    ["GitHub Actions", "infra"],
    ["Helm", "infra"],
    ["Prometheus", "infra"],
    ["Grafana", "infra"],
    ["Elasticsearch", "data"],
    ["RabbitMQ", "backend"],
    ["OpenSearch", "data"],
    ["Nginx", "infra"],
    ["Django", "backend"],
    ["Flask", "backend"],
    ["JPA", "backend"],
    ["Hibernate", "backend"],
    ["S3", "infra"],
    ["EC2", "infra"],
    ["Airflow", "data"],
    ["Spark", "data"],
    ["Pandas", "data"],
    ["NumPy", "data"],
    ["scikit-learn", "ai"],
    ["TensorFlow", "ai"],
    ["MLflow", "ai"],
    ["CUDA", "ai"],
    ["Unity", "game"],
    ["Unreal Engine", "game"],
    ["Swift", "language"],
    ["Android", "mobile"],
    ["iOS", "mobile"],
    ["React Native", "mobile"],
    ["Flutter", "mobile"],
    ["C#", "language"],
    ["Rust", "language"],
    ["PHP", "language"],
    ["Ruby", "language"],
    ["Jira", "design"],
    ["Figma", "design"],
    ["Selenium", "qa"],
    ["Playwright", "qa"],
    ["Cypress", "qa"],
    ["Mockito", "qa"],
  ].map(([skill, category], index) => {
    const count = Math.max(3, 20 - Math.floor(index / 3));
    const requiredCount = Math.max(1, Math.floor(count * 0.44));
    const preferredCount = Math.max(1, Math.floor(count * 0.24));
    return marketSkill(skill, category, count, requiredCount, preferredCount);
  }),
];

if (marketSkillStats.length !== 69) {
  throw new Error(`market fixture must contain 69 skills, got ${marketSkillStats.length}`);
}

const skillCatalog = {
  total: marketSkillStats.length,
  items: marketSkillStats.map(({ category, skill }) => ({
    name: skill,
    category,
    kind: "tool",
    domains: [category],
  })),
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

postingDetails["job-korean"] = {
  ...postingDetails["job-python"],
  id: "job-korean",
  title: "플랫폼 데이터 서비스 개발자 채용",
  source_url: "https://recruit.navercorp.com/job-korean",
};

const fitAnalysis = {
  coverage: {
    matching_posting_count: 17,
    strong_fit_posting_count: 6,
  },
  domain_branches: [],
  recommended_next_skills: [
    {
      skill: "Kubernetes",
      reason: "보유 스킬과 함께 등장한 공고에서 10회 부족 요구사항으로 확인됨",
      required_count: 8,
      preferred_count: 3,
      supporting_posting_count: 10,
    },
  ],
};

const skillTrends = {
  status: "collecting",
  collected_weeks: 1,
  minimum_weeks: 4,
  latest_snapshot_at: "2026-07-15T00:00:00.000Z",
  series: [],
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

function postingsForRequest(requestUrl) {
  const companySlug = requestUrl.searchParams.get("company");
  const careerType = requestUrl.searchParams.get("career_type");
  const category = requestUrl.searchParams.get("category");
  const query = requestUrl.searchParams.get("q")?.trim().toLocaleLowerCase("ko-KR");
  const items = postings.items.filter((posting) => {
    if (companySlug && posting.company_slug !== companySlug) return false;
    if (careerType && posting.career_type !== careerType) return false;
    if (
      category &&
      !postingDetails[posting.id]?.skill_details.some(
        (skill) => skill.category === category,
      )
    ) {
      return false;
    }
    if (!query) return true;
    const searchable = [
      posting.title,
      posting.company_name,
      posting.location,
      ...(posting.required_skills ?? []),
      ...(posting.preferred_skills ?? []),
      ...(posting.unspecified_skills ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase("ko-KR");
    return searchable.includes(query);
  });
  return { items, total: items.length };
}

function skillStatsForRequest(requestUrl) {
  const careerType = requestUrl.searchParams.get("career_type");
  const category = requestUrl.searchParams.get("category");
  const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "30", 10);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 30;
  let matchingSkills = marketSkillStats;

  if (careerType || category) {
    const grouped = new Map();
    for (const posting of postingsForRequest(requestUrl).items) {
      for (const detail of postingDetails[posting.id]?.skill_details ?? []) {
        if ((detail.confidence ?? 0) < 0.8) continue;
        const key = `${detail.category}:${detail.skill}`;
        const entry = grouped.get(key) ?? {
          skill: detail.skill,
          category: detail.category,
          postingIds: new Set(),
          requiredPostingIds: new Set(),
          preferredPostingIds: new Set(),
          unspecifiedPostingIds: new Set(),
        };
        entry.postingIds.add(posting.id);
        if (detail.requirement_type === "required") {
          entry.requiredPostingIds.add(posting.id);
        } else if (detail.requirement_type === "preferred") {
          entry.preferredPostingIds.add(posting.id);
        } else {
          entry.unspecifiedPostingIds.add(posting.id);
        }
        grouped.set(key, entry);
      }
    }
    matchingSkills = [...grouped.values()].map((entry) => ({
      skill: entry.skill,
      category: entry.category,
      count: entry.postingIds.size,
      required_count: entry.requiredPostingIds.size,
      preferred_count: entry.preferredPostingIds.size,
      unspecified_count: entry.unspecifiedPostingIds.size,
    }));
  }

  const items = matchingSkills
    .slice()
    .sort(
      (left, right) =>
        right.count - left.count || left.skill.localeCompare(right.skill),
    )
    .slice(0, safeLimit);
  return { total: items.length, items };
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = requestUrl.pathname;
  const detailId = pathname.match(/^\/api\/postings\/([^/]+)$/)?.[1];
  const body = detailId
    ? postingDetails[detailId] ?? null
    : pathname === "/api/postings"
      ? postingsForRequest(requestUrl)
      : pathname === "/api/skills/stats"
        ? skillStatsForRequest(requestUrl)
        : pathname === "/api/skills/catalog"
          ? skillCatalog
        : pathname === "/api/skills/trends"
          ? skillTrends
        : pathname === "/api/fit/analyze" && request.method === "POST"
          ? fitAnalysis
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
