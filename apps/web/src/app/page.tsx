import type { Metadata } from "next";

import SkillGraphPage from "./skills/graph/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "시장 적합도 대시보드",
  description:
    "보유 기술에서 연결되는 채용시장, 부족한 준비, 관련 공고를 한 화면에서 확인합니다.",
};

export default SkillGraphPage;
