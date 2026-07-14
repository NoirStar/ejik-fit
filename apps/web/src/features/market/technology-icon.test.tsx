import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TechnologyIcon } from "./technology-icon";

describe("TechnologyIcon", () => {
  afterEach(() => cleanup());

  it.each([
    ["Python", "language", "python"],
    ["Kubernetes", "infra", "kubernetes"],
    ["Docker", "infra", "docker"],
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
