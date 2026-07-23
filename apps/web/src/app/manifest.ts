import type { MetadataRoute } from "next";
import { MANIFEST_COLORS } from "@/styles/design-tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "이직핏",
    short_name: "이직핏",
    description: "채용공고 기술 분석과 스킬맵",
    start_url: "/",
    display: "standalone",
    background_color: MANIFEST_COLORS.background,
    theme_color: MANIFEST_COLORS.theme,
    lang: "ko",
    icons: [
      {
        src: "/brand/ejik-fit-mascot.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/ejik-fit-mascot-apple.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
