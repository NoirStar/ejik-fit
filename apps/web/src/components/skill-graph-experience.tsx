"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { addOwnedSkill, readOwnedSkills, removeOwnedSkill } from "@/lib/owned-skills";
import { domainColor, summarizeGraph } from "@/lib/skill-graph";
import { buildSkillGraphView } from "@/lib/skill-graph-view";
import type { SkillGraphViewMode } from "@/lib/skill-graph-view";
import type {
  FitAnalyzeResponse,
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


const PREVIEW_NODES = [
  { label: "C++", x: 47, y: 48, size: 7, color: "#7aa2ff" },
  { label: "ROS2", x: 66, y: 38, size: 5.5, color: "#f2994a" },
  { label: "Linux", x: 56, y: 63, size: 5.2, color: "#36d399" },
  { label: "Python", x: 34, y: 36, size: 5, color: "#bca7ff" },
  { label: "Security", x: 72, y: 60, size: 4.6, color: "#ff7b72" },
];


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


export function SkillGraphExperience({
  initialGraph,
  initialOwnedSkills,
}: SkillGraphExperienceProps) {
  const [ownedSkills, setOwnedSkills] = useState(initialOwnedSkills);
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forceReady, setForceReady] = useState(false);
  const [graphMode, setGraphMode] = useState<SkillGraphViewMode>("global");
  const [localDepth, setLocalDepth] = useState(1);
  const [filterQuery, setFilterQuery] = useState("");
  const [showEvidence, setShowEvidence] = useState(true);
  const [showIsolated, setShowIsolated] = useState(true);
  const [disabledDomains, setDisabledDomains] = useState<string[]>([]);
  const [reheatKey, setReheatKey] = useState(0);
  const [display, setDisplay] = useState<SkillGraphDisplaySettings>({
    animate: true,
    arrows: false,
    labelThreshold: 0.92,
    linkThickness: 0.82,
    nodeScale: 0.92,
  });
  const [forces, setForces] = useState<SkillGraphForceSettings>({
    center: 0.045,
    link: 0.34,
    linkDistance: 78,
    repel: 210,
  });
  const [fit, setFit] = useState<FitAnalyzeResponse | null>(null);
  const [fitState, setFitState] = useState<"idle" | "loading" | "error">("idle");

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
  const selected = selectedId ? nodeMap.get(selectedId) ?? null : null;
  const hasGraph = viewData.nodes.length > 0;
  const isFilteredEmpty = initialGraph.nodes.length > 0 && !hasGraph;
  const showFallbackGraph = nodes.length > 0 && !forceReady;

  useEffect(() => {
    const stored = readOwnedSkills();
    if (stored.length > 0) {
      setOwnedSkills(stored);
    }
  }, []);

  async function analyze() {
    setFitState("loading");
    setFit(null);
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
      setFit((await response.json()) as FitAnalyzeResponse);
      setFitState("idle");
    } catch {
      setFitState("error");
    }
  }

  function addSkill() {
    const next = input.trim();
    if (!next) {
      return;
    }
    setOwnedSkills(addOwnedSkill(next));
    setInput("");
  }

  function removeSkill(skill: string) {
    setOwnedSkills(removeOwnedSkill(skill));
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
    setGraphMode("global");
    setFilterQuery("");
    setShowEvidence(true);
    setShowIsolated(true);
    setDisabledDomains([]);
    setLocalDepth(1);
    setReheatKey((current) => current + 1);
  }

  return (
    <section className="graph-product" aria-label="스킬 관계 그래프">
      <div className="graph-toolbar">
        <div>
          <p className="panel-label">나의 스킬</p>
          <div className="owned-skill-list" aria-label="저장된 보유 스킬">
            {ownedSkills.map((skill) => (
              <button
                className="owned-skill-chip"
                key={skill}
                type="button"
                onClick={() => removeSkill(skill)}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
        <form
          className="skill-add-form"
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
              placeholder="예: ROS2, Kubernetes"
            />
            <button type="submit">추가</button>
          </div>
        </form>
      </div>

      <div className="graph-workspace">
        <div className="graph-canvas-card">
          <div className="graph-canvas-header">
            <span>
              {summarizeGraph(initialGraph)} / 현재 {viewData.stats.skillCount}개 스킬,
              {viewData.stats.linkCount}개 연결
            </span>
            <button type="button" onClick={analyze}>
              적합도 분석
            </button>
          </div>
          <div className="graph-canvas" role="region" aria-label="스킬 노드 관계">
            <SkillGraphForceCanvas
              data={viewData}
              display={display}
              forces={forces}
              selectedId={selectedId}
              onNodeSelect={setSelectedId}
              onReadyChange={setForceReady}
              reheatKey={reheatKey}
            />
            <div className="graph-control-panel" aria-label="Graph view controls">
              <div className="graph-control-section">
                <div className="graph-control-section__title">
                  <h3>Filters</h3>
                  <button type="button" onClick={resetGraphView}>
                    Reset
                  </button>
                </div>
                <label className="graph-control-field" htmlFor="graph-filter-query">
                  <span>Search</span>
                  <input
                    id="graph-filter-query"
                    value={filterQuery}
                    onChange={(event) => setFilterQuery(event.target.value)}
                    placeholder="C++, ROS2, Security"
                  />
                </label>
                <div className="graph-mode-toggle" aria-label="Graph scope">
                  <button
                    className={graphMode === "global" ? "is-active" : ""}
                    type="button"
                    onClick={() => setGraphMode("global")}
                  >
                    Global
                  </button>
                  <button
                    className={graphMode === "local" ? "is-active" : ""}
                    type="button"
                    onClick={() => setGraphMode("local")}
                  >
                    Local
                  </button>
                </div>
                <label className="graph-control-range" htmlFor="graph-local-depth">
                  <span>Local depth</span>
                  <b>{localDepth}</b>
                  <input
                    id="graph-local-depth"
                    aria-label="Local depth"
                    type="range"
                    min="1"
                    max="3"
                    step="1"
                    value={localDepth}
                    disabled={graphMode !== "local"}
                    onChange={(event) => setLocalDepth(Number(event.target.value))}
                  />
                </label>
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
                  <h3>Groups</h3>
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
                          <span>{group.label}</span>
                          <b>{group.count}</b>
                        </button>
                      );
                    })
                  ) : (
                    <p>분류된 도메인이 없습니다.</p>
                  )}
                </div>
              </div>

              <div className="graph-control-section">
                <div className="graph-control-section__title">
                  <h3>Display</h3>
                  <button
                    type="button"
                    onClick={() => setReheatKey((current) => current + 1)}
                  >
                    Animate
                  </button>
                </div>
                <label className="graph-control-range" htmlFor="graph-label-threshold">
                  <span>Text fade threshold</span>
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
                  <span>Node size</span>
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
                  <span>Link thickness</span>
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
                  Arrows
                </label>
                <label className="graph-control-check">
                  <input
                    checked={display.animate}
                    type="checkbox"
                    onChange={(event) => updateDisplay("animate", event.target.checked)}
                  />
                  Live physics
                </label>
              </div>

              <div className="graph-control-section">
                <div className="graph-control-section__title">
                  <h3>Forces</h3>
                </div>
                <label className="graph-control-range" htmlFor="graph-center-force">
                  <span>Center force</span>
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
                  <span>Repel force</span>
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
                  <span>Link force</span>
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
                  <span>Link distance</span>
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
            <div className="graph-status-strip" aria-hidden="true">
              <span>{graphMode === "local" ? "Local graph" : "Global graph"}</span>
              <span>{viewData.stats.skillCount} skills</span>
              <span>{viewData.stats.evidenceCount} postings</span>
              <span>drag / zoom / click</span>
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
                    ? "검색어와 그룹 필터를 줄이면 다시 관계가 표시됩니다."
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
                    className={`graph-node ${node.seed ? "graph-node--seed" : ""}`}
                    key={node.id}
                    style={
                      {
                        left: `${node.x}%`,
                        top: `${node.y}%`,
                        "--node-color": domainColor(node.domains[0]),
                      } as CSSProperties
                    }
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                  >
                    <span>{node.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        <aside className="graph-insight-panel">
          <div className="panel-card">
            <p className="panel-label">선택한 관계</p>
            {selected ? (
              <>
                <h2>{selected.label}</h2>
                <p>
                  {selected.domains.join(", ")} 분야에서 {selected.demand_count}개
                  공고가 요구하거나 언급했습니다.
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
              <p>
                노드를 선택하면 해당 기술이 어떤 분야와 공고에서 연결되는지
                확인할 수 있습니다.
              </p>
            )}
          </div>

          <div className="panel-card">
            <p className="panel-label">공고 근거</p>
            <ul className="evidence-list">
              {initialGraph.evidence.slice(0, 4).map((item) => (
                <li key={item.posting_id}>
                  <span>{item.company_name}</span>
                  <strong>{item.title}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel-card">
            <p className="panel-label">Fit 분석</p>
            {fitState === "loading" && <p>분석 중입니다.</p>}
            {fitState === "error" && (
              <p>분석 결과를 불러오지 못했습니다. API 상태를 확인해 주세요.</p>
            )}
            {fit && (
              <>
                <dl className="mini-metrics">
                  <div>
                    <dt>관련 공고</dt>
                    <dd>{fit.coverage.matching_posting_count}</dd>
                  </div>
                  <div>
                    <dt>강한 일치</dt>
                    <dd>{fit.coverage.strong_fit_posting_count}</dd>
                  </div>
                </dl>
                <ul className="next-skill-list">
                  {fit.recommended_next_skills.slice(0, 4).map((skill) => (
                    <li key={skill.skill}>{skill.skill}</li>
                  ))}
                </ul>
              </>
            )}
            {!fit && fitState === "idle" && (
              <p>보유 스킬을 기준으로 부족한 필수 기술을 계산합니다.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
