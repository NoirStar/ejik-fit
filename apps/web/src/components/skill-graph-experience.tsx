"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { SkillPicker } from "@/features/owned-skills/skill-picker";
import { buildSearchScopeHref } from "@/features/search/model";
import type { CareerCondition } from "@/lib/career-preferences";
import { PRODUCT_TERMS } from "@/lib/labels";
import {
  MAX_OWNED_SKILL_LENGTH,
  MAX_OWNED_SKILLS,
  readOwnedSkills,
  subscribeOwnedSkills,
  writeOwnedSkills,
} from "@/lib/owned-skills";
import {
  resolvedSkillKey,
  resolveSkillInput,
  skillIdentityKey,
  skillNameKey,
} from "@/lib/skill-catalog";
import { summarizeGraph } from "@/lib/skill-graph";
import {
  skillGraphLinkColor,
  skillGraphLinkWidth,
} from "@/lib/skill-graph-canvas-style";
import { findStrongestSkillGraphPath } from "@/lib/skill-graph-path";
import { buildSkillGraphView } from "@/lib/skill-graph-view";
import type {
  SkillGraphViewMode,
  SkillGraphViewNode,
} from "@/lib/skill-graph-view";
import {
  buildVisibleSkillGraphLinkIds,
  skillGraphLabelLimit,
} from "@/lib/skill-graph-visibility";
import type {
  SkillGraphLabelDensity,
  SkillGraphRelationshipDensity,
} from "@/lib/skill-graph-visibility";
import type {
  FitAnalyzeResponse,
  SkillCatalogItem,
  SkillGraphEvidence,
  SkillGraphEvidenceResponse,
  SkillGraphNode,
  SkillGraphResponse,
} from "@/lib/types";
import { GRAPH_CANVAS_COLORS } from "@/styles/design-tokens";

import { SkillGraphForceCanvas } from "./skill-graph-force-canvas";
import type {
  SkillGraphDisplaySettings,
  SkillGraphForceSettings,
} from "./skill-graph-force-canvas";
import { SkillGraphSearch } from "./skill-graph-search";
import styles from "./skill-graph-atlas.module.css";


type PositionedNode = SkillGraphViewNode & {
  x: number;
  y: number;
};


type SkillGraphExperienceProps = {
  careerType?: Exclude<CareerCondition, "">;
  initialDepth?: 1 | 2;
  initialGraph: SkillGraphResponse;
  initialOwnedSkills: string[];
  initialSelectedSkill?: string;
  initialSkillCatalog?: readonly SkillCatalogItem[];
  loadFailed?: boolean;
  retryHref?: string;
};


type EvidenceState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  items: SkillGraphEvidence[];
  total: number;
};


type TopologyState = "idle" | "loading" | "error";


const EMPTY_SKILL_CATALOG: readonly SkillCatalogItem[] = [];


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


const RELATIONSHIP_DENSITY_LABELS: Record<
  SkillGraphRelationshipDensity,
  string
> = {
  core: "핵심",
  balanced: "균형",
  detailed: "자세히",
};


const COPY = {
  description:
    "공개 채용 공고에서 함께 요구되는 기술 관계를 보고 다음 학습 방향을 정해 보세요.",
  desktopControls: "드래그 · 확대 · 기술 선택",
  empty: "표시할 기술이 없습니다. 분야 필터를 줄여 주세요.",
  evidenceError: "근거 공고를 불러오지 못했습니다.",
  fitError: "내 기술을 비교하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  fitLoading: "내 기술과 공고를 비교하고 있습니다.",
  loadError: "스킬맵을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
  mobileControls: "기술을 누르거나 그래프 조작을 시작하세요",
};


const DEFAULT_DISPLAY: SkillGraphDisplaySettings = {
  animate: true,
  arrows: false,
  labelLimit: 14,
  labelThreshold: 1.08,
  linkThickness: 1,
  nodeScale: 0.9,
};


const DEFAULT_FORCES: SkillGraphForceSettings = {
  center: 0.04,
  cluster: 0.075,
  clusterSpread: 210,
  link: 0.28,
  linkDistance: 82,
  repel: 240,
};


function displayDomain(domain: string) {
  return DOMAIN_LABELS[domain] ?? domain.replace(/_/g, " ");
}


function stableCoordinate(value: number) {
  return Number(value.toFixed(4));
}


function positionNodes(nodes: readonly SkillGraphViewNode[]): PositionedNode[] {
  if (nodes.length === 0) return [];
  const seed = nodes.find((node) => node.seed) ?? nodes[0]!;
  const outer = nodes.filter((node) => node.id !== seed.id);
  return [
    { ...seed, x: 50, y: 50 },
    ...outer.map((node, index) => {
      const angle = (index / Math.max(outer.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = 29 + (index % 4) * 5;
      return {
        ...node,
        x: stableCoordinate(50 + Math.cos(angle) * radius),
        y: stableCoordinate(50 + Math.sin(angle) * radius),
      };
    }),
  ];
}


function chooseInitialSelection(
  graph: SkillGraphResponse,
  requestedSkill?: string,
) {
  const requestedKey = skillIdentityKey(requestedSkill ?? graph.seed ?? "");
  if (!requestedKey) return null;
  return graph.nodes.find((node) => skillIdentityKey(node.id) === requestedKey)?.id ?? null;
}


function topologyCacheKey(
  seed: string | null,
  careerType: Exclude<CareerCondition, ""> | undefined,
  depth: 1 | 2,
) {
  return `${careerType ?? "all"}:${depth}:${seed?.toLocaleLowerCase("en-US") ?? "atlas"}`;
}


function isSkillGraphResponse(value: unknown): value is SkillGraphResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<SkillGraphResponse>;
  return (
    (typeof candidate.seed === "string" || candidate.seed === null) &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges) &&
    Array.isArray(candidate.evidence) &&
    Boolean(candidate.meta && typeof candidate.meta === "object")
  );
}


function buildGraphCatalog(
  catalog: readonly SkillCatalogItem[],
  nodes: readonly SkillGraphNode[],
) {
  const byName = new Map(catalog.map((item) => [skillNameKey(item.name), item]));
  nodes.forEach((node) => {
    const key = skillNameKey(node.id);
    if (!byName.has(key)) {
      byName.set(key, {
        name: node.id,
        category: node.category,
        kind: node.kind,
        domains: node.domains,
      });
    }
  });
  return [...byName.values()];
}


function canonicalizeOwnedSkills(
  skills: readonly string[],
  catalog: readonly SkillCatalogItem[],
) {
  const byIdentity = new Map<string, string>();
  skills.forEach((skill) => {
    const canonical = resolveSkillInput(skill, catalog);
    const key = resolvedSkillKey(canonical, catalog);
    if (key && !byIdentity.has(key)) byIdentity.set(key, canonical);
  });
  return [...byIdentity.values()].sort((left, right) =>
    left.localeCompare(right, "ko"),
  );
}


export function SkillGraphExperience({
  careerType,
  initialDepth = 1,
  initialGraph,
  initialOwnedSkills,
  initialSelectedSkill,
  initialSkillCatalog = EMPTY_SKILL_CATALOG,
  loadFailed = false,
  retryHref = "/skills/graph",
}: SkillGraphExperienceProps) {
  const initialSelection = useMemo(
    () => chooseInitialSelection(initialGraph, initialSelectedSkill),
    [initialGraph, initialSelectedSkill],
  );
  const startingCatalog = useMemo(
    () => buildGraphCatalog(initialSkillCatalog, initialGraph.nodes),
    [initialGraph.nodes, initialSkillCatalog],
  );
  const [graph, setGraph] = useState(initialGraph);
  const [depth, setDepth] = useState<1 | 2>(initialDepth);
  const [ownedSkills, setOwnedSkills] = useState(() =>
    canonicalizeOwnedSkills(initialOwnedSkills, startingCatalog),
  );
  const [ownedSkillInput, setOwnedSkillInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection);
  const [graphMode, setGraphMode] = useState<SkillGraphViewMode>("all");
  const [relationshipDensity, setRelationshipDensity] =
    useState<SkillGraphRelationshipDensity>("core");
  const [labelDensity, setLabelDensity] =
    useState<SkillGraphLabelDensity>("key");
  const [pathEmphasisEnabled, setPathEmphasisEnabled] = useState(false);
  const [disabledDomains, setDisabledDomains] = useState<string[]>([]);
  const [compactGraph, setCompactGraph] = useState(false);
  const [forceReady, setForceReady] = useState(false);
  const [graphInteractionEnabled, setGraphInteractionEnabled] = useState(false);
  const [topologyState, setTopologyState] = useState<TopologyState>("idle");
  const [fit, setFit] = useState<FitAnalyzeResponse | null>(null);
  const [fitState, setFitState] = useState<"idle" | "loading" | "error">("idle");
  const [evidence, setEvidence] = useState<EvidenceState>({
    status: "idle",
    items: [],
    total: 0,
  });
  const [evidenceRetryKey, setEvidenceRetryKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const evidenceCache = useRef(new Map<string, SkillGraphEvidenceResponse>());
  const topologyCache = useRef(new Map<string, SkillGraphResponse>());
  const topologyRequestRef = useRef<AbortController | null>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const selectedIdRef = useRef<string | null>(initialSelection);
  const careerTypeRef = useRef(careerType);
  const depthRef = useRef<1 | 2>(initialDepth);
  const graphModeRef = useRef<SkillGraphViewMode>("all");
  const ownedSkillsRef = useRef(ownedSkills);
  const graphCatalogRef = useRef(startingCatalog);

  selectedIdRef.current = selectedId;
  careerTypeRef.current = careerType;
  depthRef.current = depth;
  graphModeRef.current = graphMode;
  ownedSkillsRef.current = ownedSkills;

  const loadTopology = useCallback(async (
    seed: string | null,
    requestedDepth = depthRef.current,
  ) => {
    const scope = careerTypeRef.current;
    const cacheKey = topologyCacheKey(seed, scope, requestedDepth);
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
    const params = new URLSearchParams({
      limit: seed ? "30" : "60",
      depth: String(requestedDepth),
    });
    if (seed) params.set("seed", seed);
    if (scope) params.set("career_type", scope);

    try {
      const response = await fetch(`/skills/graph/data?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("topology request failed");
      const payload = (await response.json()) as unknown;
      if (!isSkillGraphResponse(payload)) throw new Error("invalid topology response");
      if (controller.signal.aborted) return;

      if (topologyCache.current.size >= 24) {
        const oldest = topologyCache.current.keys().next().value;
        if (typeof oldest === "string") topologyCache.current.delete(oldest);
      }
      topologyCache.current.set(cacheKey, payload);
      setGraph(payload);

      if (seed) {
        const requestedKey = resolvedSkillKey(seed, graphCatalogRef.current);
        const canonicalSeed = payload.nodes.find(
          (node) => resolvedSkillKey(node.id, graphCatalogRef.current) === requestedKey,
        )?.id;
        if (canonicalSeed && selectedIdRef.current) {
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
      ) return;
      if (topologyRequestRef.current === controller) {
        topologyRequestRef.current = null;
      }
      setTopologyState("error");
    }
  }, []);

  const graphCatalog = useMemo(
    () => buildGraphCatalog(
      initialSkillCatalog,
      [...initialGraph.nodes, ...graph.nodes],
    ),
    [graph.nodes, initialGraph.nodes, initialSkillCatalog],
  );
  graphCatalogRef.current = graphCatalog;

  const graphNodeMap = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const selected = selectedId ? graphNodeMap.get(selectedId) ?? null : null;
  const selectedOwned = selected
    ? ownedSkills.some(
        (skill) =>
          resolvedSkillKey(skill, graphCatalog) ===
          resolvedSkillKey(selected.id, graphCatalog),
      )
    : false;
  const allDomains = useMemo(() => buildSkillGraphView(graph).domains, [graph]);
  const enabledDomains = useMemo(
    () => allDomains
      .map((domain) => domain.domain)
      .filter((domain) => !disabledDomains.includes(domain)),
    [allDomains, disabledDomains],
  );
  const recommendedIds = useMemo(
    () => fitState === "idle"
      ? (fit?.recommended_next_skills ?? []).slice(0, 3).map(({ skill }) => skill)
      : [],
    [fit, fitState],
  );
  const viewData = useMemo(() => {
    const compactAtlas = compactGraph && graphMode === "all";
    return buildSkillGraphView(graph, {
      enabledDomains: allDomains.length > 0 ? enabledDomains : undefined,
      linkLimit: compactAtlas ? 48 : undefined,
      mode: graphMode,
      nodeLimit: compactAtlas ? 30 : undefined,
      ownedIds: ownedSkills,
      recommendedIds,
      selectedId,
    });
  }, [
    allDomains.length,
    compactGraph,
    enabledDomains,
    graph,
    graphMode,
    ownedSkills,
    recommendedIds,
    selectedId,
  ]);
  const positionedNodes = useMemo(
    () => positionNodes(viewData.nodes.filter((node) => node.kind === "skill")),
    [viewData.nodes],
  );
  const positionedNodeMap = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );
  const showFallbackGraph = positionedNodes.length > 0 && !forceReady;
  const isFilteredEmpty = graph.nodes.length > 0 && viewData.nodes.length === 0;
  const visibleLinkIds = useMemo(
    () => buildVisibleSkillGraphLinkIds(
      viewData.links,
      viewData.stats.skillCount,
      relationshipDensity,
    ),
    [relationshipDensity, viewData.links, viewData.stats.skillCount],
  );
  const marketPath = useMemo(() => {
    if (!selectedId) return null;
    return findStrongestSkillGraphPath({
      nodes: viewData.nodes,
      links: viewData.links,
      sourceIds: viewData.nodes
        .filter((node) => node.kind === "skill" && node.owned)
        .map(({ id }) => id),
      targetId: selectedId,
      maxHops: 4,
    });
  }, [selectedId, viewData.links, viewData.nodes]);
  const marketPathLabels = useMemo(() => {
    if (!marketPath) return [];
    const labels = new Map(viewData.nodes.map((node) => [node.id, node.label]));
    return marketPath.nodeIds.map((nodeId) => labels.get(nodeId) ?? nodeId);
  }, [marketPath, viewData.nodes]);
  const pathEmphasis = useMemo(
    () => pathEmphasisEnabled && marketPath && marketPath.hopCount > 0
      ? { nodeIds: marketPath.nodeIds, linkIds: marketPath.linkIds }
      : null,
    [marketPath, pathEmphasisEnabled],
  );

  const strongestConnections = useMemo(() => {
    const focusIds = new Set(
      (selectedId ? [selectedId] : ownedSkills).map(skillNameKey),
    );
    return graph.edges
      .filter(
        (edge) =>
          focusIds.has(skillNameKey(edge.source)) ||
          focusIds.has(skillNameKey(edge.target)),
      )
      .map((edge) => {
        const otherId = focusIds.has(skillNameKey(edge.source))
          ? edge.target
          : edge.source;
        return { edge, node: graphNodeMap.get(otherId) };
      })
      .filter(
        (item): item is { edge: typeof item.edge; node: SkillGraphNode } =>
          Boolean(item.node),
      )
      .sort(
        (left, right) =>
          right.edge.score - left.edge.score ||
          right.edge.cooccurrence_count - left.edge.cooccurrence_count,
      )
      .slice(0, 6);
  }, [graph.edges, graphNodeMap, ownedSkills, selectedId]);
  const directConnectionCount = useMemo(
    () => selectedId
      ? graph.edges.filter(
          (edge) => edge.source === selectedId || edge.target === selectedId,
        ).length
      : 0,
    [graph.edges, selectedId],
  );
  const display = useMemo<SkillGraphDisplaySettings>(
    () => ({
      ...DEFAULT_DISPLAY,
      // The renderer's minimum zoom is 0.18. Keep the curated atlas labels
      // visible at that fitted overview scale; collision checks still remove
      // labels that would overlap on narrow screens.
      labelLimit: skillGraphLabelLimit(labelDensity, viewData.stats.skillCount),
      labelThreshold: 0.18,
    }),
    [labelDensity, viewData.stats.skillCount],
  );
  const forces = useMemo<SkillGraphForceSettings>(
    () => ({
      ...DEFAULT_FORCES,
      linkDistance: graphMode === "all" ? 64 : 78,
      repel: graphMode === "all" ? 195 : 230,
    }),
    [graphMode],
  );

  useEffect(() => {
    const syncOwnedSkills = (skills: string[]) => {
      setOwnedSkills(canonicalizeOwnedSkills(skills, graphCatalogRef.current));
    };
    const stored = readOwnedSkills();
    if (stored.length > 0) syncOwnedSkills(stored);
    return subscribeOwnedSkills(syncOwnedSkills);
  }, []);

  useEffect(() => {
    const compactLayout = window.matchMedia("(max-width: 640px)");
    const syncGraphBudget = () => setCompactGraph(compactLayout.matches);
    syncGraphBudget();
    compactLayout.addEventListener("change", syncGraphBudget);
    return () => compactLayout.removeEventListener("change", syncGraphBudget);
  }, []);

  useEffect(() => {
    setPathEmphasisEnabled(false);
  }, [graph, ownedSkills, selectedId]);

  useEffect(() => {
    topologyRequestRef.current?.abort();
    topologyCache.current.set(
      topologyCacheKey(null, careerType, initialDepth),
      initialGraph,
    );
    setGraph(initialGraph);
    setDepth(initialDepth);
    depthRef.current = initialDepth;
    setSelectedId(initialSelection);
    selectedIdRef.current = initialSelection;
    const requestedNearby =
      new URL(window.location.href).searchParams.get("view") === "nearby" &&
      Boolean(initialSelection);
    const nextMode: SkillGraphViewMode = requestedNearby ? "focus" : "all";
    setGraphMode(nextMode);
    graphModeRef.current = nextMode;
    setForceReady(false);
    setTopologyState("idle");
    if (requestedNearby) void loadTopology(initialSelection, initialDepth);
  }, [careerType, initialDepth, initialGraph, initialSelection, loadTopology]);

  useEffect(
    () => () => topologyRequestRef.current?.abort(),
    [],
  );

  useEffect(() => {
    function restoreSelectionFromHistory() {
      const url = new URL(window.location.href);
      const requestedInput = url.searchParams.get("seed")?.trim() || null;
      const requestedDepth = url.searchParams.get("depth") === "2" ? 2 : 1;
      const nextSelection = requestedInput
        ? resolveSkillInput(requestedInput, graphCatalogRef.current)
        : null;
      const nextMode: SkillGraphViewMode =
        url.searchParams.get("view") === "nearby" && nextSelection
          ? "focus"
          : "all";
      depthRef.current = requestedDepth;
      graphModeRef.current = nextMode;
      selectedIdRef.current = nextSelection;
      setDepth(requestedDepth);
      setGraphMode(nextMode);
      setSelectedId(nextSelection);
      if (nextMode === "focus") {
        setForceReady(false);
        void loadTopology(nextSelection, requestedDepth);
      } else {
        const atlas = topologyCache.current.get(
          topologyCacheKey(null, careerTypeRef.current, requestedDepth),
        );
        if (atlas && atlas !== graph) {
          setForceReady(false);
          setGraph(atlas);
        }
      }
    }

    window.addEventListener("popstate", restoreSelectionFromHistory);
    return () => window.removeEventListener("popstate", restoreSelectionFromHistory);
  }, [graph, loadTopology]);

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
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            owned_skills: ownedSkills,
            ...(careerType ? { career_type: careerType } : {}),
          }),
        });
        if (!response.ok) throw new Error("fit request failed");
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
    void requestFit();
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
        if (careerType) params.set("career_type", careerType);
        params.set("limit", "6");
        const response = await fetch(
          `/skills/graph/evidence?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("evidence request failed");
        const payload = (await response.json()) as SkillGraphEvidenceResponse;
        if (controller.signal.aborted) return;
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
        ) return;
        setEvidence({ status: "error", items: [], total: 0 });
      }
    }
    void requestEvidence();
    return () => controller.abort();
  }, [careerType, evidenceRetryKey, selectedId]);

  const writeSelectionUrl = useCallback((
    nodeId: string | null,
    historyMode: "push" | "replace",
    viewMode = graphModeRef.current,
  ) => {
    const url = new URL(window.location.href);
    url.pathname = "/skills/graph";
    if (nodeId) url.searchParams.set("seed", nodeId);
    else url.searchParams.delete("seed");
    if (careerTypeRef.current) {
      url.searchParams.set("career_type", careerTypeRef.current);
    } else {
      url.searchParams.delete("career_type");
    }
    if (viewMode === "focus" && nodeId) {
      url.searchParams.set("view", "nearby");
      if (depthRef.current === 2) url.searchParams.set("depth", "2");
      else url.searchParams.delete("depth");
    } else {
      url.searchParams.delete("view");
      url.searchParams.delete("depth");
    }
    url.searchParams.delete("owned_skills");
    ownedSkillsRef.current.forEach((skill) => url.searchParams.append("owned_skills", skill));
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (historyMode === "push") window.history.pushState(null, "", nextUrl);
    else window.history.replaceState(null, "", nextUrl);
  }, []);

  const focusInspector = useCallback(() => {
    const inspector = inspectorRef.current;
    const target = inspector?.querySelector<HTMLElement>("a[href], button:not(:disabled)") ?? inspector;
    target?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    target?.focus({ preventScroll: true });
  }, []);

  const selectSkill = useCallback((nodeId: string) => {
    if (selectedIdRef.current === nodeId) {
      focusInspector();
      setAnnouncement(`${nodeId} 기술의 상세 정보를 표시했습니다.`);
      return;
    }
    selectedIdRef.current = nodeId;
    setSelectedId(nodeId);
    writeSelectionUrl(nodeId, "push", graphModeRef.current);
    setAnnouncement(`${nodeId} 기술의 수요와 관련 공고를 표시했습니다.`);
  }, [focusInspector, writeSelectionUrl]);

  const selectSkillFromSearch = useCallback((skill: string) => {
    const requestedKey = resolvedSkillKey(skill, graphCatalogRef.current);
    const graphNode = graph.nodes.find(
      (node) => resolvedSkillKey(node.id, graphCatalogRef.current) === requestedKey,
    );
    if (graphNode) {
      selectSkill(graphNode.id);
      return;
    }

    const canonical = resolveSkillInput(skill, graphCatalogRef.current);
    depthRef.current = 1;
    graphModeRef.current = "focus";
    selectedIdRef.current = canonical;
    setDepth(1);
    setGraphMode("focus");
    setSelectedId(canonical);
    setForceReady(false);
    writeSelectionUrl(canonical, "push", "focus");
    void loadTopology(canonical, 1);
    setAnnouncement(`${canonical} 주변 기술을 불러옵니다.`);
  }, [graph.nodes, loadTopology, selectSkill, writeSelectionUrl]);

  function addSkill(value = ownedSkillInput.trim()) {
    const next = resolveSkillInput(value, graphCatalog);
    if (!next) return false;
    if (next.length > MAX_OWNED_SKILL_LENGTH) {
      setAnnouncement(`기술 이름은 ${MAX_OWNED_SKILL_LENGTH}자 이하로 입력해 주세요.`);
      return false;
    }
    const nextKey = resolvedSkillKey(next, graphCatalog);
    if (ownedSkills.some((skill) => resolvedSkillKey(skill, graphCatalog) === nextKey)) {
      setOwnedSkillInput("");
      setAnnouncement(`${next} 기술은 이미 내 기술에 있습니다.`);
      return false;
    }
    if (ownedSkills.length >= MAX_OWNED_SKILLS) {
      setAnnouncement(`내 기술은 최대 ${MAX_OWNED_SKILLS}개까지 추가할 수 있습니다.`);
      return false;
    }
    const saved = canonicalizeOwnedSkills(
      writeOwnedSkills([...ownedSkills, next]),
      graphCatalog,
    );
    ownedSkillsRef.current = saved;
    setOwnedSkills(saved);
    setOwnedSkillInput("");
    setAnnouncement(`${next} 기술을 내 기술에 추가했습니다.`);
    return true;
  }

  function removeSkill(skill: string) {
    const targetKey = resolvedSkillKey(skill, graphCatalog);
    const saved = canonicalizeOwnedSkills(
      writeOwnedSkills(
        ownedSkills.filter(
          (item) => resolvedSkillKey(item, graphCatalog) !== targetKey,
        ),
      ),
      graphCatalog,
    );
    ownedSkillsRef.current = saved;
    setOwnedSkills(saved);
    setAnnouncement(`${skill} 기술을 내 기술에서 제거했습니다.`);
  }

  function toggleDomain(domain: string) {
    setDisabledDomains((current) =>
      current.includes(domain)
        ? current.filter((item) => item !== domain)
        : [...current, domain],
    );
  }

  function showAtlasGraph() {
    if (graphModeRef.current === "all" && topologyState === "idle") return;
    depthRef.current = 1;
    graphModeRef.current = "all";
    setDepth(1);
    setGraphMode("all");
    setForceReady(false);
    writeSelectionUrl(selectedIdRef.current, "push", "all");
    void loadTopology(null, 1);
    setAnnouncement("현재 수집 범위의 전체 기술 지도를 표시합니다.");
  }

  function showNearbyGraph() {
    const currentSelection = selectedIdRef.current;
    if (!currentSelection || graphModeRef.current === "focus") return;
    graphModeRef.current = "focus";
    setGraphMode("focus");
    setForceReady(false);
    writeSelectionUrl(currentSelection, "push", "focus");
    void loadTopology(currentSelection, depthRef.current);
    setAnnouncement(`${currentSelection} 주변의 기술 관계를 표시합니다.`);
  }

  function changeDepth(nextDepth: 1 | 2) {
    const currentSelection = selectedIdRef.current;
    if (!currentSelection || nextDepth === depthRef.current) return;
    depthRef.current = nextDepth;
    graphModeRef.current = "focus";
    setDepth(nextDepth);
    setGraphMode("focus");
    setForceReady(false);
    writeSelectionUrl(currentSelection, "replace", "focus");
    void loadTopology(currentSelection, nextDepth);
    setAnnouncement(
      nextDepth === 1
        ? `${currentSelection}의 직접 연결 기술을 표시합니다.`
        : `${currentSelection}에서 두 단계까지 이어지는 기술을 표시합니다.`,
    );
  }

  function toggleMarketPath() {
    if (!marketPath || marketPath.hopCount === 0) return;
    const next = !pathEmphasisEnabled;
    setPathEmphasisEnabled(next);
    setAnnouncement(
      next
        ? `${marketPathLabels[0]}에서 ${marketPathLabels.at(-1)}까지의 시장 관계를 강조했습니다.`
        : "시장 연결 경로 강조를 껐습니다.",
    );
  }

  function resetGraphView() {
    depthRef.current = 1;
    graphModeRef.current = "all";
    setDepth(1);
    setGraphMode("all");
    setDisabledDomains([]);
    setSearchInput("");
    setForceReady(false);
    writeSelectionUrl(selectedIdRef.current, "replace", "all");
    void loadTopology(null, 1);
    setAnnouncement("분야 필터를 초기화하고 전체 지도를 표시합니다.");
  }

  return (
    <main className={styles.page}>
      <section aria-label={PRODUCT_TERMS.skillMap} className={styles.experience}>
        <header className={styles.intro}>
          <div className={styles.introCopy}>
            <div className={styles.titleLine}>
              <h1>{PRODUCT_TERMS.skillMap}</h1>
              <span>공개 공고 기반</span>
            </div>
            <p className={styles.description}>{COPY.description}</p>
          </div>
          <div className={styles.trustLine}>
            <span>{loadFailed ? "지도 범위 확인 불가" : summarizeGraph(graph)}</span>
            <Link href="/methodology">분석 방법</Link>
            <Link href="/data-policy">데이터 범위</Link>
          </div>
        </header>

        {loadFailed && (
          <div className={styles.loadNotice} role="alert">
            <span>{COPY.loadError}</span>
            <Link href={retryHref}>다시 시도</Link>
          </div>
        )}

        <section aria-label="스킬맵 도구" className={styles.toolbar}>
          <SkillGraphSearch
            catalog={graphCatalog}
            onSelect={selectSkillFromSearch}
            onValueChange={setSearchInput}
            value={searchInput}
          />

          <div className={styles.scopeControl}>
            <span>지도 범위</span>
            <div aria-label="지도 범위" className={styles.segmented} role="group">
              <button
                aria-pressed={graphMode === "all"}
                data-active={graphMode === "all" ? "true" : undefined}
                onClick={showAtlasGraph}
                type="button"
              >
                전체 지도
              </button>
              <button
                aria-pressed={graphMode === "focus"}
                data-active={graphMode === "focus" ? "true" : undefined}
                disabled={!selectedId}
                onClick={showNearbyGraph}
                type="button"
              >
                선택 주변 보기
              </button>
            </div>
          </div>

          {graphMode === "focus" && (
            <div aria-label="주변 깊이" className={styles.depthControl} role="group">
              <span>관계 범위</span>
              <div className={styles.depthSegmented}>
                <button
                  aria-pressed={depth === 1}
                  data-active={depth === 1 ? "true" : undefined}
                  onClick={() => changeDepth(1)}
                  type="button"
                >
                  직접 연결
                </button>
                <button
                  aria-pressed={depth === 2}
                  data-active={depth === 2 ? "true" : undefined}
                  onClick={() => changeDepth(2)}
                  type="button"
                >
                  두 단계
                </button>
              </div>
            </div>
          )}

          <div className={styles.toolbarMenus}>
            <details>
              <summary>내 기술 <b>{ownedSkills.length}</b></summary>
              <div className={styles.popover}>
                <div className={styles.popoverHeader}>
                  <div>
                    <strong>{PRODUCT_TERMS.ownedSkills}</strong>
                    <span>추천과 공고 매칭에 반영됩니다.</span>
                  </div>
                  <b>{ownedSkills.length}/{MAX_OWNED_SKILLS}</b>
                </div>
                <SkillPicker
                  catalog={graphCatalog}
                  catalogStatus="ready"
                  excludedSkills={ownedSkills}
                  id="skill-graph-owned-skill"
                  onCommit={addSkill}
                  onValueChange={setOwnedSkillInput}
                  value={ownedSkillInput}
                />
                {ownedSkills.length > 0 ? (
                  <div className={styles.skillChips}>
                    {ownedSkills.map((skill) => (
                      <span key={skill}>
                        {skill}
                        <button
                          aria-label={`${skill} 제거`}
                          onClick={() => removeSkill(skill)}
                          type="button"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyCopy}>아직 추가한 기술이 없습니다.</p>
                )}
              </div>
            </details>

            <details>
              <summary>분야 <b>{enabledDomains.length}/{allDomains.length}</b></summary>
              <div className={styles.popover}>
                <div className={styles.popoverHeader}>
                  <div>
                    <strong>분야 필터</strong>
                    <span>관심 분야만 지도에 남겨 보세요.</span>
                  </div>
                  <button onClick={() => setDisabledDomains([])} type="button">
                    모두 보기
                  </button>
                </div>
                <div className={styles.domainFilters}>
                  {allDomains.map((group) => {
                    const enabled = !disabledDomains.includes(group.domain);
                    return (
                      <button
                        aria-pressed={enabled}
                        data-active={enabled ? "true" : undefined}
                        key={group.domain}
                        onClick={() => toggleDomain(group.domain)}
                        type="button"
                      >
                        <i aria-hidden="true" style={{ backgroundColor: group.color }} />
                        <span>{displayDomain(group.domain)}</span>
                        <b>{group.count}</b>
                      </button>
                    );
                  })}
                  {allDomains.length === 0 && (
                    <p className={styles.emptyCopy}>확인 가능한 분야가 없습니다.</p>
                  )}
                </div>
              </div>
            </details>

            <details>
              <summary>
                보기 설정 <b>{RELATIONSHIP_DENSITY_LABELS[relationshipDensity]}</b>
              </summary>
              <div className={`${styles.popover} ${styles.displayPopover}`}>
                <div className={styles.popoverHeader}>
                  <div>
                    <strong>그래프 표시</strong>
                    <span>배치는 유지하고 표시 정보만 바뀝니다.</span>
                  </div>
                </div>
                <div className={styles.displaySetting}>
                  <span id="skill-graph-relationship-density">관계선</span>
                  <div
                    aria-labelledby="skill-graph-relationship-density"
                    className={styles.settingSegmented}
                    role="group"
                  >
                    {(
                      Object.entries(RELATIONSHIP_DENSITY_LABELS) as [
                        SkillGraphRelationshipDensity,
                        string,
                      ][]
                    ).map(([value, label]) => (
                      <button
                        aria-pressed={relationshipDensity === value}
                        data-active={relationshipDensity === value ? "true" : undefined}
                        key={value}
                        onClick={() => setRelationshipDensity(value)}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.displaySetting}>
                  <span id="skill-graph-label-density">기술명</span>
                  <div
                    aria-labelledby="skill-graph-label-density"
                    className={styles.settingSegmented}
                    role="group"
                  >
                    <button
                      aria-pressed={labelDensity === "key"}
                      data-active={labelDensity === "key" ? "true" : undefined}
                      onClick={() => setLabelDensity("key")}
                      type="button"
                    >
                      주요만
                    </button>
                    <button
                      aria-pressed={labelDensity === "more"}
                      data-active={labelDensity === "more" ? "true" : undefined}
                      onClick={() => setLabelDensity("more")}
                      type="button"
                    >
                      더 많이
                    </button>
                  </div>
                </div>
              </div>
            </details>

            <details>
              <summary>읽는 법</summary>
              <p aria-label="스킬맵 범례" className={styles.legend} role="note">
                <span><i aria-hidden="true" data-kind="demand" />크기: 시장 수요</span>
                <span><i aria-hidden="true" data-kind="domain" />색: 기술 분야</span>
                <span><i aria-hidden="true" data-kind="owned" />테두리: 내 기술</span>
                <span><i aria-hidden="true" data-kind="recommended" />점: 학습 추천</span>
                <span><i aria-hidden="true" data-kind="link" />선 농도: 함께 요구</span>
              </p>
            </details>
          </div>
        </section>

        <div className={styles.workspace}>
          <section aria-label="기술 관계 그래프" className={styles.graphColumn}>
            <div
              className={styles.graphFrame}
              data-testid="skill-graph-frame"
              data-touch-interaction={graphInteractionEnabled ? "enabled" : "disabled"}
            >
              <div className={styles.graphHud}>
                <strong>{graphMode === "focus" ? "선택 주변" : "전체 지도"}</strong>
                <span>
                  {loadFailed
                    ? "기술·관계 수 확인 불가"
                    : `${viewData.stats.skillCount}개 기술 · ${visibleLinkIds.size}개 관계`}
                </span>
                {!loadFailed && (
                  <b className={styles.graphDensityBadge}>
                    {RELATIONSHIP_DENSITY_LABELS[relationshipDensity]}
                  </b>
                )}
              </div>

              <SkillGraphForceCanvas
                data={viewData}
                display={display}
                emphasis={pathEmphasis}
                forces={forces}
                onNodeSelect={selectSkill}
                onReadyChange={setForceReady}
                reheatKey={0}
                selectedId={selectedId}
                touchInteractionEnabled={graphInteractionEnabled}
                visibleLinkIds={visibleLinkIds}
              />

              <button
                aria-label={graphInteractionEnabled ? "그래프 조작 종료" : "그래프 조작 시작"}
                aria-pressed={graphInteractionEnabled}
                className={styles.touchInteractionToggle}
                onClick={() => setGraphInteractionEnabled((current) => !current)}
                type="button"
              >
                {graphInteractionEnabled ? "조작 끝내기" : "그래프 조작"}
              </button>

              <div className={styles.graphStatus}>
                {topologyState === "idle" && (
                  <>
                    <span className={styles.pointerHint}>{COPY.desktopControls}</span>
                    <span className={styles.touchHint}>{COPY.mobileControls}</span>
                  </>
                )}
                {topologyState === "loading" && (
                  <span aria-live="polite" role="status">관계망을 불러오는 중</span>
                )}
                {topologyState === "error" && (
                  <span role="alert">
                    이전 관계망 표시 중
                    <button
                      aria-label="관계망 다시 시도"
                      onClick={() => void loadTopology(
                        graphModeRef.current === "focus" ? selectedIdRef.current : null,
                      )}
                      type="button"
                    >
                      다시 시도
                    </button>
                  </span>
                )}
              </div>

              {!loadFailed && viewData.nodes.length === 0 && (
                <div className={`graph-empty-state ${styles.emptyState}`}>
                  <span aria-hidden="true" className={styles.emptyOrbit} />
                  <strong>{COPY.empty}</strong>
                  {isFilteredEmpty && (
                    <button onClick={resetGraphView} type="button">필터 초기화</button>
                  )}
                </div>
              )}

              {showFallbackGraph && (
                <>
                  <svg className="graph-edges" aria-hidden="true" viewBox="0 0 100 100">
                    {viewData.links
                      .filter((link) =>
                        link.kind === "skill" && (
                          visibleLinkIds.has(link.id) ||
                          pathEmphasis?.linkIds.includes(link.id) ||
                          (selectedId !== null && (
                            link.source === selectedId || link.target === selectedId
                          ))
                        ),
                      )
                      .map((edge) => {
                        const source = positionedNodeMap.get(edge.source);
                        const target = positionedNodeMap.get(edge.target);
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
                  {positionedNodes.map((node) => (
                    <button
                      className={`graph-node ${node.seed ? "graph-node--seed" : ""} ${
                        selectedId === node.id ? "is-selected" : ""
                      }`}
                      data-owned={node.owned ? "true" : "false"}
                      data-recommended={node.recommended ? "true" : "false"}
                      key={node.id}
                      onClick={() => selectSkill(node.id)}
                      style={{
                        "--node-color": selectedId === node.id
                          ? GRAPH_CANVAS_COLORS.selectedNode
                          : node.color,
                        "--node-ring": node.owned
                          ? GRAPH_CANVAS_COLORS.ownedRing
                          : "transparent",
                        "--recommendation-color": GRAPH_CANVAS_COLORS.recommendedRing,
                        left: `${node.x}%`,
                        top: `${node.y}%`,
                      } as CSSProperties}
                      type="button"
                    >
                      <span>{node.label}</span>
                    </button>
                  ))}
                </>
              )}

              {selected && (
                <div className={styles.mobileSelection}>
                  <span><b>{selected.label}</b> · 공고 {selected.demand_count}건</span>
                  <button onClick={focusInspector} type="button">분석 보기</button>
                </div>
              )}
            </div>
          </section>

          <aside
            aria-label="선택 기술 분석"
            className={styles.inspector}
            ref={inspectorRef}
            tabIndex={-1}
          >
            <section className={styles.selectedSkill}>
              <p className={styles.eyebrow}>선택 기술</p>
              <h2>{selected?.label ?? "기술 하나를 선택하세요"}</h2>
              <p>
                {selected
                  ? `${selected.domains.map(displayDomain).join(", ")} 분야에서 확인된 채용 수요입니다.`
                  : "지도에서 기술을 선택하면 수요, 연관 기술, 실제 공고를 한곳에서 볼 수 있습니다."}
              </p>
              {selected && (
                <div className={styles.selectedActions}>
                  <Link
                    aria-label={`${selected.label} 관련 공고 모두 보기`}
                    href={buildSearchScopeHref(selected.label, "jobs")}
                  >
                    관련 공고 보기
                  </Link>
                  <button
                    aria-label={`${selected.label} ${
                      selectedOwned ? "내 기술에서 제거" : "내 기술에 추가"
                    }`}
                    onClick={() => selectedOwned ? removeSkill(selected.id) : addSkill(selected.id)}
                    type="button"
                  >
                    {selectedOwned ? "내 기술에서 제거" : "내 기술에 추가"}
                  </button>
                </div>
              )}
              <dl className={styles.evidenceMetrics}>
                <div><dt>언급 공고</dt><dd>{selected ? `${selected.demand_count}건` : "—"}</dd></div>
                <div><dt>필수</dt><dd>{selected ? `${selected.required_count}건` : "—"}</dd></div>
                <div><dt>우대</dt><dd>{selected ? `${selected.preferred_count}건` : "—"}</dd></div>
                <div>
                  <dt>{PRODUCT_TERMS.unspecifiedRequirement}</dt>
                  <dd>{selected ? `${selected.unspecified_count}건` : "—"}</dd>
                </div>
                <div><dt>직접 연결</dt><dd>{selected ? `${directConnectionCount}개` : "—"}</dd></div>
              </dl>
            </section>

            <section className={styles.inspectorSection}>
              <header className={styles.sectionHeader}>
                <h2>내 기술과의 시장 연결</h2>
                <span>
                  {marketPath && marketPath.hopCount > 0
                    ? `${marketPath.hopCount}개 관계`
                    : "공고 관계 기준"}
                </span>
              </header>
              {!selected && (
                <p className={styles.marketPathState}>
                  기술을 선택하면 내 기술과 이어지는 시장 관계를 확인할 수 있습니다.
                </p>
              )}
              {selected && ownedSkills.length === 0 && (
                <p className={styles.marketPathState}>
                  내 기술을 추가하면 선택 기술까지 이어지는 시장 관계를 볼 수 있습니다.
                </p>
              )}
              {selected && selectedOwned && (
                <p className={styles.marketPathState}>
                  선택한 기술은 이미 내 기술에 포함되어 있습니다.
                </p>
              )}
              {selected && ownedSkills.length > 0 && !selectedOwned && !marketPath && (
                <p className={styles.marketPathState}>
                  현재 지도에 보이는 내 기술과의 연결을 찾지 못했습니다.
                </p>
              )}
              {selected && !selectedOwned && marketPath && marketPath.hopCount > 0 && (
                <div className={styles.marketPathContent}>
                  <ol
                    aria-label={`시장 연결 경로: ${marketPathLabels[0]}에서 ${marketPathLabels.at(-1)}까지`}
                    className={styles.marketPathNodes}
                  >
                    {marketPathLabels.map((label, index) => (
                      <li key={`${marketPath.nodeIds[index]}:${index}`}>
                        <span>{label}</span>
                      </li>
                    ))}
                  </ol>
                  <p>
                    공고에서 함께 요구된 강한 관계를 따라 표시합니다. 학습 순서를 뜻하지 않습니다.
                  </p>
                  <div className={styles.marketPathFooter}>
                    <span>
                      최소 동시 등장 {marketPath.weakestCooccurrenceCount}건
                    </span>
                    <button
                      aria-pressed={pathEmphasisEnabled}
                      onClick={toggleMarketPath}
                      type="button"
                    >
                      {pathEmphasisEnabled
                        ? "경로 강조 끄기"
                        : "그래프에서 경로 보기"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className={styles.inspectorSection}>
              <header className={styles.sectionHeader}>
                <h2>다음에 배울 기술</h2>
                <span>{fitState === "loading" ? "분석 중" : "공고 근거"}</span>
              </header>
              <div className={styles.nextSkills}>
                {fitState === "loading" && <p role="status">{COPY.fitLoading}</p>}
                {fitState === "error" && <p role="alert">{COPY.fitError}</p>}
                {fitState === "idle" &&
                  (fit?.recommended_next_skills ?? []).slice(0, 3).map((skill) => (
                    <button
                      aria-label={`${skill.skill} 기술 지도에서 보기`}
                      key={skill.skill}
                      onClick={() => selectSkillFromSearch(skill.skill)}
                      type="button"
                    >
                      <span>
                        <strong>{skill.skill}</strong>
                        <small>{skill.reason}</small>
                      </span>
                      <b>{skill.supporting_posting_count}건</b>
                    </button>
                  ))}
                {fitState === "idle" && !fit && ownedSkills.length === 0 && (
                  <p>내 기술을 추가하면 공고에서 함께 요구되는 학습 후보를 찾습니다.</p>
                )}
                {fitState === "idle" && fit?.recommended_next_skills.length === 0 && (
                  <p>현재 공고에서 뚜렷한 학습 후보를 찾지 못했습니다.</p>
                )}
              </div>
            </section>

            <section className={styles.inspectorSection}>
              <header className={styles.sectionHeader}>
                <h2>함께 요구되는 기술</h2>
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
                <h2>관련 공고</h2>
                <span>
                  {evidence.status === "ready" && evidence.total > 6
                    ? `전체 ${evidence.total}건 중 6건`
                    : evidence.status === "ready" || evidence.status === "empty"
                      ? `${evidence.total}건`
                      : "선택 후 확인"}
                </span>
              </header>
              <ul className={styles.jobEvidence}>
                {evidence.status === "ready" && evidence.items.map((item) => (
                  <li key={item.posting_id}>
                    <Link href={`/jobs/${encodeURIComponent(item.posting_id)}`}>
                      <span>{item.company_name}</span>
                      <strong>{item.title}</strong>
                      <small>공고 분석 보기</small>
                    </Link>
                  </li>
                ))}
                {evidence.status === "idle" && (
                  <li className={styles.evidenceState}>기술을 선택하면 관련 공고를 확인할 수 있습니다.</li>
                )}
                {evidence.status === "loading" && (
                  <li className={styles.evidenceState} role="status">관련 공고를 불러오는 중입니다.</li>
                )}
                {evidence.status === "empty" && (
                  <li className={styles.evidenceState}>현재 공개된 근거 공고가 없습니다.</li>
                )}
                {evidence.status === "error" && (
                  <li className={styles.evidenceState} role="alert">
                    <span>{COPY.evidenceError}</span>
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
          </aside>
        </div>

        <p aria-live="polite" className={styles.srOnly}>{announcement}</p>
      </section>
    </main>
  );
}
