import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "이직핏",
    short_name: "이직핏",
    description: "공식 채용공고 기반 기술 스택 인텔리전스",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6fc",
    theme_color: "#6d4be8",
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
