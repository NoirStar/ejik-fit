"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";

import { PRODUCT_TERMS } from "@/lib/labels";
import type { CareerCondition } from "@/lib/career-preferences";
import { readOwnedSkills, writeOwnedSkills } from "@/lib/owned-skills";
import { buildSkillGraphHref } from "@/lib/product-routes";
import { summarizeGraph } from "@/lib/skill-graph";
import {
  skillGraphLinkColor,
  skillGraphLinkWidth,
} from "@/lib/skill-graph-canvas-style";
import { buildSkillGraphView } from "@/lib/skill-graph-view";
import type {
  SkillGraphViewMode,
  SkillGraphViewNode,
} from "@/lib/skill-graph-view";
import type {
  FitAnalyzeResponse,
  SkillGraphEvidence,
  SkillGraphEvidenceResponse,
  SkillGraphNode,
  SkillGraphResponse,
} from "@/lib/types";
import {
  GRAPH_CANVAS_COLORS,
  GRAPH_PREVIEW_COLORS,
} from "@/styles/design-tokens";

import { SkillGraphForceCanvas } from "./skill-graph-force-canvas";
import type {
  SkillGraphDisplaySettings,
  SkillGraphForceSettings,
} from "./skill-graph-force-canvas";
import styles from "./skill-graph-experience.module.css";


type PositionedNode = SkillGraphViewNode & {
  x: number;
  y: number;
};


type SkillGraphExperienceProps = {
  careerType?: Exclude<CareerCondition, "">;
  initialGraph: SkillGraphResponse;
  initialOwnedSkills: string[];
  loadFailed?: boolean;
  retryHref?: string;
};


type EvidenceState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  items: SkillGraphEvidence[];
  total: number;
};


type TopologyState = "idle" | "loading" | "error";


const SKILL_MAP_COPY = {
  title: PRODUCT_TERMS.skillMap,
  description: "내 기술과 함께 자주 요구되는 기술을 보여줍니다.",
  ownedSkills: PRODUCT_TERMS.ownedSkills,
  addSkill: "기술 추가",
  filters: "그래프 범위",
  recommendation: "다음에 배울 기술",
  related: "함께 요구되는 기술",
  desktopControls: "드래그 · 확대 · 선택",
  mobileControls: "한 손가락으로 화면 스크롤 · 두 손가락으로 확대 · 탭하여 선택",
};


const GRAPH_STATES = {
  loadError: "스킬맵을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
  empty: "표시할 기술이 없습니다. 검색어나 분야 필터를 줄여 주세요.",
  fitLoading: "내 기술과 공고를 비교하고 있습니다.",
  fitError: "내 기술을 비교하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};


const DOMAIN_LABELS: Record<string, string> = {
  ai: "AI",
  autonomy: "자율주행",
  backend: "백엔드",
  cloud: "클라우드",
  computer_vision: "비전",
  data: "데이터",
  design: "디자인",
  devops: "DevOps",
  embedded: "임베디드",
  frontend: "프론트엔드",
  game: "게임",
  graphics: "그래픽스",
  high_performance: "고성능",
  mlops: "MLOps",
  product: "제품",
  qa: "QA",
  robotics: "로보틱스",
  security: "보안",
  web: "웹",
};


const PREVIEW_NODES = [
  { label: "C++", x: 47, y: 48, size: 7, color: GRAPH_PREVIEW_COLORS.cpp },
  { label: "ROS2", x: 66, y: 38, size: 5.5, color: GRAPH_PREVIEW_COLORS.ros },
  { label: "Linux", x: 56, y: 63, size: 5.2, color: GRAPH_PREVIEW_COLORS.linux },
  { label: "Python", x: 34, y: 36, size: 5, color: GRAPH_PREVIEW_COLORS.python },
  { label: "Security", x: 72, y: 60, size: 4.6, color: GRAPH_PREVIEW_COLORS.security },
];


const DEFAULT_DISPLAY: SkillGraphDisplaySettings = {
  animate: true,
  arrows: false,
  labelThreshold: 1.08,
  linkThickness: 1,
  nodeScale: 0.9,
};


const DEFAULT_FORCES: SkillGraphForceSettings = {
  center: 0.04,
  link: 0.28,
  linkDistance: 82,
  repel: 240,
};


function positionNodes(nodes: SkillGraphViewNode[]): PositionedNode[] {
  if (nodes.length === 0) {
    return [];
  }

  const seed = nodes.find((node) => node.seed) ?? nodes[0];
  const outer = nodes.filter((node) => node.id !== seed.id);
  return [
    { ...seed, x: 50, y: 50 },
    ...outer.map((node, index) => {
      const angle = (index / Math.max(outer.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = 38 + (index % 3) * 5;
      return {
        ...node,
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
      };
    }),
  ];
}


function previewNumber(value: number): number {
  return Number(value.toFixed(3));
}


const PREVIEW_DOTS = Array.from({ length: 168 }, (_, index) => {
  const cluster = PREVIEW_NODES[index % PREVIEW_NODES.length];
  const angle = ((index * 137.508) % 360) * (Math.PI / 180);
  const radius = 5 + ((index * 19) % 28);
  const orbit = index % 11 === 0 ? radius * 1.7 : radius;
  return {
    id: `preview-${index}`,
    x: previewNumber(
      Math.max(4, Math.min(96, cluster.x + Math.cos(angle) * orbit * 0.72)),
    ),
    y: previewNumber(
      Math.max(6, Math.min(94, cluster.y + Math.sin(angle) * orbit * 0.52)),
    ),
    size: index % 17 === 0 ? 2.6 : index % 9 === 0 ? 2 : 1.15,
    color: index % 13 === 0 ? cluster.color : GRAPH_PREVIEW_COLORS.ambient,
  };
});


const PREVIEW_LINKS = Array.from({ length: 96 }, (_, index) => {
  const source = PREVIEW_DOTS[(index * 7) % PREVIEW_DOTS.length];
  const target = PREVIEW_DOTS[(index * 11 + 5) % PREVIEW_DOTS.length];
  return { id: `preview-link-${index}`, source, target };
});


function displayDomain(domain: string) {
  return DOMAIN_LABELS[domain] ?? domain.replace(/_/g, " ");
}


function chooseInitialSelection(
  graph: SkillGraphResponse,
) {
  return graph.seed ?? null;
}


function topologyCacheKey(
  seed: string | null,
  careerType: Exclude<CareerCondition, ""> | undefined,
) {
  return `${careerType ?? "all"}:${seed?.toLocaleLowerCase("en-US") ?? "overview"}`;
}


function isSkillGraphResponse(value: unknown): value is SkillGraphResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<SkillGraphResponse>;
  return (
    (typeof candidate.seed === "string" || candidate.seed === null) &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges) &&
    Array.isArray(candidate.evidence) &&
    Boolean(candidate.meta && typeof candidate.meta === "object")
  );
}


export function SkillGraphExperience({
  careerType,
  initialGraph,
  initialOwnedSkills,
  loadFailed = false,
  retryHref = "/skills/graph",
}: SkillGraphExperienceProps) {
  const initialSelection = useMemo(
    () => chooseInitialSelection(initialGraph),
    [initialGraph],
  );
  const [graph, setGraph] = useState(initialGraph);
  const [ownedSkills, setOwnedSkills] = useState(initialOwnedSkills);
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection);
  const [forceReady, setForceReady] = useState(false);
  const [graphMode, setGraphMode] = useState<SkillGraphViewMode>(
    initialSelection ? "focus" : "overview",
  );
  const [filterQuery, setFilterQuery] = useState("");
  const [disabledDomains, setDisabledDomains] = useState<string[]>([]);
  const [compactGraph, setCompactGraph] = useState(false);
  const [fit, setFit] = useState<FitAnalyzeResponse | null>(null);
  const [fitState, setFitState] = useState<"idle" | "loading" | "error">("idle");
  const [evidence, setEvidence] = useState<EvidenceState>({
    status: "idle",
    items: [],
    total: 0,
  });
  const [evidenceRetryKey, setEvidenceRetryKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [controlsOpen, setControlsOpen] = useState(true);
  const [topologyState, setTopologyState] = useState<TopologyState>("idle");
  const evidenceCache = useRef(new Map<string, SkillGraphEvidenceResponse>());
  const topologyCache = useRef(new Map<string, SkillGraphResponse>());
  const topologyRequestRef = useRef<AbortController | null>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const selectedIdRef = useRef<string | null>(initialSelection);
  const careerTypeRef = useRef(careerType);
  const ownedSkillsRef = useRef(ownedSkills);
  selectedIdRef.current = selectedId;
  careerTypeRef.current = careerType;
  ownedSkillsRef.current = ownedSkills;

  const loadTopology = useCallback(async (seed: string | null) => {
    const scope = careerTypeRef.current;
    const cacheKey = topologyCacheKey(seed, scope);
    const cached = topologyCache.current.get(cacheKey);
    topologyRequestRef.current?.abort();
    topologyRequestRef.current = null;
    if (cached) {
      setGraph(cached);
      setTopologyState("idle");
      return;
    }

    const controller = new AbortController();
    topologyRequestRef.current = controller;
    setTopologyState("loading");
    const params = new URLSearchParams({ limit: "30" });
    if (seed) {
      params.set("seed", seed);
    }
    if (scope) {
      params.set("career_type", scope);
    }

    try {
      const response = await fetch(`/skills/graph/data?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("topology request failed");
      }
      const payload = (await response.json()) as unknown;
      if (!isSkillGraphResponse(payload)) {
        throw new Error("invalid topology response");
      }
      if (controller.signal.aborted) {
        return;
      }
      if (topologyCache.current.size >= 24) {
        const oldestKey = topologyCache.current.keys().next().value;
        if (typeof oldestKey === "string") {
          topologyCache.current.delete(oldestKey);
        }
      }
      topologyCache.current.set(cacheKey, payload);
      setGraph(payload);
      if (seed) {
        const canonicalSeed = payload.nodes.find(
          (node) =>
            node.id.toLocaleLowerCase("en-US") ===
            seed.toLocaleLowerCase("en-US"),
        )?.id;
        if (
          canonicalSeed &&
          selectedIdRef.current?.toLocaleLowerCase("en-US") ===
            seed.toLocaleLowerCase("en-US")
        ) {
          selectedIdRef.current = canonicalSeed;
          setSelectedId(canonicalSeed);
        }
      }
      if (topologyRequestRef.current === controller) {
        topologyRequestRef.current = null;
      }
      setTopologyState("idle");
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }
      if (topologyRequestRef.current === controller) {
        topologyRequestRef.current = null;
      }
      setTopologyState("error");
    }
  }, []);

  const graphNodeMap = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const selected = selectedId ? graphNodeMap.get(selectedId) ?? null : null;
  const allDomains = useMemo(
    () => buildSkillGraphView(graph).domains,
    [graph],
  );
  const enabledDomains = useMemo(
    () =>
      allDomains
        .map((domain) => domain.domain)
        .filter((domain) => !disabledDomains.includes(domain)),
    [allDomains, disabledDomains],
  );
  const recommendedIds = useMemo(
    () =>
      fitState === "idle"
        ? (fit?.recommended_next_skills ?? []).map(({ skill }) => skill)
        : [],
    [fit, fitState],
  );
  const viewData = useMemo(
    () =>
      buildSkillGraphView(graph, {
        enabledDomains: allDomains.length > 0 ? enabledDomains : undefined,
        linkLimit: compactGraph ? 10 : undefined,
        mode: graphMode,
        nodeLimit: compactGraph ? 8 : undefined,
        ownedIds: ownedSkills,
        query: filterQuery,
        recommendedIds,
        selectedId,
      }),
    [
      allDomains.length,
      compactGraph,
      enabledDomains,
      filterQuery,
      graphMode,
      graph,
      ownedSkills,
      recommendedIds,
      selectedId,
    ],
  );
  const nodes = useMemo(
    () => positionNodes(viewData.nodes.filter((node) => node.kind === "skill")),
    [viewData.nodes],
  );
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const relatedEvidence = evidence.items;
  const strongestConnections = useMemo(() => {
    const focusIds = new Set(selectedId ? [selectedId] : ownedSkills);
    return graph.edges
      .filter(
        (edge) =>
          focusIds.has(edge.source) ||
          focusIds.has(edge.target),
      )
      .map((edge) => {
        const otherId = focusIds.has(edge.source) ? edge.target : edge.source;
        return {
          edge,
          node: graphNodeMap.get(otherId),
        };
      })
      .filter((item): item is { edge: typeof item.edge; node: SkillGraphNode } =>
        Boolean(item.node),
      )
      .sort(
        (a, b) =>
          b.edge.score - a.edge.score ||
          b.edge.cooccurrence_count - a.edge.cooccurrence_count,
      )
      .slice(0, 6);
  }, [graph.edges, graphNodeMap, ownedSkills, selectedId]);
  const directConnectionCount = useMemo(
    () =>
      selectedId
        ? graph.edges.filter(
            (edge) =>
              edge.source === selectedId || edge.target === selectedId,
          ).length
        : 0,
    [graph.edges, selectedId],
  );
  const quickSkills = useMemo(
    () => viewData.nodes
      .filter((node) => node.kind === "skill")
      .map((node) => node.id),
    [viewData.nodes],
  );
  const topNextSkill =
    fitState === "idle" ? fit?.recommended_next_skills[0] ?? null : null;
  const isFilteredEmpty = graph.nodes.length > 0 && viewData.nodes.length === 0;
  const showFallbackGraph = nodes.length > 0 && !forceReady;
  const totalEvidenceCount = useMemo(
    () =>
      new Set(
        graph.edges.flatMap((edge) => edge.supporting_posting_ids),
      ).size,
    [graph.edges],
  );
  const display = useMemo<SkillGraphDisplaySettings>(
    () => ({
      ...DEFAULT_DISPLAY,
      labelThreshold: graphMode === "all" ? 1.28 : DEFAULT_DISPLAY.labelThreshold,
    }),
    [graphMode],
  );
  const forces = useMemo<SkillGraphForceSettings>(
    () => ({
      ...DEFAULT_FORCES,
      linkDistance: graphMode === "all" ? 62 : DEFAULT_FORCES.linkDistance,
      repel: graphMode === "all" ? 190 : DEFAULT_FORCES.repel,
    }),
    [graphMode],
  );

  useEffect(() => {
    const stored = readOwnedSkills();
    if (stored.length > 0) {
      setOwnedSkills(stored);
    }
  }, []);

  useEffect(() => {
    const compactLayout = window.matchMedia("(max-width: 900px)");
    const syncDisclosure = () => setControlsOpen(!compactLayout.matches);
    syncDisclosure();
    compactLayout.addEventListener("change", syncDisclosure);
    return () => compactLayout.removeEventListener("change", syncDisclosure);
  }, []);

  useEffect(() => {
    const compactLayout = window.matchMedia("(max-width: 640px)");
    const syncGraphBudget = () => setCompactGraph(compactLayout.matches);
    syncGraphBudget();
    compactLayout.addEventListener("change", syncGraphBudget);
    return () => compactLayout.removeEventListener("change", syncGraphBudget);
  }, []);

  useEffect(() => {
    topologyRequestRef.current?.abort();
    topologyCache.current.set(
      topologyCacheKey(initialGraph.seed, careerType),
      initialGraph,
    );
    setGraph(initialGraph);
    setSelectedId(initialSelection);
    selectedIdRef.current = initialSelection;
    setGraphMode(initialSelection ? "focus" : "overview");
    setForceReady(false);
    setTopologyState("idle");
  }, [careerType, initialGraph, initialSelection]);

  useEffect(
    () => () => {
      topologyRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    function restoreSelectionFromHistory() {
      const requested = new URL(window.location.href).searchParams
        .get("seed")
        ?.trim() || null;
      const nextSelection = requested;
      selectedIdRef.current = nextSelection;
      setSelectedId(nextSelection);
      setGraphMode(nextSelection ? "focus" : "overview");
      setForceReady(false);
      void loadTopology(nextSelection);
    }

    window.addEventListener("popstate", restoreSelectionFromHistory);
    return () => window.removeEventListener("popstate", restoreSelectionFromHistory);
  }, [loadTopology]);

  useEffect(() => {
    let cancelled = false;

    async function requestFit() {
      if (ownedSkills.length === 0) {
        setFit(null);
        setFitState("idle");
        return;
      }

      setFit(null);
      setFitState("loading");
      try {
        const response = await fetch("/skills/graph/fit", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            owned_skills: ownedSkills,
            ...(careerType ? { career_type: careerType } : {}),
          }),
        });
        if (!response.ok) {
          throw new Error("fit request failed");
        }
        const payload = (await response.json()) as FitAnalyzeResponse;
        if (!cancelled) {
          setFit(payload);
          setFitState("idle");
        }
      } catch {
        if (!cancelled) {
          setFit(null);
          setFitState("error");
        }
      }
    }

    requestFit();

    return () => {
      cancelled = true;
    };
  }, [careerType, ownedSkills]);

  useEffect(() => {
    if (!selectedId) {
      setEvidence({ status: "idle", items: [], total: 0 });
      return;
    }
    const evidenceSkill = selectedId;

    const cacheKey = `${careerType ?? "all"}:${evidenceSkill}`;
    const cached = evidenceCache.current.get(cacheKey);
    if (cached) {
      setEvidence({
        status: cached.items.length > 0 ? "ready" : "empty",
        items: cached.items,
        total: cached.total,
      });
      return;
    }

    const controller = new AbortController();
    setEvidence({ status: "loading", items: [], total: 0 });

    async function requestEvidence() {
      try {
        const params = new URLSearchParams({ skill: evidenceSkill });
        if (careerType) {
          params.set("career_type", careerType);
        }
        params.set("limit", "6");
        const response = await fetch(
          `/skills/graph/evidence?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error("evidence request failed");
        }
        const payload = (await response.json()) as SkillGraphEvidenceResponse;
        if (controller.signal.aborted) {
          return;
        }
        const normalized = {
          items: Array.isArray(payload.items) ? payload.items.slice(0, 6) : [],
          total: Number.isFinite(payload.total) ? Math.max(0, payload.total) : 0,
        };
        evidenceCache.current.set(cacheKey, normalized);
        setEvidence({
          status: normalized.items.length > 0 ? "ready" : "empty",
          items: normalized.items,
          total: normalized.total,
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setEvidence({ status: "error", items: [], total: 0 });
      }
    }

    requestEvidence();
    return () => controller.abort();
  }, [careerType, evidenceRetryKey, selectedId]);

  const writeSelectionUrl = useCallback((nodeId: string | null, mode: "push" | "replace") => {
    const url = new URL(window.location.href);
    url.pathname = "/skills/graph";
    if (nodeId) {
      url.searchParams.set("seed", nodeId);
    } else {
      url.searchParams.delete("seed");
    }
    if (careerTypeRef.current) {
      url.searchParams.set("career_type", careerTypeRef.current);
    }
    url.searchParams.delete("owned_skills");
    ownedSkillsRef.current.forEach((skill) => {
      url.searchParams.append("owned_skills", skill);
    });
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (mode === "push") {
      window.history.pushState(null, "", nextUrl);
    } else {
      window.history.replaceState(null, "", nextUrl);
    }
  }, []);

  const selectSkill = useCallback(
    (nodeId: string) => {
      if (selectedIdRef.current === nodeId) {
        const inspector = inspectorRef.current;
        const focusTarget =
          inspector?.querySelector<HTMLElement>("button:not(:disabled), a[href]") ??
          inspector;
        focusTarget?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
        focusTarget?.focus({ preventScroll: true });
        setAnnouncement(`${nodeId} 기술의 상세 정보를 표시했습니다.`);
        return;
      }
      selectedIdRef.current = nodeId;
      setSelectedId(nodeId);
      setGraphMode("focus");
      setForceReady(false);
      writeSelectionUrl(nodeId, "push");
      void loadTopology(nodeId);
      setAnnouncement(`${nodeId} 중심의 기술 관계를 표시합니다.`);
    },
    [loadTopology, writeSelectionUrl],
  );

  function addSkill(nextSkill = input.trim()) {
    const next = nextSkill.trim();
    if (!next) {
      return;
    }
    setOwnedSkills((current) => writeOwnedSkills([...current, next]));
    setInput("");
    setAnnouncement(`${next} 기술을 현재 목록에 추가했습니다.`);
  }

  function removeSkill(skill: string) {
    setOwnedSkills((current) => writeOwnedSkills(current.filter((item) => item !== skill)));
    setAnnouncement(`${skill} 기술을 현재 목록에서 제거했습니다.`);
  }

  function toggleDomain(domain: string) {
    setDisabledDomains((current) =>
      current.includes(domain)
        ? current.filter((item) => item !== domain)
        : [...current, domain],
    );
  }

  function resetGraphView() {
    setGraphMode(initialSelection ? "focus" : "overview");
    setSelectedId(initialSelection);
    selectedIdRef.current = initialSelection;
    setFilterQuery("");
    setDisabledDomains([]);
    setForceReady(false);
    writeSelectionUrl(initialSelection, "replace");
    void loadTopology(initialSelection);
  }

  function showGlobalGraph(mode: Extract<SkillGraphViewMode, "overview" | "all">) {
    selectedIdRef.current = null;
    setSelectedId(null);
    setGraphMode(mode);
    setForceReady(false);
    writeSelectionUrl(null, "push");
    void loadTopology(null);
    setAnnouncement(
      mode === "overview"
        ? "시장 수요가 높은 핵심 기술을 표시합니다."
        : "현재 수집 범위의 전체 기술을 표시합니다.",
    );
  }

  return (
    <main className={styles.page}>
      <section aria-label={SKILL_MAP_COPY.title} className={styles.experience}>
        <header className={styles.intro}>
          <div className={styles.introCopy}>
            <h1>{SKILL_MAP_COPY.title}</h1>
            <p className={styles.description}>{SKILL_MAP_COPY.description}</p>
            <div className={styles.trustLine}>
              <span>
                {loadFailed ? "그래프 범위 확인 불가" : summarizeGraph(graph)}
              </span>
              <Link href="/methodology">분석 방법</Link>
              <Link href="/data-policy">데이터 범위</Link>
            </div>
          </div>

          <div className={styles.searchArea}>
            <label className={styles.search} htmlFor="skill-graph-search">
              <MagnifyingGlass aria-hidden="true" size={19} />
              <input
                aria-label="그래프 검색"
                id="skill-graph-search"
                onChange={(event) => setFilterQuery(event.target.value)}
                placeholder="기술 이름으로 그래프 좁히기"
                type="search"
                value={filterQuery}
              />
            </label>
            <dl
              aria-label="현재 그래프 규모"
              className={styles.graphMetrics}
              role="group"
            >
              <div>
                <dt>표시 기술</dt>
                <dd>{loadFailed ? "확인 불가" : viewData.stats.skillCount}</dd>
              </div>
              <div>
                <dt>표시 관계</dt>
                <dd>{loadFailed ? "확인 불가" : viewData.stats.linkCount}</dd>
              </div>
              <div>
                <dt>전체 근거</dt>
                <dd>{loadFailed ? "확인 불가" : totalEvidenceCount}</dd>
              </div>
            </dl>
          </div>
        </header>

        {loadFailed && (
          <section className={styles.errorState} role="alert">
            <div>
              <strong>{GRAPH_STATES.loadError}</strong>
            </div>
            <Link href={retryHref}>다시 시도</Link>
          </section>
        )}

        <nav aria-label="빠른 기술 선택" className={styles.quickSkills}>
          <span>빠른 선택</span>
          <div>
            {quickSkills.map((skill) => (
              <Link
                aria-current={selectedId === skill ? "page" : undefined}
                data-active={selectedId === skill ? "true" : undefined}
                href={buildSkillGraphHref({
                  skill,
                  owned_skills: ownedSkills,
                  ...(careerType ? { career_type: careerType } : {}),
                })}
                key={skill}
              >
                {skill}
              </Link>
            ))}
          </div>
        </nav>

        <div className={styles.workspace}>
          <aside
            aria-label={`${SKILL_MAP_COPY.ownedSkills}과 ${SKILL_MAP_COPY.filters}`}
            className={styles.controls}
          >
            <details
              className={styles.controlsDisclosure}
              open={controlsOpen}
            >
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  setControlsOpen((current) => !current);
                }}
              >
                <span>
                  {SKILL_MAP_COPY.ownedSkills}과 {SKILL_MAP_COPY.filters}
                </span>
                <small>
                  {ownedSkills.length}개 · {
                    graphMode === "overview"
                      ? "시장 핵심"
                      : graphMode === "focus"
                        ? "선택 주변"
                        : "전체 기술"
                  }
                </small>
              </summary>

              <div className={styles.controlsContent}>
                <section className={styles.controlSection}>
                  <header className={styles.sectionHeader}>
                    <div>
                      <p>추가한 기술</p>
                      <h2>{SKILL_MAP_COPY.ownedSkills}</h2>
                    </div>
                    <span>{ownedSkills.length}개</span>
                  </header>

                  <form
                    className={styles.skillForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      addSkill();
                    }}
                  >
                    <label htmlFor="owned-skill">{SKILL_MAP_COPY.addSkill}</label>
                    <div>
                      <input
                        id="owned-skill"
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="예: ROS2"
                        value={input}
                      />
                      <button type="submit">추가</button>
                    </div>
                  </form>

                  {ownedSkills.length > 0 ? (
                    <div
                      aria-label={`${SKILL_MAP_COPY.ownedSkills} 목록`}
                      className={styles.ownedSkills}
                    >
                      {ownedSkills.map((skill) => (
                        <button
                          aria-label={`${skill} 제거`}
                          key={skill}
                          onClick={() => removeSkill(skill)}
                          type="button"
                        >
                          {skill}
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptyCopy}>
                      추가한 기술이 없습니다. 위에서 기술을 추가해 주세요.
                    </p>
                  )}
                </section>

                <section className={styles.controlSection}>
                  <header className={styles.sectionHeader}>
                    <div>
                      <p>관계 범위</p>
                      <h2>{SKILL_MAP_COPY.filters}</h2>
                    </div>
                    <button className={styles.resetButton} onClick={resetGraphView} type="button">
                      초기화
                    </button>
                  </header>

                  <div aria-label="그래프 범위" className={styles.segmented}>
                    <button
                      aria-pressed={graphMode === "overview"}
                      data-active={graphMode === "overview" ? "true" : undefined}
                      onClick={() => showGlobalGraph("overview")}
                      type="button"
                    >
                      시장 핵심
                    </button>
                    <button
                      aria-pressed={graphMode === "focus"}
                      data-active={graphMode === "focus" ? "true" : undefined}
                      disabled={!selectedId}
                      onClick={() => setGraphMode("focus")}
                      type="button"
                    >
                      선택 주변
                    </button>
                    <button
                      aria-pressed={graphMode === "all"}
                      data-active={graphMode === "all" ? "true" : undefined}
                      onClick={() => showGlobalGraph("all")}
                      type="button"
                    >
                      전체 기술
                    </button>
                  </div>
                </section>

                <section className={styles.controlSection}>
                  <header className={styles.sectionHeader}>
                    <div>
                      <p>직무 분야</p>
                      <h2>분야 필터</h2>
                    </div>
                    <span>
                      {enabledDomains.length}/{allDomains.length}
                    </span>
                  </header>
                  <div className={styles.domainFilters}>
                    {allDomains.slice(0, 9).map((group) => {
                      const enabled = !disabledDomains.includes(group.domain);
                      return (
                        <button
                          aria-pressed={enabled}
                          data-active={enabled ? "true" : undefined}
                          key={group.domain}
                          onClick={() => toggleDomain(group.domain)}
                          type="button"
                        >
                          <i style={{ backgroundColor: group.color }} />
                          <span>{displayDomain(group.domain)}</span>
                          <b>{group.count}</b>
                        </button>
                      );
                    })}
                    {allDomains.length === 0 && (
                      <p className={styles.emptyCopy}>확인 가능한 분야 데이터가 없습니다.</p>
                    )}
                  </div>
                </section>

              </div>
            </details>
          </aside>

          <section aria-label="기술 관계 그래프" className={styles.graphColumn}>
            <div className={styles.graphFrame} data-testid="skill-graph-frame">
              <SkillGraphForceCanvas
                data={viewData}
                display={display}
                forces={forces}
                onNodeSelect={selectSkill}
                onReadyChange={setForceReady}
                reheatKey={0}
                selectedId={selectedId}
              />

              <p
                aria-label="스킬맵 범례"
                className={styles.graphLegend}
                role="note"
              >
                <span><b>크기</b>: 시장 수요</span>
                <i aria-hidden="true" />
                <span><b>테두리</b>: 내 기술</span>
                <i aria-hidden="true" />
                <span><b>점선</b>: 추천 기술</span>
                <i aria-hidden="true" />
                <span><b>선 농도</b>: 함께 요구</span>
              </p>

              <div className={styles.graphStatus}>
                <span>
                  {graphMode === "overview"
                    ? "시장 핵심"
                    : graphMode === "focus"
                      ? "선택 주변"
                      : "전체 기술"}
                </span>
                {topologyState === "idle" && (
                  <>
                    <span className={styles.pointerHint}>
                      {SKILL_MAP_COPY.desktopControls}
                    </span>
                    <span className={styles.touchHint}>{SKILL_MAP_COPY.mobileControls}</span>
                  </>
                )}
                {topologyState === "loading" && (
                  <span aria-live="polite" role="status">관계망을 불러오는 중</span>
                )}
                {topologyState === "error" && (
                  <span role="alert">이전 관계망 표시 중</span>
                )}
              </div>

              {viewData.nodes.length === 0 && (
                <div className={`graph-empty-state ${styles.emptyState}`}>
                  <div className="graph-empty-state__constellation" aria-hidden="true">
                    <svg viewBox="0 0 100 100">
                      {PREVIEW_LINKS.map((link) => (
                        <line
                          key={link.id}
                          x1={link.source.x}
                          x2={link.target.x}
                          y1={link.source.y}
                          y2={link.target.y}
                        />
                      ))}
                    </svg>
                    {PREVIEW_DOTS.map((dot) => (
                      <i
                        key={dot.id}
                        style={
                          {
                            "--dot-color": dot.color,
                            "--dot-size": `${dot.size}px`,
                            "--dot-x": `${dot.x}%`,
                            "--dot-y": `${dot.y}%`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <strong>{GRAPH_STATES.empty}</strong>
                  {isFilteredEmpty && (
                    <button onClick={resetGraphView} type="button">
                      필터 초기화
                    </button>
                  )}
                </div>
              )}

              {showFallbackGraph && (
                <>
                  <svg className="graph-edges" aria-hidden="true" viewBox="0 0 100 100">
                    {viewData.links
                      .filter((link) => link.kind === "skill")
                      .map((edge) => {
                        const source = nodeMap.get(edge.source);
                        const target = nodeMap.get(edge.target);
                        if (!source || !target) return null;
                        return (
                          <line
                            key={edge.id}
                            stroke={skillGraphLinkColor(edge.score, true, false)}
                            strokeWidth={skillGraphLinkWidth(
                              edge.value,
                              DEFAULT_DISPLAY.linkThickness,
                              true,
                              0,
                            )}
                            x1={source.x}
                            x2={target.x}
                            y1={source.y}
                            y2={target.y}
                          />
                        );
                      })}
                  </svg>
                  {nodes.map((node) => (
                    <button
                      className={`graph-node ${node.seed ? "graph-node--seed" : ""} ${
                        selectedId === node.id ? "is-selected" : ""
                      }`}
                      data-owned={node.owned ? "true" : "false"}
                      data-recommended={node.recommended ? "true" : "false"}
                      key={node.id}
                      onClick={() => selectSkill(node.id)}
                      style={
                        {
                          "--node-color": selectedId === node.id
                            ? GRAPH_CANVAS_COLORS.selectedNode
                            : GRAPH_CANVAS_COLORS.neutralNode,
                          "--node-ring": node.owned
                            ? GRAPH_CANVAS_COLORS.ownedRing
                            : GRAPH_CANVAS_COLORS.recommendedRing,
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                        } as CSSProperties
                      }
                      type="button"
                    >
                      <span>{node.label}</span>
                    </button>
                  ))}
                </>
              )}
            </div>

            <section aria-label={SKILL_MAP_COPY.recommendation} className={styles.signals}>
              <article>
                <header className={styles.sectionHeader}>
                  <div>
                    <p>내 기술 비교</p>
                    <h2>{SKILL_MAP_COPY.recommendation}</h2>
                  </div>
                  <span>{fitState === "loading" ? "분석 중" : "공고 근거"}</span>
                </header>
                <div className={styles.nextSkills}>
                  {fitState === "loading" && (
                    <p role="status">{GRAPH_STATES.fitLoading}</p>
                  )}
                  {fitState === "error" && (
                    <p role="alert">{GRAPH_STATES.fitError}</p>
                  )}
                  {fitState === "idle" &&
                    (fit?.recommended_next_skills ?? []).slice(0, 4).map((skill) => (
                      <Link
                        href={`/skill-map?skill=${encodeURIComponent(skill.skill)}${
                          careerType
                            ? `&career_type=${encodeURIComponent(careerType)}`
                            : ""
                        }`}
                        key={skill.skill}
                      >
                        <strong>{skill.skill}</strong>
                        <span>{skill.supporting_posting_count}개 공고 근거</span>
                      </Link>
                    ))}
                  {fitState === "idle" && !fit && ownedSkills.length === 0 && (
                    <p>
                      내 기술을 추가하면 공고에서 함께 요구되는 기술이 표시됩니다.
                    </p>
                  )}
                  {fitState === "idle" && fit?.recommended_next_skills.length === 0 && (
                    <p>현재 공고에서 함께 요구되는 기술을 찾지 못했습니다.</p>
                  )}
                </div>
              </article>

              <article>
                <header className={styles.sectionHeader}>
                  <div>
                    <p>현재 그래프 구성</p>
                    <h2>분야 분포</h2>
                  </div>
                  <span>{allDomains.length}개 분야</span>
                </header>
                <div className={styles.domainSignals}>
                  {allDomains.slice(0, 6).map((domain) => (
                    <span key={domain.domain}>
                      <i style={{ backgroundColor: domain.color }} />
                      {displayDomain(domain.domain)}
                      <b>{domain.count}</b>
                    </span>
                  ))}
                  {allDomains.length === 0 && <p>확인 가능한 분야 데이터가 없습니다.</p>}
                </div>
              </article>
            </section>
          </section>

          <aside
            aria-label="선택 기술 분석"
            className={styles.inspector}
            ref={inspectorRef}
            tabIndex={-1}
          >
            <section className={styles.selectedSkill}>
              <p className={styles.eyebrow}>선택 기술</p>
              <h2>{selected?.label ?? "기술을 선택해 주세요"}</h2>
              <p>
                {selected
                  ? `${selected.domains.map(displayDomain).join(", ")} 분야의 공개 공고에서 확인한 수치입니다.`
                  : "기술을 선택하면 관련 공고와 함께 요구되는 기술을 확인할 수 있습니다."}
              </p>
              <dl className={styles.evidenceMetrics}>
                <div>
                  <dt>언급 공고</dt>
                  <dd>{selected ? `${selected.demand_count}건` : "—"}</dd>
                </div>
                <div>
                  <dt>필수</dt>
                  <dd>{selected ? `${selected.required_count}건` : "—"}</dd>
                </div>
                <div>
                  <dt>우대</dt>
                  <dd>{selected ? `${selected.preferred_count}건` : "—"}</dd>
                </div>
                <div>
                  <dt>{PRODUCT_TERMS.unspecifiedRequirement}</dt>
                  <dd>{selected ? `${selected.unspecified_count}건` : "—"}</dd>
                </div>
                <div>
                  <dt>직접 연결</dt>
                  <dd>{selected ? `${directConnectionCount}개` : "—"}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.inspectorSection}>
              <header className={styles.sectionHeader}>
                <div>
                  <p>공고 동시 등장</p>
                  <h2>{SKILL_MAP_COPY.related}</h2>
                </div>
                <span>{strongestConnections.length}개</span>
              </header>
              <ul className={styles.connectionList}>
                {strongestConnections.length > 0 ? (
                  strongestConnections.map(({ edge, node }) => (
                    <li key={edge.id}>
                      <button onClick={() => selectSkill(node.id)} type="button">
                        <span>{node.label}</span>
                        <b>함께 {edge.cooccurrence_count}건</b>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className={styles.emptyCopy}>확인 가능한 직접 관계가 없습니다.</li>
                )}
              </ul>
            </section>

            <section className={styles.inspectorSection}>
              <header className={styles.sectionHeader}>
                <div>
                  <p>공식 원문 기반</p>
                  <h2>관련 공고</h2>
                </div>
                <span>
                  {evidence.status === "ready" && evidence.total > 6
                    ? `전체 ${evidence.total}건 중 최대 6건`
                    : evidence.status === "ready" || evidence.status === "empty"
                      ? `${evidence.total}건`
                      : "선택 후 확인"}
                </span>
              </header>
              <ul className={styles.jobEvidence}>
                {evidence.status === "ready" && relatedEvidence.length > 0 &&
                  relatedEvidence.map((item) => (
                    <li key={item.posting_id}>
                      <Link href={`/jobs/${encodeURIComponent(item.posting_id)}`}>
                        <span>{item.company_name}</span>
                        <strong>{item.title}</strong>
                        <small>공고 분석 보기</small>
                      </Link>
                    </li>
                  ))}
                {evidence.status === "idle" && (
                  <li className={styles.evidenceState}>
                    기술을 선택하면 관련 공고를 확인할 수 있습니다.
                  </li>
                )}
                {evidence.status === "loading" && (
                  <li className={styles.evidenceState} role="status">
                    관련 공고를 불러오는 중입니다.
                  </li>
                )}
                {evidence.status === "empty" && (
                  <li className={styles.evidenceState}>
                    현재 공개된 근거 공고가 없습니다.
                  </li>
                )}
                {evidence.status === "error" && (
                  <li className={styles.evidenceState} role="alert">
                    <span>근거 공고를 불러오지 못했습니다.</span>
                    <button
                      onClick={() => setEvidenceRetryKey((current) => current + 1)}
                      type="button"
                    >
                      다시 시도
                    </button>
                  </li>
                )}
              </ul>
            </section>

            <section className={styles.recommendation}>
              <p className={styles.eyebrow}>학습 근거</p>
              <strong>
                {fitState === "loading"
                  ? GRAPH_STATES.fitLoading
                  : fitState === "error"
                    ? GRAPH_STATES.fitError
                    : topNextSkill?.skill ?? "내 기술을 먼저 추가해 주세요"}
              </strong>
              <span>
                {fitState === "loading"
                  ? GRAPH_STATES.fitLoading
                  : fitState === "error"
                    ? GRAPH_STATES.fitError
                    : topNextSkill?.reason ??
                      "기술을 추가하면 다음 학습 근거를 확인할 수 있습니다."}
              </span>
            </section>
          </aside>
        </div>

        <p aria-live="polite" className={styles.srOnly}>
          {announcement}
        </p>
      </section>
    </main>
  );
}
