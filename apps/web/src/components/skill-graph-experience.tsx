"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CalendarDots,
  GearSix,
  Graph,
  MagnifyingGlass,
  SquaresFour,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

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
  { label: "C++", x: 47, y: 48, size: 7, color: "#5d8cff" },
  { label: "ROS2", x: 66, y: 38, size: 5.5, color: "#f2994a" },
  { label: "Linux", x: 56, y: 63, size: 5.2, color: "#23c979" },
  { label: "Python", x: 34, y: 36, size: 5, color: "#8aa8ff" },
  { label: "Security", x: 72, y: 60, size: 4.6, color: "#ff6f61" },
];


const TOOL_ITEMS: Array<{ label: string; icon: Icon }> = [
  { label: "대시보드", icon: SquaresFour },
  { label: "그래프", icon: Graph },
  { label: "공고", icon: Briefcase },
  { label: "캘린더", icon: CalendarDots },
  { label: "설정", icon: GearSix },
];


const DEFAULT_DISPLAY: SkillGraphDisplaySettings = {
  animate: true,
  arrows: false,
  labelThreshold: 1.08,
  linkThickness: 0.76,
  nodeScale: 0.9,
};


const DEFAULT_FORCES: SkillGraphForceSettings = {
  center: 0.04,
  link: 0.28,
  linkDistance: 82,
  repel: 240,
};


const CALENDAR_DAYS = Array.from({ length: 21 }, (_, index) => {
  const intensity = index % 7 === 2 ? "high" : index % 5 === 0 ? "mid" : "low";
  return {
    day: index + 8,
    intensity,
  };
});


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
    color: index % 13 === 0 ? cluster.color : "rgba(201, 212, 232, 0.68)",
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
    return evidence.slice(0, 6);
  }
  const direct = evidence.filter((item) => item.skills.includes(selectedId));
  return (direct.length > 0 ? direct : evidence).slice(0, 6);
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
  const [reheatKey, setReheatKey] = useState(0);
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
    return Array.from(new Set(suggested)).slice(0, 8);
  }, [initialGraph.nodes, ownedSkills]);
  const mainFitPercent = fitPercent(fit);
  const topNextSkill = fit?.recommended_next_skills[0] ?? null;
  const topBranch = fit?.domain_branches[0] ?? null;
  const isFilteredEmpty = initialGraph.nodes.length > 0 && viewData.nodes.length === 0;
  const showFallbackGraph = nodes.length > 0 && !forceReady;
  const isLargeGraph = viewData.nodes.length > 1500;
  const display = useMemo<SkillGraphDisplaySettings>(
    () => ({
      ...DEFAULT_DISPLAY,
      animate: !isLargeGraph,
      labelThreshold: graphMode === "global" ? 1.28 : DEFAULT_DISPLAY.labelThreshold,
    }),
    [graphMode, isLargeGraph],
  );
  const forces = useMemo<SkillGraphForceSettings>(
    () => ({
      ...DEFAULT_FORCES,
      linkDistance: graphMode === "global" ? 62 : DEFAULT_FORCES.linkDistance,
      repel: graphMode === "global" ? 190 : DEFAULT_FORCES.repel,
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
    <section className="ti-app-shell" aria-label="기술 채용 인텔리전스 대시보드">
      <aside className="ti-rail" aria-label="주요 메뉴">
        <a className="ti-rail__brand" href="/skills/graph" aria-label="ejik 대시보드">
          e
        </a>
        <nav className="ti-rail__nav">
          {TOOL_ITEMS.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <button
                className={index === 0 ? "is-active" : ""}
                key={item.label}
                type="button"
              >
                <IconComponent size={20} weight={index === 0 ? "fill" : "regular"} aria-hidden />
                <b>{item.label}</b>
              </button>
            );
          })}
        </nav>
      </aside>

      <aside className="ti-workbench" aria-label="필터와 보유 스킬">
        <header className="ti-workbench__brand">
          <strong>기술 채용 인텔리전스</strong>
          <span>{summarizeGraph(initialGraph)}</span>
        </header>

        <form
          className="ti-skill-form"
          onSubmit={(event) => {
            event.preventDefault();
            addSkill();
          }}
        >
          <label htmlFor="owned-skill">스킬 추가</label>
          <div>
            <input
              id="owned-skill"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="ROS2, Kubernetes"
            />
            <button type="submit">추가</button>
          </div>
        </form>

        <section className="ti-panel">
          <header>
            <h2>내 스택</h2>
            <span>{ownedSkills.length}개</span>
          </header>
          <div className="ti-chip-cloud" aria-label="저장된 보유 스킬">
            {ownedSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                aria-label={`${skill} 제거`}
                onClick={() => removeSkill(skill)}
              >
                {skill}
              </button>
            ))}
          </div>
        </section>

        <section className="ti-panel ti-panel--filters">
          <header>
            <h2>그래프 필터</h2>
            <button type="button" onClick={resetGraphView}>초기화</button>
          </header>
          <div className="ti-segment" aria-label="그래프 범위">
            <button
              className={graphMode === "local" ? "is-active" : ""}
              type="button"
              onClick={() => setGraphMode("local")}
            >
              주변
            </button>
            <button
              className={graphMode === "global" ? "is-active" : ""}
              type="button"
              onClick={() => setGraphMode("global")}
            >
              전체
            </button>
          </div>
          <label className="ti-range" htmlFor="graph-local-depth">
            <span>깊이</span>
            <b>{localDepth}</b>
            <input
              id="graph-local-depth"
              aria-label="주변 깊이"
              type="range"
              min="1"
              max="3"
              step="1"
              value={localDepth}
              disabled={graphMode !== "local"}
              onChange={(event) => setLocalDepth(Number(event.target.value))}
            />
          </label>
          <label className="ti-check">
            <input
              checked={showEvidence}
              type="checkbox"
              onChange={(event) => setShowEvidence(event.target.checked)}
            />
            공고 노드
          </label>
          <label className="ti-check">
            <input
              checked={showIsolated}
              type="checkbox"
              onChange={(event) => setShowIsolated(event.target.checked)}
            />
            고립 스킬
          </label>
        </section>

        <section className="ti-panel ti-panel--domains">
          <header>
            <h2>분야</h2>
            <span>{enabledDomains.length}/{Math.max(1, allDomains.length)}</span>
          </header>
          <div className="ti-domain-list">
            {allDomains.slice(0, 9).map((group) => {
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
            })}
            {allDomains.length === 0 && <p>분야 데이터 대기 중</p>}
          </div>
        </section>

        <section className="ti-panel ti-panel--advanced">
          <header>
            <h2>그래프 표시</h2>
            <span>{isLargeGraph ? "대용량 안정" : "동적 배치"}</span>
          </header>
          <div className="ti-advanced-grid">
            <p>
              노드 수에 따라 움직임과 밀도를 자동으로 조정합니다. 배치가 엉키면 새로 계산할 수 있습니다.
            </p>
            <button type="button" onClick={() => setReheatKey((current) => current + 1)}>
              다시 배치
            </button>
          </div>
        </section>
      </aside>

      <main className="ti-stage" aria-label="그래프 작업 영역">
        <header className="ti-topbar">
          <div>
            <h1>기술 채용 인텔리전스</h1>
            <span>{graphMode === "local" ? "선택 주변" : "전체 시장"} 보기</span>
          </div>
          <label className="ti-command-search" htmlFor="dashboard-command-search">
            <span aria-hidden="true">
              <MagnifyingGlass size={16} />
            </span>
            <input
              id="dashboard-command-search"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="기술, 직무, 기업"
            />
          </label>
          <div className="ti-topbar__metrics" aria-label="요약 지표">
            <span>{viewData.stats.skillCount} 스킬</span>
            <span>{viewData.stats.linkCount} 연결</span>
            <span>{viewData.stats.evidenceCount} 공고</span>
          </div>
        </header>

        <div className="ti-graph-frame">
          <SkillGraphForceCanvas
            data={viewData}
            display={display}
            forces={forces}
            selectedId={selectedId}
            onNodeSelect={selectSkill}
            onReadyChange={setForceReady}
            reheatKey={reheatKey}
          />
          <div className="ti-graph-toolbar" aria-label="그래프 빠른 선택">
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
          <div className="ti-graph-status" aria-hidden="true">
            <span>{viewData.stats.skillCount}개 스킬</span>
            <span>{viewData.stats.evidenceCount}개 공고</span>
            <span>드래그 / 확대 / 선택</span>
          </div>
          {viewData.nodes.length === 0 && (
            <div className="graph-empty-state ti-empty-state">
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
              </div>
              <strong>
                {isFilteredEmpty
                  ? "필터와 일치하는 노드가 없습니다"
                  : "그래프 데이터 대기 중"}
              </strong>
              <p>
                {isFilteredEmpty
                  ? "검색어와 분야 필터를 줄이면 관계가 다시 표시됩니다."
                  : "API가 연결되면 공고 근거가 있는 스킬 관계가 표시됩니다."}
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

        <section className="ti-bottom-rail" aria-label="시장 신호와 채용 캘린더">
          <article>
            <header>
              <h2>다음 준비</h2>
              <span>{fitState === "loading" ? "계산 중" : "적합도"}</span>
            </header>
            <div className="ti-next-skill-row">
              {(fit?.recommended_next_skills ?? []).slice(0, 4).map((skill) => (
                <button key={skill.skill} type="button" onClick={() => selectSkill(skill.skill)}>
                  <b>{skill.skill}</b>
                  <span>{skill.supporting_posting_count}개 공고</span>
                </button>
              ))}
              {!fit && <p>보유 스킬을 기준으로 준비 우선순위를 계산합니다.</p>}
            </div>
          </article>
          <article>
            <header>
              <h2>채용 캘린더</h2>
              <span>마감 신호</span>
            </header>
            <div className="ti-calendar-strip" aria-label="채용 일정 미리보기">
              {CALENDAR_DAYS.map((day) => (
                <i className={`is-${day.intensity}`} key={day.day}>
                  {day.day}
                </i>
              ))}
            </div>
          </article>
          <article>
            <header>
              <h2>분야 신호</h2>
              <span>{topBranch ? displayDomain(topBranch.domain) : "시장"}</span>
            </header>
            <div className="ti-domain-sparks">
              {(fit?.domain_branches ?? []).slice(0, 4).map((branch) => (
                <span key={branch.domain}>
                  <i style={{ backgroundColor: domainColor(branch.domain) }} />
                  {displayDomain(branch.domain)}
                  <b>{branch.supporting_posting_count}</b>
                </span>
              ))}
              {!fit &&
                allDomains.slice(0, 4).map((domain) => (
                  <span key={domain.domain}>
                    <i style={{ backgroundColor: domain.color }} />
                    {displayDomain(domain.domain)}
                    <b>{domain.count}</b>
                  </span>
                ))}
            </div>
          </article>
        </section>
      </main>

      <aside className="ti-inspector" aria-label="선택 항목 분석">
        <section className="ti-inspector__hero">
          <span>선택 스킬</span>
          <h2>{selected?.label ?? "스킬 선택"}</h2>
          <p>
            {selected
              ? `${selected.domains.map(displayDomain).join(", ")} 분야에서 ${selected.demand_count}개 공고가 언급했습니다.`
              : "그래프에서 노드를 선택하면 공고 근거와 가까운 기술이 갱신됩니다."}
          </p>
          <dl>
            <div>
              <dt>필수</dt>
              <dd>{selected?.required_count ?? 0}</dd>
            </div>
            <div>
              <dt>우대</dt>
              <dd>{selected?.preferred_count ?? 0}</dd>
            </div>
            <div>
              <dt>Fit</dt>
              <dd>
                {fitState === "loading"
                  ? "계산"
                  : mainFitPercent !== null
                    ? `${mainFitPercent}%`
                    : "대기"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="ti-inspector__section">
          <header>
            <h2>가까운 기술</h2>
            <span>{strongestConnections.length}</span>
          </header>
          <ul className="ti-link-list">
            {strongestConnections.length > 0 ? (
              strongestConnections.slice(0, 6).map(({ edge, node }) => (
                <li key={edge.id}>
                  <button type="button" onClick={() => selectSkill(node.id)}>
                    <span>{node.label}</span>
                    <b>{Math.round(edge.score * 100)}%</b>
                  </button>
                </li>
              ))
            ) : (
              <li>연결 데이터 대기 중</li>
            )}
          </ul>
        </section>

        <section className="ti-inspector__section">
          <header>
            <h2>관련 공고</h2>
            <span>{relatedEvidence.length}</span>
          </header>
          <ul className="ti-job-evidence">
            {relatedEvidence.length > 0 ? (
              relatedEvidence.map((item) => (
                <li key={item.posting_id}>
                  <span>{item.company_name}</span>
                  <strong>{item.title}</strong>
                </li>
              ))
            ) : (
              <li>공고 근거 대기 중</li>
            )}
          </ul>
        </section>

        <section className="ti-inspector__section">
          <header>
            <h2>추천 경로</h2>
            <span>{topNextSkill?.skill ?? "대기"}</span>
          </header>
          <p className="ti-route-note">
            {topNextSkill?.reason ??
              "보유 스킬과 공고 요구를 비교해 다음 준비 기술을 제안합니다."}
          </p>
        </section>
      </aside>
    </section>
  );
}
