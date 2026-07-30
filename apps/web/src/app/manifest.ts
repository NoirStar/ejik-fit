import type { MetadataRoute } from "next";
import { MANIFEST_COLORS } from "@/styles/design-tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "커리어핏",
    short_name: "커리어핏",
    description: "내 경력과 기술이 어떤 커리어 방향 및 채용공고와 연결되는지 확인합니다.",
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
