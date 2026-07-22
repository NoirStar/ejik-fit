import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  resolveTechnologyBrandAsset,
} from "./technology-icon-assets";
import { GENERATED_TECHNOLOGY_BRAND_ASSETS } from "./technology-icon-assets.generated";
import { TechnologyIcon } from "./technology-icon";

describe("TechnologyIcon", () => {
  afterEach(() => cleanup());

  it.each([
    ["Python", "language", "python"],
    ["Kubernetes", "infra", "kubernetes"],
    ["Docker", "infra", "docker"],
    ["Grafana", "infra", "grafana"],
    ["Apache Airflow", "data", "apacheairflow"],
    ["React Native", "mobile", "react"],
    [".NET", "backend", "dotnet"],
    ["GraphQL", "backend", "graphql"],
    ["TanStack Query", "frontend", "reactquery"],
    ["TensorRT", "ai", "nvidia"],
    ["OpenTelemetry", "infra", "opentelemetry"],
  ])("uses an on-demand brand mark for %s", (name, category, iconName) => {
    const { container } = render(
      <TechnologyIcon category={category} name={name} />,
    );

    const icon = container.querySelector("[data-technology-icon]");
    expect(icon).toHaveAttribute("data-icon-kind", "brand");
    expect(icon).toHaveAttribute("data-technology-icon", iconName);
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.querySelector("img")).toHaveAttribute(
      "src",
      `/technology-logos/simple-icons/${iconName}.svg`,
    );
  });

  it.each([
    ["Python", "python"],
    ["Kubernetes", "kubernetes"],
    ["Apache Airflow", "apacheairflow"],
    ["React Native", "react"],
    [".NET", "dotnet"],
    ["TensorRT", "nvidia"],
  ])("maps %s to an on-demand static asset", (name, iconName) => {
    const asset = resolveTechnologyBrandAsset(name);
    expect(asset).toMatchObject({
      key: iconName,
      src: `/technology-logos/simple-icons/${iconName}.svg`,
    });
  });

  it("ships every registered technology logo asset", () => {
    for (const asset of Object.values(GENERATED_TECHNOLOGY_BRAND_ASSETS)) {
      const assetPath = resolve(process.cwd(), "public", asset.src.slice(1));
      expect(existsSync(assetPath), asset.src).toBe(true);
      expect(readFileSync(assetPath, "utf8"), asset.src).toMatch(
        /<svg[^>]+fill="#[0-9A-F]{6}"/,
      );
    }
  });

  it("keeps Simple Icons path data out of the client component", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/market/technology-icon.tsx"),
      "utf8",
    );
    expect(source).not.toContain('from "simple-icons"');
    expect(source).not.toContain("<path");
  });

  it("uses the bundled Devicon AWS mark instead of a generic cloud", () => {
    const { container } = render(
      <TechnologyIcon category="infra" name="AWS" />,
    );

    const icon = container.querySelector('[data-technology-icon="aws"]');
    expect(icon).toHaveAttribute("data-icon-kind", "brand");
    expect(icon?.querySelector("img")).toHaveAttribute(
      "src",
      "/technology-logos/aws.svg",
    );
  });

  it.each([
    ["LLM", "ai", "cpu"],
    ["RAG", "ai", "network"],
    ["SQL", "language", "database"],
    ["알 수 없는 기술", "security", "shield"],
    ["알 수 없는 도구", "tool", "code"],
  ])("uses a neutral fallback for %s", (name, category, iconName) => {
    const { container } = render(
      <TechnologyIcon category={category} name={name} />,
    );

    const icon = container.querySelector("[data-technology-icon]");
    expect(icon).toHaveAttribute("data-icon-kind", "neutral");
    expect(icon).toHaveAttribute("data-technology-icon", iconName);
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
