"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { addOwnedSkill, readOwnedSkills, removeOwnedSkill } from "@/lib/owned-skills";
import { domainColor, summarizeGraph } from "@/lib/skill-graph";
import type {
  FitAnalyzeResponse,
  SkillGraphNode,
  SkillGraphResponse,
} from "@/lib/types";

import { SkillGraphSigmaCanvas } from "./skill-graph-sigma-canvas";


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


function formatDomainLabel(domain: string) {
  return domain.replace(/_/g, " ");
}


export function SkillGraphExperience({
  initialGraph,
  initialOwnedSkills,
}: SkillGraphExperienceProps) {
  const [ownedSkills, setOwnedSkills] = useState(initialOwnedSkills);
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sigmaReady, setSigmaReady] = useState(false);
  const [fit, setFit] = useState<FitAnalyzeResponse | null>(null);
  const [fitState, setFitState] = useState<"idle" | "loading" | "error">("idle");

  const nodes = useMemo(
    () => positionNodes(initialGraph.nodes),
    [initialGraph.nodes],
  );
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const domainGroups = useMemo(() => {
    const counts = new Map<string, number>();
    initialGraph.nodes.forEach((node) => {
      const domain = node.domains[0] ?? "unknown";
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, count]) => ({ domain, count }));
  }, [initialGraph.nodes]);
  const selected = selectedId ? nodeMap.get(selectedId) ?? null : null;
  const hasGraph = nodes.length > 0;
  const showFallbackGraph = hasGraph && !sigmaReady;

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
            <span>{summarizeGraph(initialGraph)}</span>
            <button type="button" onClick={analyze}>
              적합도 분석
            </button>
          </div>
          <div className="graph-canvas" role="img" aria-label="스킬 노드 관계">
            <SkillGraphSigmaCanvas
              graph={initialGraph}
              onNodeSelect={setSelectedId}
              onReadyChange={setSigmaReady}
            />
            <div className="graph-map-legend" aria-hidden="true">
              <span>Groups</span>
              <div>
                {(domainGroups.length > 0 ? domainGroups : [
                  { domain: "embedded", count: 0 },
                  { domain: "ai", count: 0 },
                  { domain: "security", count: 0 },
                ]).map((group) => (
                  <i key={group.domain}>
                    <b style={{ backgroundColor: domainColor(group.domain) }} />
                    {formatDomainLabel(group.domain)}
                  </i>
                ))}
              </div>
            </div>
            {nodes.length === 0 && (
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
                <strong>그래프 데이터 연결 대기 중</strong>
                <p>
                  API가 연결되면 실제 공고 근거가 있는 스킬 관계만 표시됩니다.
                </p>
              </div>
            )}
            {showFallbackGraph && (
              <>
                <svg className="graph-edges" aria-hidden="true" viewBox="0 0 100 100">
                  {initialGraph.edges.map((edge) => {
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
