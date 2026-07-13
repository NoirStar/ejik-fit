import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "이직핏",
    short_name: "이직핏",
    description: "공식 채용공고 기반 기술 스택 인텔리전스",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f5f4",
    theme_color: "#087b52",
    lang: "ko",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
