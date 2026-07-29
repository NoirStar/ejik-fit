import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SkillCatalogItem } from "@/lib/types";

import {
  filterSkillSuggestions,
  resolveSkillInput,
  SkillPicker,
} from "./skill-picker";

function catalogItem(
  name: string,
  category = "frontend",
): SkillCatalogItem {
  return {
    category,
    domains: [category],
    kind: "technology",
    name,
  };
}

const catalog = [
  catalogItem("React"),
  catalogItem("React Native", "mobile"),
  catalogItem("JavaScript", "language"),
  catalogItem("TypeScript", "language"),
  catalogItem("Kubernetes", "infra"),
  catalogItem("Node.js", "backend"),
  catalogItem("Spring", "backend"),
  catalogItem("PostgreSQL", "database"),
  catalogItem("C#", "language"),
  catalogItem("C++", "language"),
  catalogItem("Create React App"),
];

function PickerHarness({
  initialValue = "",
  onCommitted,
}: {
  initialValue?: string;
  onCommitted?(value: string): void;
}) {
  const [value, setValue] = useState(initialValue);
  const [skills, setSkills] = useState<string[]>([]);

  return (
    <SkillPicker
      catalog={catalog}
      catalogStatus="ready"
      excludedSkills={skills}
      id="test-skill"
      onCommit={(skill) => {
        onCommitted?.(skill);
        setSkills((current) => [...current, skill]);
        setValue("");
        return true;
      }}
      onValueChange={setValue}
      value={value}
    />
  );
}

describe("skill picker", () => {
  afterEach(cleanup);

  it("ranks canonical names and aliases, excludes selected skills, and caps results", () => {
    expect(
      filterSkillSuggestions(catalog, "react", []).map((item) => item.name),
    ).toEqual(["React", "React Native", "Create React App"]);
    expect(
      filterSkillSuggestions(catalog, "리액트", []).map((item) => item.name),
    ).toEqual(["React"]);
    expect(
      filterSkillSuggestions(catalog, "react", ["React"]).map(
        (item) => item.name,
      ),
    ).toEqual(["React Native", "Create React App"]);
    expect(
      filterSkillSuggestions(catalog, "javascript", ["js"]).map(
        (item) => item.name,
      ),
    ).toEqual([]);

    const manyMatches = Array.from({ length: 9 }, (_, index) =>
      catalogItem(`Java ${index + 1}`, "language"),
    );
    expect(filterSkillSuggestions(manyMatches, "java", [])).toHaveLength(6);
  });

  it("resolves exact aliases and preserves a direct entry", () => {
    expect(resolveSkillInput(" k8s ", catalog)).toBe("Kubernetes");
    expect(resolveSkillInput("자바스크립트", catalog)).toBe("JavaScript");
    expect(resolveSkillInput("WebGPU", catalog)).toBe("WebGPU");
  });

  it("keeps an empty query closed and supports keyboard selection", () => {
    const onCommitted = vi.fn();
    render(<PickerHarness onCommitted={onCommitted} />);

    const input = screen.getByRole("combobox", { name: "추가할 기술" });
    fireEvent.focus(input);
    expect(
      screen.queryByRole("listbox", { name: "기술 검색 결과" }),
    ).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "rea" } });
    expect(
      screen.getByRole("option", { name: "React 프론트엔드" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "React Native 모바일" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "“rea” 직접 추가" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommitted).toHaveBeenCalledWith("React");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(
      screen.queryByRole("listbox", { name: "기술 검색 결과" }),
    ).not.toBeInTheDocument();
  });

  it("waits for a completed click before adding a touch result", () => {
    const onCommitted = vi.fn();
    render(<PickerHarness initialValue="WebGPU" onCommitted={onCommitted} />);

    const input = screen.getByRole("combobox", { name: "추가할 기술" });
    fireEvent.focus(input);
    const option = screen.getByRole("option", {
      name: "“WebGPU” 직접 추가",
    });
    fireEvent.pointerDown(option, { pointerType: "touch" });

    expect(onCommitted).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox", { name: "기술 검색 결과" }))
      .toBeInTheDocument();

    fireEvent.click(option);

    expect(onCommitted).toHaveBeenCalledWith("WebGPU");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("closes only the results on Escape and submits the current value", () => {
    const onCommitted = vi.fn();
    render(<PickerHarness onCommitted={onCommitted} />);

    const input = screen.getByRole("combobox", { name: "추가할 기술" });
    fireEvent.change(input, { target: { value: "k8s" } });
    expect(screen.getByRole("listbox", { name: "기술 검색 결과" }))
      .toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(
      screen.queryByRole("listbox", { name: "기술 검색 결과" }),
    ).not.toBeInTheDocument();
    expect(input).toHaveValue("k8s");

    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(onCommitted).toHaveBeenCalledWith("Kubernetes");
  });
});
