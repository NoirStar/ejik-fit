import type { Metadata } from "next";

import { CareerWorkspace } from "@/features/career/career-workspace";
import { buildCareerDomainSuggestions } from "@/features/career/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { getSkillCatalog, getSkillGraph } from "@/lib/api";
import { parseSkillCatalogResponse } from "@/lib/skill-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 커리어",
  description: "직무와 업무 경험, 기술을 바탕으로 이어갈 커리어 방향과 실제 채용공고 근거를 확인합니다.",
};

export default async function CareerPage() {
  const [skillCatalog, domainSuggestions] = await Promise.all([
    settledResource(
      getSkillCatalog().then(
        (response) => parseSkillCatalogResponse(response).items,
      ),
      "표준 기술명 목록을 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillGraph({ limit: 60 }).then(buildCareerDomainSuggestions),
      "분야 목록을 불러오지 못했습니다.",
    ),
  ]);

  return (
    <CareerWorkspace
      catalog={skillCatalog.status === "ready" ? skillCatalog.data : []}
      catalogUnavailable={skillCatalog.status === "error"}
      domains={
        domainSuggestions.status === "ready" ? domainSuggestions.data : []
      }
    />
  );
}
