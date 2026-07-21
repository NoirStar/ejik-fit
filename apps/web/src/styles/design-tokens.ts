/** Non-CSS color tokens for canvas, SVG, and web-app metadata consumers. */
export const GRAPH_DOMAIN_COLORS = {
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
} as const;

export const GRAPH_DEFAULT_COLOR = "#7b8187";

export const GRAPH_PREVIEW_COLORS = {
  cpp: "#5d8cff",
  ros: "#f2994a",
  linux: "#23c979",
  python: "#8aa8ff",
  security: "#ff6f61",
  ambient: "rgba(201, 212, 232, 0.68)",
} as const;

export const GRAPH_CANVAS_COLORS = {
  postingNode: "rgba(113, 116, 130, 0.58)",
  postingShadow: "rgba(61, 57, 77, 0.14)",
  nodeHighlight: "rgba(255, 255, 255, 0.44)",
  labelOutline: "rgba(255, 255, 255, 0.92)",
  postingLabel: "#62626d",
  skillLabel: "#25252c",
  transparent: "rgba(0, 0, 0, 0)",
  dimmedLink: "rgba(86, 56, 198, 0.06)",
  evidenceLink: "rgba(98, 98, 112, 0.2)",
  skillLink: "rgba(86, 56, 198, 0.28)",
  evidenceNode: "rgba(218, 224, 236, 0.76)",
} as const;

export const MARKET_TREND_COLORS = ["#67a2c5", "#9bcec1", "#ff9f8b"] as const;

export const MANIFEST_COLORS = {
  background: "#f7f6fc",
  theme: "#6d4be8",
} as const;
