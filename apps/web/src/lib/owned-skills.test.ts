import { describe, expect, it } from "vitest";

import {
  addOwnedSkill,
  ownedSkillsFromSearchParams,
  readOwnedSkills,
  removeOwnedSkill,
  writeOwnedSkills,
} from "./owned-skills";


function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  } satisfies Storage;
}


describe("owned skill storage", () => {
  it("dedupes, trims and sorts skills", () => {
    const fake = storage();
    const saved = writeOwnedSkills([" Python ", "C++", "Python", ""], fake);

    expect(saved).toEqual(["C++", "Python"]);
    expect(readOwnedSkills(fake)).toEqual(["C++", "Python"]);
  });

  it("ignores invalid stored json", () => {
    const fake = storage();
    fake.setItem("ejik-fit:owned-skills", "{broken");

    expect(readOwnedSkills(fake)).toEqual([]);
  });

  it("adds and removes a skill", () => {
    const fake = storage();

    expect(addOwnedSkill("ROS", fake)).toEqual(["ROS"]);
    expect(addOwnedSkill("C++", fake)).toEqual(["C++", "ROS"]);
    expect(removeOwnedSkill("ROS", fake)).toEqual(["C++"]);
  });

  it("normalizes owned skills from repeated URL search params", () => {
    expect(
      ownedSkillsFromSearchParams({
        owned_skills: [" Spring ", "Java", "Spring", ""],
      }),
    ).toEqual(["Java", "Spring"]);
  });

  it("normalizes owned skills from comma separated URL search params", () => {
    expect(
      ownedSkillsFromSearchParams({
        owned_skills: "Java, Spring,AWS",
      }),
    ).toEqual(["AWS", "Java", "Spring"]);
  });
});
