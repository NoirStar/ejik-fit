import type { SkillGraphResponse } from "./types";


const DOMAIN_COLORS: Record<string, string> = {
  ai: "#9b51e0",
  autonomy: "#2d9cdb",
  backend: "#27ae60",
  cloud: "#56ccf2",
  computer_vision: "#00a99d",
  data: "#f2c94c",
  design: "#bb6bd9",
  devops: "#6fcf97",
  embedded: "#f2994a",
  frontend: "#eb5757",
  game: "#f65a83",
  graphics: "#f2994a",
  high_performance: "#d35400",
  mlops: "#8e44ad",
  product: "#7f8c8d",
  qa: "#34495e",
  robotics: "#2f80ed",
  security: "#c0392b",
  web: "#219653",
};


export function domainColor(domain: string | undefined): string {
  return domain ? (DOMAIN_COLORS[domain] ?? "#7b8187") : "#7b8187";
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
