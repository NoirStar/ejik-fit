import { redirect } from "next/navigation";

import {
  buildSkillGraphHref,
  type ProductRouteParams,
} from "@/lib/product-routes";

type SkillMapPageProps = {
  searchParams?: Promise<ProductRouteParams>;
};

export default async function SkillMapPage({ searchParams }: SkillMapPageProps) {
  redirect(buildSkillGraphHref((await searchParams) ?? {}));
}
