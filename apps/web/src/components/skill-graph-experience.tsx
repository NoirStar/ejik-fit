"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { readOwnedSkills, writeOwnedSkills } from "@/lib/owned-skills";
import { domainColor, summarizeGraph } from "@/lib/skill-graph";
import { buildSkillGraphView } from "@/lib/skill-graph-view";
import type { SkillGraphViewMode } from "@/lib/skill-graph-view";
import type {
  FitAnalyzeResponse,
  SkillGraphEvidence,
  SkillGraphNode,
  SkillGraphResponse,
} from "@/lib/types";

import { SkillGraphForceCanvas } from "./skill-graph-force-canvas";
import type {
  SkillGraphDisplaySettings,
  SkillGraphForceSettings,
} from "./skill-graph-force-canvas";


type PositionedNode = SkillGraphNode & {
  x: number;
  y: number;
};


type SkillGraphExperienceProps = {
  initialGraph: SkillGraphResponse;
  initialOwnedSkills: string[];
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
  { label: "C++", x: 47, y: 48, size: 7, color: "#7aa2ff" },
  { label: "ROS2", x: 66, y: 38, size: 5.5, color: "#f2994a" },
  { label: "Linux", x: 56, y: 63, size: 5.2, color: "#36d399" },
  { label: "Python", x: 34, y: 36, size: 5, color: "#bca7ff" },
  { label: "Security", x: 72, y: 60, size: 4.6, color: "#ff7b72" },
];


function positionNodes(nodes: SkillGraphNode[]): PositionedNode[] {
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
    color: index % 13 === 0 ? cluster.color : "rgba(202, 210, 228, 0.7)",
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
  initialOwnedSkills: string[],
) {
  const ids = new Set(graph.nodes.map((node) => node.id));
  return (
    graph.seed ??
    initialOwnedSkills.find((skill) => ids.has(skill)) ??
    graph.nodes[0]?.id ??
    null
  );
}


function fitPercent(fit: FitAnalyzeResponse | null) {
  if (!fit || fit.coverage.matching_posting_count === 0) {
    return null;
  }
  return Math.min(
    99,
    Math.round(
      (fit.coverage.strong_fit_posting_count /
        fit.coverage.matching_posting_count) *
        100,
    ),
  );
}


function skillEvidenceFor(
  evidence: SkillGraphEvidence[],
  selectedId: string | null,
) {
  if (!selectedId) {
    return evidence.slice(0, 5);
  }
  const direct = evidence.filter((item) => item.skills.includes(selectedId));
  return (direct.length > 0 ? direct : evidence).slice(0, 5);
}


export function SkillGraphExperience({
  initialGraph,
  initialOwnedSkills,
}: SkillGraphExperienceProps) {
  const initialSelection = useMemo(
    () => chooseInitialSelection(initialGraph, initialOwnedSkills),
    [initialGraph, initialOwnedSkills],
  );
  const [ownedSkills, setOwnedSkills] = useState(initialOwnedSkills);
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection);
  const [forceReady, setForceReady] = useState(false);
  const [graphMode, setGraphMode] = useState<SkillGraphViewMode>("local");
  const [localDepth, setLocalDepth] = useState(2);
  const [filterQuery, setFilterQuery] = useState("");
  const [showEvidence, setShowEvidence] = useState(true);
  const [showIsolated, setShowIsolated] = useState(false);
  const [disabledDomains, setDisabledDomains] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reheatKey, setReheatKey] = useState(0);
  const [display, setDisplay] = useState<SkillGraphDisplaySettings>({
    animate: false,
    arrows: false,
    labelThreshold: 1.15,
    linkThickness: 0.72,
    nodeScale: 0.86,
  });
  const [forces, setForces] = useState<SkillGraphForceSettings>({
    center: 0.04,
    link: 0.28,
    linkDistance: 82,
    repel: 240,
  });
  const [fit, setFit] = useState<FitAnalyzeResponse | null>(null);
  const [fitState, setFitState] = useState<"idle" | "loading" | "error">("idle");

  const graphNodeMap = useMemo(
    () => new Map(initialGraph.nodes.map((node) => [node.id, node])),
    [initialGraph.nodes],
  );
  const selected = selectedId ? graphNodeMap.get(selectedId) ?? null : null;
  const allDomains = useMemo(
    () => buildSkillGraphView(initialGraph).domains,
    [initialGraph],
  );
  const enabledDomains = useMemo(
    () =>
      allDomains
        .map((domain) => domain.domain)
        .filter((domain) => !disabledDomains.includes(domain)),
    [allDomains, disabledDomains],
  );
  const viewData = useMemo(
    () =>
      buildSkillGraphView(initialGraph, {
        enabledDomains: allDomains.length > 0 ? enabledDomains : undefined,
        localDepth,
        mode: graphMode,
        query: filterQuery,
        selectedId,
        showEvidence,
        showIsolated,
      }),
    [
      allDomains.length,
      enabledDomains,
      filterQuery,
      graphMode,
      initialGraph,
      localDepth,
      selectedId,
      showEvidence,
      showIsolated,
    ],
  );
  const visibleSkillNodes = useMemo(
    () =>
      viewData.nodes.flatMap((node) =>
        node.kind === "skill" && node.skill ? [node.skill] : [],
      ),
    [viewData.nodes],
  );
  const nodes = useMemo(
    () => positionNodes(visibleSkillNodes),
    [visibleSkillNodes],
  );
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const relatedEvidence = useMemo(
    () => skillEvidenceFor(initialGraph.evidence, selectedId),
    [initialGraph.evidence, selectedId],
  );
  const strongestConnections = useMemo(() => {
    const focusIds = new Set(selectedId ? [selectedId] : ownedSkills);
    return initialGraph.edges
      .filter(
        (edge) =>
          focusIds.has(edge.source) ||
          focusIds.has(edge.target) ||
          ownedSkills.includes(edge.source) ||
          ownedSkills.includes(edge.target),
      )
      .map((edge) => {
        const otherId =
          focusIds.has(edge.source) || ownedSkills.includes(edge.source)
            ? edge.target
            : edge.source;
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
  }, [graphNodeMap, initialGraph.edges, ownedSkills, selectedId]);
  const quickSkills = useMemo(() => {
    const suggested = [...ownedSkills, ...initialGraph.nodes.map((node) => node.id)];
    return Array.from(new Set(suggested)).slice(0, 7);
  }, [initialGraph.nodes, ownedSkills]);
  const mainFitPercent = fitPercent(fit);
  const topNextSkill = fit?.recommended_next_skills[0] ?? null;
  const topBranch = fit?.domain_branches[0] ?? null;
  const hasGraph = viewData.nodes.length > 0;
  const isFilteredEmpty = initialGraph.nodes.length > 0 && !hasGraph;
  const showFallbackGraph = nodes.length > 0 && !forceReady;

  useEffect(() => {
    const stored = readOwnedSkills();
    if (stored.length > 0) {
      setOwnedSkills(stored);
    }
  }, []);

  useEffect(() => {
    if (initialSelection && !selectedId) {
      setSelectedId(initialSelection);
    }
  }, [initialSelection, selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function requestFit() {
      if (ownedSkills.length === 0) {
        setFit(null);
        setFitState("idle");
        return;
      }

      setFitState("loading");
      try {
        const response = await fetch("/skills/graph/fit", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ owned_skills: ownedSkills }),
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
          setFitState("error");
        }
      }
    }

    requestFit();

    return () => {
      cancelled = true;
    };
  }, [ownedSkills]);

  const selectSkill = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setGraphMode("local");
  }, []);

  function addSkill(nextSkill = input.trim()) {
    const next = nextSkill.trim();
    if (!next) {
      return;
    }
    setOwnedSkills((current) => writeOwnedSkills([...current, next]));
    setSelectedId(next);
    setGraphMode("local");
    setInput("");
  }

  function removeSkill(skill: string) {
    setOwnedSkills((current) => writeOwnedSkills(current.filter((item) => item !== skill)));
  }

  function toggleDomain(domain: string) {
    setDisabledDomains((current) =>
      current.includes(domain)
        ? current.filter((item) => item !== domain)
        : [...current, domain],
    );
  }

  function updateDisplay<K extends keyof SkillGraphDisplaySettings>(
    key: K,
    value: SkillGraphDisplaySettings[K],
  ) {
    setDisplay((current) => ({ ...current, [key]: value }));
  }

  function updateForces<K extends keyof SkillGraphForceSettings>(
    key: K,
    value: SkillGraphForceSettings[K],
  ) {
    setForces((current) => ({ ...current, [key]: value }));
  }

  function resetGraphView() {
    setGraphMode("local");
    setSelectedId(initialSelection);
    setFilterQuery("");
    setShowEvidence(true);
    setShowIsolated(false);
    setDisabledDomains([]);
    setLocalDepth(2);
  }

  return (
    <section className="market-dashboard" aria-label="스킬 시장 대시보드">
      <div className="market-dashboard__lead">
        <p className="dashboard-kicker">채용공고 기반 커리어 인텔리전스</p>
        <h2>내 스킬이 맞닿는 시장을 한 화면에서 봅니다.</h2>
        <p>
          기술 관계망, 부족한 준비, 관련 공고를 분리하지 않고 하나의
          대시보드에서 연결합니다.
        </p>
      </div>

      <div className="skill-command-panel">
        <div className="skill-command-panel__copy">
          <span>내 기준점</span>
          <strong>보유 스킬을 넣으면 그래프와 공고 fit이 즉시 바뀝니다.</strong>
        </div>
        <form
          className="skill-add-form market-skill-form"
          onSubmit={(event) => {
            event.preventDefault();
            addSkill();
          }}
        >
          <label htmlFor="owned-skill">스킬 입력</label>
          <div>
            <input
              id="owned-skill"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="예: ROS2, Kubernetes"
            />
            <button type="submit">추가</button>
          </div>
        </form>
        <div className="owned-skill-list market-owned-skills" aria-label="저장된 보유 스킬">
          {ownedSkills.map((skill) => (
            <button
              className="owned-skill-chip"
              key={skill}
              type="button"
              aria-label={`${skill} 제거`}
              onClick={() => removeSkill(skill)}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>

      <div className="quick-skill-strip" aria-label="빠른 스킬 선택">
        {quickSkills.map((skill) => (
          <button
            key={skill}
            type="button"
            className={selectedId === skill ? "is-active" : ""}
            onClick={() => selectSkill(skill)}
          >
            {skill}
          </button>
        ))}
      </div>

      <div className="market-kpi-grid">
        <article className="market-kpi-card market-kpi-card--fit">
          <span>시장 fit</span>
          <strong>
            {fitState === "loading"
              ? "계산 중"
              : mainFitPercent !== null
                ? `${mainFitPercent}%`
                : "대기"}
          </strong>
          <p>
            {fit
              ? `${fit.coverage.matching_posting_count}개 관련 공고 중 ${fit.coverage.strong_fit_posting_count}개가 강하게 맞습니다.`
              : "보유 스킬을 기준으로 자동 계산합니다."}
          </p>
        </article>
        <article className="market-kpi-card">
          <span>다음 준비</span>
          <strong>{topNextSkill?.skill ?? strongestConnections[0]?.node.label ?? "분석 대기"}</strong>
          <p>{topNextSkill?.reason ?? "공고에서 같이 등장하는 기술을 우선순위로 보여줍니다."}</p>
        </article>
        <article className="market-kpi-card">
          <span>관련 분야</span>
          <strong>{topBranch ? displayDomain(topBranch.domain) : displayDomain(allDomains[0]?.domain ?? "ai")}</strong>
          <p>
            {topBranch
              ? `${topBranch.supporting_posting_count}개 공고가 이 분야 신호를 만듭니다.`
              : `${allDomains.length}개 분야로 기술 관계를 나눠 봅니다.`}
          </p>
        </article>
        <article className="market-kpi-card">
          <span>그래프 범위</span>
          <strong>{graphMode === "local" ? "선택 주변" : "전체 시장"}</strong>
          <p>
            현재 {viewData.stats.skillCount}개 스킬, {viewData.stats.linkCount}개 연결을
            표시합니다.
          </p>
        </article>
      </div>

      <div className="dashboard-workspace">
        <section className="graph-analysis-card" aria-labelledby="market-graph-title">
          <header className="graph-analysis-card__header">
            <div>
              <p className="dashboard-kicker">Obsidian style skill map</p>
              <h3 id="market-graph-title">스킬 관계망</h3>
              <span>{summarizeGraph(initialGraph)}</span>
            </div>
            <div className="graph-primary-controls" aria-label="그래프 주요 조작">
              <div className="graph-mode-toggle" aria-label="그래프 범위">
                <button
                  className={graphMode === "local" ? "is-active" : ""}
                  type="button"
                  onClick={() => setGraphMode("local")}
                >
                  내 주변
                </button>
                <button
                  className={graphMode === "global" ? "is-active" : ""}
                  type="button"
                  onClick={() => setGraphMode("global")}
                >
                  전체
                </button>
              </div>
              <button className="graph-reset-button" type="button" onClick={resetGraphView}>
                초기화
              </button>
              <button
                className="graph-settings-button"
                type="button"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((current) => !current)}
              >
                그래프 설정
              </button>
            </div>
          </header>

          <div className="graph-search-row">
            <label htmlFor="graph-filter-query">스킬 검색</label>
            <input
              id="graph-filter-query"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="C++, ROS2, Security"
            />
            {graphMode === "local" && (
              <label className="graph-depth-compact" htmlFor="graph-local-depth">
                <span>주변 깊이</span>
                <b>{localDepth}</b>
                <input
                  id="graph-local-depth"
                  aria-label="주변 깊이"
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  value={localDepth}
                  onChange={(event) => setLocalDepth(Number(event.target.value))}
                />
              </label>
            )}
          </div>

          <div className="graph-canvas" role="region" aria-label="스킬 노드 관계">
            <SkillGraphForceCanvas
              data={viewData}
              display={display}
              forces={forces}
              selectedId={selectedId}
              onNodeSelect={selectSkill}
              onReadyChange={setForceReady}
              reheatKey={reheatKey}
            />
            <div className="graph-status-strip" aria-hidden="true">
              <span>{graphMode === "local" ? "선택 주변" : "전체 관계"}</span>
              <span>{viewData.stats.skillCount}개 스킬</span>
              <span>{viewData.stats.evidenceCount}개 공고 근거</span>
              <span>드래그 / 확대 / 선택</span>
            </div>
            {viewData.nodes.length === 0 && (
              <div className="graph-empty-state">
                <div className="graph-empty-state__constellation" aria-hidden="true">
                  <svg viewBox="0 0 100 100">
                    {PREVIEW_LINKS.map((link) => (
                      <line
                        key={link.id}
                        x1={link.source.x}
                        y1={link.source.y}
                        x2={link.target.x}
                        y2={link.target.y}
                      />
                    ))}
                  </svg>
                  {PREVIEW_DOTS.map((dot) => (
                    <i
                      key={dot.id}
                      style={
                        {
                          "--dot-x": `${dot.x}%`,
                          "--dot-y": `${dot.y}%`,
                          "--dot-size": `${dot.size}px`,
                          "--dot-color": dot.color,
                        } as CSSProperties
                      }
                    />
                  ))}
                  {PREVIEW_NODES.map((node) => (
                    <b
                      key={node.label}
                      style={
                        {
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                          width: `${node.size * 4.6}px`,
                          height: `${node.size * 4.6}px`,
                          backgroundColor: node.color,
                        } as CSSProperties
                      }
                      title={node.label}
                    />
                  ))}
                </div>
                <strong>
                  {isFilteredEmpty
                    ? "필터와 일치하는 노드가 없습니다"
                    : "그래프 데이터 연결 대기 중"}
                </strong>
                <p>
                  {isFilteredEmpty
                    ? "검색어와 분야 필터를 줄이면 다시 관계가 표시됩니다."
                    : "API가 연결되면 실제 공고 근거가 있는 스킬 관계만 표시됩니다."}
                </p>
              </div>
            )}
            {showFallbackGraph && (
              <>
                <svg className="graph-edges" aria-hidden="true" viewBox="0 0 100 100">
                  {viewData.links.filter((link) => link.kind === "skill").map((edge) => {
                    const source = nodeMap.get(edge.source);
                    const target = nodeMap.get(edge.target);
                    if (!source || !target) {
                      return null;
                    }
                    return (
                      <line
                        key={edge.id}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={domainColor(target.domains[0])}
                        strokeOpacity={Math.min(0.72, 0.24 + edge.score)}
                        strokeWidth={Math.max(0.2, Math.min(1.4, edge.score))}
                      />
                    );
                  })}
                </svg>
                {nodes.map((node) => (
                  <button
                    className={`graph-node ${node.seed ? "graph-node--seed" : ""} ${
                      selectedId === node.id ? "is-selected" : ""
                    }`}
                    key={node.id}
                    style={
                      {
                        left: `${node.x}%`,
                        top: `${node.y}%`,
                        "--node-color": domainColor(node.domains[0]),
                      } as CSSProperties
                    }
                    type="button"
                    onClick={() => selectSkill(node.id)}
                  >
                    <span>{node.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {advancedOpen && (
            <div className="graph-settings-panel" aria-label="고급 그래프 설정">
              <div className="graph-control-section">
                <div className="graph-control-section__title">
                  <h4>필터</h4>
                </div>
                <label className="graph-control-check">
                  <input
                    checked={showEvidence}
                    type="checkbox"
                    onChange={(event) => setShowEvidence(event.target.checked)}
                  />
                  공고 근거 노드
                </label>
                <label className="graph-control-check">
                  <input
                    checked={showIsolated}
                    type="checkbox"
                    onChange={(event) => setShowIsolated(event.target.checked)}
                  />
                  고립 스킬 표시
                </label>
              </div>

              <div className="graph-control-section">
                <div className="graph-control-section__title">
                  <h4>분야</h4>
                  <span>{enabledDomains.length}/{Math.max(1, allDomains.length)}</span>
                </div>
                <div className="graph-group-list">
                  {allDomains.length > 0 ? (
                    allDomains.map((group) => {
                      const enabled = !disabledDomains.includes(group.domain);
                      return (
                        <button
                          className={enabled ? "is-active" : ""}
                          key={group.domain}
                          type="button"
                          aria-pressed={enabled}
                          onClick={() => toggleDomain(group.domain)}
                        >
                          <i style={{ backgroundColor: group.color }} />
                          <span>{displayDomain(group.domain)}</span>
                          <b>{group.count}</b>
                        </button>
                      );
                    })
                  ) : (
                    <p>분류된 분야가 없습니다.</p>
                  )}
                </div>
              </div>

              <div className="graph-control-section">
                <div className="graph-control-section__title">
                  <h4>표시</h4>
                  <button
                    type="button"
                    onClick={() => setReheatKey((current) => current + 1)}
                  >
                    다시 배치
                  </button>
                </div>
                <label className="graph-control-range" htmlFor="graph-label-threshold">
                  <span>라벨 표시</span>
                  <b>{display.labelThreshold.toFixed(2)}</b>
                  <input
                    id="graph-label-threshold"
                    type="range"
                    min="0.35"
                    max="2.4"
                    step="0.05"
                    value={display.labelThreshold}
                    onChange={(event) =>
                      updateDisplay("labelThreshold", Number(event.target.value))
                    }
                  />
                </label>
                <label className="graph-control-range" htmlFor="graph-node-size">
                  <span>노드 크기</span>
                  <b>{display.nodeScale.toFixed(2)}</b>
                  <input
                    id="graph-node-size"
                    type="range"
                    min="0.55"
                    max="1.8"
                    step="0.05"
                    value={display.nodeScale}
                    onChange={(event) =>
                      updateDisplay("nodeScale", Number(event.target.value))
                    }
                  />
                </label>
                <label className="graph-control-range" htmlFor="graph-link-thickness">
                  <span>연결선 두께</span>
                  <b>{display.linkThickness.toFixed(2)}</b>
                  <input
                    id="graph-link-thickness"
                    type="range"
                    min="0.3"
                    max="1.8"
                    step="0.05"
                    value={display.linkThickness}
                    onChange={(event) =>
                      updateDisplay("linkThickness", Number(event.target.value))
                    }
                  />
                </label>
                <label className="graph-control-check">
                  <input
                    checked={display.arrows}
                    type="checkbox"
                    onChange={(event) => updateDisplay("arrows", event.target.checked)}
                  />
                  방향 화살표
                </label>
                <label className="graph-control-check">
                  <input
                    checked={display.animate}
                    type="checkbox"
                    onChange={(event) => updateDisplay("animate", event.target.checked)}
                  />
                  실시간 움직임
                </label>
              </div>

              <div className="graph-control-section">
                <div className="graph-control-section__title">
                  <h4>물리 값</h4>
                </div>
                <label className="graph-control-range" htmlFor="graph-center-force">
                  <span>중심 힘</span>
                  <b>{forces.center.toFixed(3)}</b>
                  <input
                    id="graph-center-force"
                    type="range"
                    min="0"
                    max="0.16"
                    step="0.005"
                    value={forces.center}
                    onChange={(event) =>
                      updateForces("center", Number(event.target.value))
                    }
                  />
                </label>
                <label className="graph-control-range" htmlFor="graph-repel-force">
                  <span>밀어내기</span>
                  <b>{forces.repel}</b>
                  <input
                    id="graph-repel-force"
                    type="range"
                    min="40"
                    max="520"
                    step="10"
                    value={forces.repel}
                    onChange={(event) =>
                      updateForces("repel", Number(event.target.value))
                    }
                  />
                </label>
                <label className="graph-control-range" htmlFor="graph-link-force">
                  <span>연결 힘</span>
                  <b>{forces.link.toFixed(2)}</b>
                  <input
                    id="graph-link-force"
                    type="range"
                    min="0.04"
                    max="1.05"
                    step="0.02"
                    value={forces.link}
                    onChange={(event) =>
                      updateForces("link", Number(event.target.value))
                    }
                  />
                </label>
                <label className="graph-control-range" htmlFor="graph-link-distance">
                  <span>연결 거리</span>
                  <b>{forces.linkDistance}</b>
                  <input
                    id="graph-link-distance"
                    type="range"
                    min="28"
                    max="180"
                    step="4"
                    value={forces.linkDistance}
                    onChange={(event) =>
                      updateForces("linkDistance", Number(event.target.value))
                    }
                  />
                </label>
              </div>
            </div>
          )}
        </section>

        <aside className="dashboard-side-panel" aria-label="선택 스킬 분석">
          <div className="panel-card selected-skill-card">
            <p className="panel-label">선택한 스킬</p>
            {selected ? (
              <>
                <h3>{selected.label}</h3>
                <p>
                  {selected.domains.map(displayDomain).join(", ")} 분야에서
                  {` ${selected.demand_count}개`} 공고가 요구하거나 언급했습니다.
                </p>
                <dl className="mini-metrics">
                  <div>
                    <dt>필수</dt>
                    <dd>{selected.required_count}</dd>
                  </div>
                  <div>
                    <dt>우대</dt>
                    <dd>{selected.preferred_count}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p>노드를 선택하면 관련 분야, 공고 근거, 다음 준비 기술이 갱신됩니다.</p>
            )}
          </div>

          <div className="panel-card">
            <p className="panel-label">가까운 기술</p>
            <ul className="connection-list">
              {strongestConnections.length > 0 ? (
                strongestConnections.slice(0, 5).map(({ edge, node }) => (
                  <li key={edge.id}>
                    <button type="button" onClick={() => selectSkill(node.id)}>
                      <span>{node.label}</span>
                      <b>{Math.round(edge.score * 100)}%</b>
                    </button>
                  </li>
                ))
              ) : (
                <li>연결된 기술을 불러오는 중입니다.</li>
              )}
            </ul>
          </div>

          <div className="panel-card">
            <p className="panel-label">관련 공고 근거</p>
            <ul className="evidence-list">
              {relatedEvidence.length > 0 ? (
                relatedEvidence.map((item) => (
                  <li key={item.posting_id}>
                    <span>{item.company_name}</span>
                    <strong>{item.title}</strong>
                  </li>
                ))
              ) : (
                <li>공고 근거를 연결하는 중입니다.</li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      <section className="market-lanes" aria-label="시장 동향과 준비 우선순위">
        <article className="market-lane-card">
          <div>
            <p className="panel-label">부족한 핵심 스킬</p>
            <h3>다음에 준비할 기술</h3>
          </div>
          <ul className="next-skill-list next-skill-list--rich">
            {fitState === "loading" && <li>분석 중입니다.</li>}
            {fitState === "error" && <li>분석 API 상태를 확인해 주세요.</li>}
            {fit?.recommended_next_skills.slice(0, 5).map((skill) => (
              <li key={skill.skill}>
                <button type="button" onClick={() => selectSkill(skill.skill)}>
                  <span>{skill.skill}</span>
                  <b>{skill.supporting_posting_count}개 공고</b>
                </button>
                <p>{skill.reason}</p>
              </li>
            ))}
            {!fit && fitState === "idle" && <li>보유 스킬을 입력하면 자동 계산합니다.</li>}
          </ul>
        </article>

        <article className="market-lane-card">
          <div>
            <p className="panel-label">분야별 시장 신호</p>
            <h3>어느 방향으로 뻗는지</h3>
          </div>
          <ul className="domain-signal-list">
            {(fit?.domain_branches ?? []).slice(0, 5).map((branch) => (
              <li key={branch.domain}>
                <span>
                  <i style={{ backgroundColor: domainColor(branch.domain) }} />
                  {displayDomain(branch.domain)}
                </span>
                <b>{branch.supporting_posting_count}개</b>
              </li>
            ))}
            {!fit &&
              allDomains.slice(0, 5).map((domain) => (
                <li key={domain.domain}>
                  <span>
                    <i style={{ backgroundColor: domain.color }} />
                    {displayDomain(domain.domain)}
                  </span>
                  <b>{domain.count}개</b>
                </li>
              ))}
          </ul>
        </article>
      </section>
    </section>
  );
}
