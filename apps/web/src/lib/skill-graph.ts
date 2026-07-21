import {
  GRAPH_DEFAULT_COLOR,
  GRAPH_DOMAIN_COLORS,
} from "@/styles/design-tokens";

import type { SkillGraphResponse } from "./types";


export function domainColor(domain: string | undefined): string {
  if (!domain) return GRAPH_DEFAULT_COLOR;
  return (
    GRAPH_DOMAIN_COLORS[domain as keyof typeof GRAPH_DOMAIN_COLORS] ??
    GRAPH_DEFAULT_COLOR
  );
}


export function nodeSize(demandCount: number): number {
  return Math.max(8, Math.min(28, 8 + Math.sqrt(Math.max(0, demandCount)) * 4));
}


export function edgeSize(score: number): number {
  return Math.max(1, Math.min(6, 1 + Math.max(0, score) * 5));
}


export function summarizeGraph(graph: SkillGraphResponse): string {
  const seed = graph.seed ?? "전체";
  return `${seed} 중심 그래프: ${graph.nodes.length}개 스킬, ${graph.edges.length}개 관계`;
}
