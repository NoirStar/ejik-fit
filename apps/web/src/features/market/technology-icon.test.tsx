import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
  ])("uses a bundled brand mark for %s", (name, category, iconName) => {
    const { container } = render(
      <TechnologyIcon category={category} name={name} />,
    );

    const icon = container.querySelector("[data-technology-icon]");
    expect(icon).toHaveAttribute("data-icon-kind", "brand");
    expect(icon).toHaveAttribute("data-technology-icon", iconName);
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.querySelector("path")).not.toBeNull();
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
