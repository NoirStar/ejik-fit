import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SkillCatalogItem } from "@/lib/types";

import { SkillGraphSearch } from "./skill-graph-search";


const catalog: SkillCatalogItem[] = [
  { name: "C++", category: "language", kind: "language", domains: ["embedded"] },
  { name: "Python", category: "language", kind: "language", domains: ["data"] },
  { name: "PyTorch", category: "framework", kind: "framework", domains: ["ai"] },
  { name: "pytest", category: "tool", kind: "tool", domains: ["qa"] },
  { name: "Pydantic", category: "framework", kind: "framework", domains: ["backend"] },
  { name: "PySpark", category: "framework", kind: "framework", domains: ["data"] },
  { name: "PyPI", category: "platform", kind: "platform", domains: ["backend"] },
];


afterEach(cleanup);


describe("SkillGraphSearch", () => {
  it("does not open the full catalog before the user types", () => {
    render(
      <SkillGraphSearch
        catalog={catalog}
        onSelect={vi.fn()}
        onValueChange={vi.fn()}
        value=""
      />,
    );

    expect(screen.getByRole("combobox", { name: "기술 찾기" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { name: "기술 검색 결과" }))
      .not.toBeInTheDocument();
  });

  it("limits suggestions and supports arrow-key selection", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <SkillGraphSearch
        catalog={catalog}
        onSelect={onSelect}
        onValueChange={vi.fn()}
        value="Py"
      />,
    );
    rerender(
      <SkillGraphSearch
        catalog={catalog}
        onSelect={onSelect}
        onValueChange={vi.fn()}
        value="Py"
      />,
    );

    const input = screen.getByRole("combobox", { name: "기술 찾기" });
    input.focus();
    fireEvent.focus(input);
    expect(screen.getAllByRole("option")).toHaveLength(6);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("Pydantic");
  });

  it("releases the input after a pointer selection", () => {
    render(
      <SkillGraphSearch
        catalog={catalog}
        onSelect={vi.fn()}
        onValueChange={vi.fn()}
        value="C"
      />,
    );

    const input = screen.getByRole("combobox", { name: "기술 찾기" });
    input.focus();
    fireEvent.focus(input);
    expect(input).toHaveFocus();
    fireEvent.click(screen.getByRole("option", { name: /C\+\+/ }));

    expect(input).not.toHaveFocus();
  });
});
