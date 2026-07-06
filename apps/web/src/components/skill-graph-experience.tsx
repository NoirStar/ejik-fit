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


export function SkillGraphExperience({
  initialGraph,
  initialOwnedSkills,
}: SkillGraphExperienceProps) {
  const [ownedSkills, setOwnedSkills] = useState(initialOwnedSkills);
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const selected = selectedId ? nodeMap.get(selectedId) ?? null : null;

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
          <p className="eyebrow">나의 스킬</p>
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
            />
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
          </div>
        </div>

        <aside className="graph-insight-panel">
          <div className="panel-card">
            <p className="eyebrow">선택한 관계</p>
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
            <p className="eyebrow">공고 근거</p>
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
            <p className="eyebrow">Fit 분석</p>
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
