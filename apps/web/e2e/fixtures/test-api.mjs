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

const FIXTURE_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "community@example.com",
  nickname: "커뮤니티테스터",
};
const FIXTURE_PASSWORD = "FixturePass123";
const FIXTURE_REFRESH_TOKEN = "fixture-refresh-token";
const FIXTURE_CREATED_AT = "2026-07-23T00:00:00.000Z";

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const FIXTURE_ACCESS_TOKEN = [
  base64Url({ alg: "HS256", typ: "JWT" }),
  base64Url({
    aud: "authenticated",
    email: FIXTURE_USER.email,
    exp: 4_102_444_800,
    iat: 1_753_228_800,
    role: "authenticated",
    sub: FIXTURE_USER.id,
  }),
  "fixture-signature",
].join(".");

function fixtureAuthUser() {
  return {
    id: FIXTURE_USER.id,
    aud: "authenticated",
    role: "authenticated",
    email: FIXTURE_USER.email,
    email_confirmed_at: FIXTURE_CREATED_AT,
    phone: "",
    confirmed_at: FIXTURE_CREATED_AT,
    last_sign_in_at: FIXTURE_CREATED_AT,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { nickname: FIXTURE_USER.nickname },
    identities: [],
    created_at: FIXTURE_CREATED_AT,
    updated_at: FIXTURE_CREATED_AT,
    is_anonymous: false,
  };
}

function fixtureSession() {
  return {
    access_token: FIXTURE_ACCESS_TOKEN,
    token_type: "bearer",
    expires_in: 2_347_216_000,
    expires_at: 4_102_444_800,
    refresh_token: FIXTURE_REFRESH_TOKEN,
    user: fixtureAuthUser(),
  };
}

let communityPosts = new Map();
let communityComments = new Map();
let postReactions = new Set();
let postSaves = new Set();
let authorFollows = new Set();
let careerState = null;

function resetSupabaseFixture() {
  communityPosts = new Map();
  communityComments = new Map();
  postReactions = new Set();
  postSaves = new Set();
  authorFollows = new Set();
  careerState = null;
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  response.setHeader("access-control-allow-origin", origin || "*");
  response.setHeader("access-control-allow-credentials", "true");
  response.setHeader(
    "access-control-allow-headers",
    "accept, accept-profile, apikey, authorization, content-profile, content-type, prefer, x-client-info, x-supabase-api-version",
  );
  response.setHeader(
    "access-control-allow-methods",
    "DELETE, GET, HEAD, OPTIONS, PATCH, POST",
  );
  response.setHeader("access-control-expose-headers", "content-range");
  response.setHeader("vary", "Origin");
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function sendEmpty(response, status = 204) {
  response.statusCode = status;
  response.end();
}

function sendDatabaseError(response, status, code, message) {
  sendJson(response, status, {
    code,
    details: null,
    hint: null,
    message,
  });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("request body too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function bearerToken(request) {
  const header = request.headers.authorization;
  return typeof header === "string" && header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";
}

function authenticatedFixtureUser(request) {
  return bearerToken(request) === FIXTURE_ACCESS_TOKEN ? FIXTURE_USER : null;
}

function requireFixtureUser(request, response) {
  const user = authenticatedFixtureUser(request);
  if (user) return user;
  sendDatabaseError(response, 403, "42501", "authenticated fixture user required");
  return null;
}

function eqFilter(requestUrl, name) {
  const raw = requestUrl.searchParams.get(name);
  return raw?.startsWith("eq.") ? raw.slice(3) : null;
}

function inFilter(requestUrl, name) {
  const raw = requestUrl.searchParams.get(name);
  if (!raw?.startsWith("in.(") || !raw.endsWith(")")) return null;
  return raw
    .slice(4, -1)
    .split(",")
    .map((value) => value.replace(/^"|"$/g, ""));
}

function descendingRows(rows) {
  return rows.sort(
    (left, right) =>
      right.created_at.localeCompare(left.created_at) ||
      right.id.localeCompare(left.id),
  );
}

function cursorFiltered(rows, requestUrl) {
  const cursor = requestUrl.searchParams.get("or");
  if (!cursor) return rows;
  const match = cursor.match(
    /^\(created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([^)]+)\)\)$/,
  );
  if (!match) return rows;
  const [, beforeCreatedAt, equalCreatedAt, beforeId] = match;
  return rows.filter(
    (row) =>
      row.created_at < beforeCreatedAt ||
      (row.created_at === equalCreatedAt && row.id < beforeId),
  );
}

function limitedRows(rows, requestUrl) {
  const requested = Number.parseInt(requestUrl.searchParams.get("limit") || "", 10);
  return Number.isFinite(requested) && requested >= 0
    ? rows.slice(0, requested)
    : rows;
}

function postWithAuthor(post) {
  return {
    ...post,
    author: {
      user_id: post.author_id,
      nickname:
        post.author_id === FIXTURE_USER.id ? FIXTURE_USER.nickname : null,
    },
  };
}

function commentWithAuthor(comment) {
  return {
    ...comment,
    author: {
      user_id: comment.author_id,
      nickname:
        comment.author_id === FIXTURE_USER.id ? FIXTURE_USER.nickname : null,
    },
  };
}

function mutationResponse(request, response, rows, status = 200) {
  const accept = request.headers.accept || "";
  const wantsObject = accept.includes("application/vnd.pgrst.object+json");
  if (wantsObject) {
    if (rows.length !== 1) {
      sendDatabaseError(
        response,
        406,
        "PGRST116",
        "JSON object requested, multiple (or no) rows returned",
      );
      return;
    }
    sendJson(response, status, rows[0]);
    return;
  }
  sendJson(response, status, rows);
}

function membershipKey(userId, targetId) {
  return `${userId}:${targetId}`;
}

function recountPost(postId) {
  const post = communityPosts.get(postId);
  if (!post) return;
  post.comment_count = Array.from(communityComments.values()).filter(
    (comment) => comment.post_id === postId,
  ).length;
  post.reaction_count = Array.from(postReactions).filter((key) =>
    key.endsWith(`:${postId}`),
  ).length;
  post.save_count = Array.from(postSaves).filter((key) =>
    key.endsWith(`:${postId}`),
  ).length;
}

async function handleAuth(request, response, requestUrl) {
  if (requestUrl.pathname === "/auth/v1/token" && request.method === "POST") {
    const body = await readJson(request);
    const grantType = requestUrl.searchParams.get("grant_type");
    const passwordGrant =
      grantType === "password" &&
      body.email === FIXTURE_USER.email &&
      body.password === FIXTURE_PASSWORD;
    const refreshGrant =
      grantType === "refresh_token" &&
      body.refresh_token === FIXTURE_REFRESH_TOKEN;
    if (!passwordGrant && !refreshGrant) {
      sendJson(response, 400, {
        code: "invalid_credentials",
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      });
      return true;
    }
    sendJson(response, 200, fixtureSession());
    return true;
  }

  if (requestUrl.pathname === "/auth/v1/user" && request.method === "GET") {
    if (!authenticatedFixtureUser(request)) {
      sendJson(response, 401, {
        code: "bad_jwt",
        message: "invalid fixture access token",
      });
      return true;
    }
    sendJson(response, 200, fixtureAuthUser());
    return true;
  }

  if (requestUrl.pathname === "/auth/v1/logout" && request.method === "POST") {
    if (!authenticatedFixtureUser(request)) {
      sendJson(response, 401, {
        code: "bad_jwt",
        message: "invalid fixture access token",
      });
      return true;
    }
    sendEmpty(response);
    return true;
  }

  return false;
}

function publicPostRows(requestUrl) {
  let rows = Array.from(communityPosts.values());
  const authorId = eqFilter(requestUrl, "author_id");
  const postId = eqFilter(requestUrl, "id");
  const postIds = inFilter(requestUrl, "id");
  if (authorId) rows = rows.filter((post) => post.author_id === authorId);
  if (postId) rows = rows.filter((post) => post.id === postId);
  if (postIds) rows = rows.filter((post) => postIds.includes(post.id));
  return limitedRows(
    cursorFiltered(descendingRows(rows), requestUrl),
    requestUrl,
  ).map(postWithAuthor);
}

function publicCommentRows(requestUrl) {
  let rows = Array.from(communityComments.values());
  const postId = eqFilter(requestUrl, "post_id");
  const commentId = eqFilter(requestUrl, "id");
  if (postId) rows = rows.filter((comment) => comment.post_id === postId);
  if (commentId) rows = rows.filter((comment) => comment.id === commentId);
  return limitedRows(
    cursorFiltered(descendingRows(rows), requestUrl),
    requestUrl,
  ).map(commentWithAuthor);
}

async function handleCommunityPosts(request, response, requestUrl) {
  if (request.method === "GET") {
    sendJson(response, 200, publicPostRows(requestUrl));
    return;
  }

  const user = requireFixtureUser(request, response);
  if (!user) return;

  if (request.method === "POST") {
    const body = await readJson(request);
    if (body.author_id !== user.id || communityPosts.has(body.id)) {
      sendDatabaseError(
        response,
        body.author_id !== user.id ? 403 : 409,
        body.author_id !== user.id ? "42501" : "23505",
        "fixture post ownership or uniqueness violation",
      );
      return;
    }
    const timestamp = new Date().toISOString();
    const post = {
      id: body.id,
      author_id: body.author_id,
      category: body.category,
      title: body.title,
      body: body.body,
      tags: body.tags,
      reaction_count: 0,
      comment_count: 0,
      save_count: 0,
      client_origin_id: body.client_origin_id ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    communityPosts.set(post.id, post);
    mutationResponse(request, response, [postWithAuthor(post)], 201);
    return;
  }

  const authorId = eqFilter(requestUrl, "author_id");
  const postId = eqFilter(requestUrl, "id");
  const post = postId ? communityPosts.get(postId) : null;
  if (!post || authorId !== user.id || post.author_id !== user.id) {
    sendDatabaseError(response, 403, "42501", "fixture post ownership violation");
    return;
  }

  if (request.method === "PATCH") {
    const body = await readJson(request);
    Object.assign(post, {
      category: body.category,
      title: body.title,
      body: body.body,
      tags: body.tags,
      updated_at: new Date().toISOString(),
    });
    mutationResponse(request, response, [postWithAuthor(post)]);
    return;
  }

  if (request.method === "DELETE") {
    communityPosts.delete(post.id);
    for (const [commentId, comment] of communityComments) {
      if (comment.post_id === post.id) communityComments.delete(commentId);
    }
    postReactions = new Set(
      Array.from(postReactions).filter((key) => !key.endsWith(`:${post.id}`)),
    );
    postSaves = new Set(
      Array.from(postSaves).filter((key) => !key.endsWith(`:${post.id}`)),
    );
    sendEmpty(response);
    return;
  }

  sendDatabaseError(response, 405, "PGRST101", "method not allowed");
}

async function handleCommunityComments(request, response, requestUrl) {
  if (request.method === "GET") {
    sendJson(response, 200, publicCommentRows(requestUrl));
    return;
  }

  const user = requireFixtureUser(request, response);
  if (!user) return;

  if (request.method === "POST") {
    const body = await readJson(request);
    if (
      body.author_id !== user.id ||
      !communityPosts.has(body.post_id) ||
      communityComments.has(body.id)
    ) {
      sendDatabaseError(
        response,
        body.author_id !== user.id ? 403 : 409,
        body.author_id !== user.id ? "42501" : "23505",
        "fixture comment ownership, post, or uniqueness violation",
      );
      return;
    }
    const timestamp = new Date().toISOString();
    const comment = {
      id: body.id,
      post_id: body.post_id,
      author_id: body.author_id,
      body: body.body,
      client_origin_id: body.client_origin_id ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    communityComments.set(comment.id, comment);
    recountPost(comment.post_id);
    mutationResponse(request, response, [commentWithAuthor(comment)], 201);
    return;
  }

  const authorId = eqFilter(requestUrl, "author_id");
  const commentId = eqFilter(requestUrl, "id");
  const comment = commentId ? communityComments.get(commentId) : null;
  if (!comment || authorId !== user.id || comment.author_id !== user.id) {
    sendDatabaseError(
      response,
      403,
      "42501",
      "fixture comment ownership violation",
    );
    return;
  }

  if (request.method === "PATCH") {
    const body = await readJson(request);
    comment.body = body.body;
    comment.updated_at = new Date().toISOString();
    mutationResponse(request, response, [commentWithAuthor(comment)]);
    return;
  }

  if (request.method === "DELETE") {
    communityComments.delete(comment.id);
    recountPost(comment.post_id);
    sendEmpty(response);
    return;
  }

  sendDatabaseError(response, 405, "PGRST101", "method not allowed");
}

async function handleMembershipTable(
  request,
  response,
  requestUrl,
  collection,
  userField,
  targetField,
) {
  if (request.method === "GET") {
    const userId = eqFilter(requestUrl, userField);
    const requestedTargets = inFilter(requestUrl, targetField);
    const rows = Array.from(collection)
      .map((key) => key.split(":"))
      .filter(
        ([rowUserId, rowTargetId]) =>
          (!userId || rowUserId === userId) &&
          (!requestedTargets || requestedTargets.includes(rowTargetId)),
      )
      .map(([rowUserId, rowTargetId]) => ({
        [userField]: rowUserId,
        [targetField]: rowTargetId,
        created_at: FIXTURE_CREATED_AT,
      }));
    sendJson(response, 200, limitedRows(rows, requestUrl));
    return;
  }

  const user = requireFixtureUser(request, response);
  if (!user) return;
  if (request.method === "POST") {
    const body = await readJson(request);
    if (body[userField] !== user.id) {
      sendDatabaseError(response, 403, "42501", "fixture membership ownership violation");
      return;
    }
    collection.add(membershipKey(body[userField], body[targetField]));
    sendEmpty(response, 201);
    return;
  }
  if (request.method === "DELETE") {
    const userId = eqFilter(requestUrl, userField);
    const targetId = eqFilter(requestUrl, targetField);
    if (userId !== user.id || !targetId) {
      sendDatabaseError(response, 403, "42501", "fixture membership ownership violation");
      return;
    }
    collection.delete(membershipKey(userId, targetId));
    sendEmpty(response);
    return;
  }
  sendDatabaseError(response, 405, "PGRST101", "method not allowed");
}

async function handleCareerState(request, response, requestUrl) {
  const user = requireFixtureUser(request, response);
  if (!user) return;
  if (request.method === "GET") {
    const userId = eqFilter(requestUrl, "user_id");
    sendJson(
      response,
      200,
      userId === user.id && careerState ? [careerState] : [],
    );
    return;
  }
  if (request.method === "POST") {
    const body = await readJson(request);
    if (body.user_id !== user.id) {
      sendDatabaseError(response, 403, "42501", "fixture career state ownership violation");
      return;
    }
    careerState = { ...(careerState ?? {}), ...body };
    sendEmpty(response, 201);
    return;
  }
  sendDatabaseError(response, 405, "PGRST101", "method not allowed");
}

async function handleSearchRpc(request, response) {
  if (request.method !== "POST") {
    sendDatabaseError(response, 405, "PGRST101", "method not allowed");
    return;
  }
  const body = await readJson(request);
  const query = String(body.search_query ?? "")
    .trim()
    .toLocaleLowerCase("ko-KR");
  const limit = Number.isFinite(body.result_limit) ? body.result_limit : 21;
  const rows = descendingRows(Array.from(communityPosts.values()))
    .filter((post) =>
      [post.title, post.body, ...post.tags]
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(query),
    )
    .filter(
      (post) =>
        !body.before_created_at ||
        post.created_at < body.before_created_at ||
        (post.created_at === body.before_created_at && post.id < body.before_id),
    )
    .slice(0, limit)
    .map((post) => ({
      ...post,
      author_nickname:
        post.author_id === FIXTURE_USER.id ? FIXTURE_USER.nickname : null,
    }));
  sendJson(response, 200, rows);
}

async function handleRest(request, response, requestUrl) {
  const rpcName = requestUrl.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  if (rpcName === "search_community_posts") {
    await handleSearchRpc(request, response);
    return true;
  }

  const table = requestUrl.pathname.match(/^\/rest\/v1\/([^/]+)$/)?.[1];
  if (!table) return false;
  if (table === "community_posts") {
    await handleCommunityPosts(request, response, requestUrl);
    return true;
  }
  if (table === "community_comments") {
    await handleCommunityComments(request, response, requestUrl);
    return true;
  }
  if (table === "community_post_reactions") {
    await handleMembershipTable(
      request,
      response,
      requestUrl,
      postReactions,
      "user_id",
      "post_id",
    );
    return true;
  }
  if (table === "community_post_saves") {
    await handleMembershipTable(
      request,
      response,
      requestUrl,
      postSaves,
      "user_id",
      "post_id",
    );
    return true;
  }
  if (table === "community_author_follows") {
    await handleMembershipTable(
      request,
      response,
      requestUrl,
      authorFollows,
      "follower_id",
      "followed_id",
    );
    return true;
  }
  if (table === "user_career_states") {
    await handleCareerState(request, response, requestUrl);
    return true;
  }
  if (table === "user_notifications") {
    const user = requireFixtureUser(request, response);
    if (!user) return true;
    sendJson(response, 200, []);
    return true;
  }
  if (table === "community_reports") {
    const user = requireFixtureUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    if (request.method !== "POST" || body.reporter_id !== user.id) {
      sendDatabaseError(response, 403, "42501", "fixture report ownership violation");
      return true;
    }
    sendEmpty(response, 201);
    return true;
  }

  sendDatabaseError(response, 404, "PGRST205", "fixture table not found");
  return true;
}

function apiBody(request, requestUrl) {
  const pathname = requestUrl.pathname;
  const detailId = pathname.match(/^\/api\/postings\/([^/]+)$/)?.[1];
  return detailId
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
}

const server = createServer(async (request, response) => {
  applyCors(request, response);
  if (request.method === "OPTIONS") {
    sendEmpty(response);
    return;
  }

  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  try {
    if (
      requestUrl.pathname === "/__test__/reset" &&
      request.method === "POST"
    ) {
      resetSupabaseFixture();
      sendJson(response, 200, { ok: true });
      return;
    }
    if (await handleAuth(request, response, requestUrl)) return;
    if (await handleRest(request, response, requestUrl)) return;

    const body = apiBody(request, requestUrl);
    if (body === null) {
      sendJson(response, 404, { detail: "Not found" });
      return;
    }
    sendJson(response, 200, body);
  } catch {
    if (!response.headersSent) {
      sendJson(response, 400, { detail: "Invalid fixture request" });
    } else {
      response.end();
    }
  }
});

server.listen(8011, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
