import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addOwnedSkill,
  clearOwnedSkills,
  ownedSkillsFromSearchParams,
  readOwnedSkills,
  removeOwnedSkill,
  subscribeOwnedSkills,
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
  afterEach(() => {
    window.localStorage.clear();
  });

  it("dedupes, trims and sorts skills", () => {
    const fake = storage();
    const saved = writeOwnedSkills([" Python ", "C++", "Python", ""], fake);

    expect(saved).toEqual(["C++", "Python"]);
    expect(readOwnedSkills(fake)).toEqual(["C++", "Python"]);
  });

  it("dedupes case and common aliases with one shared identity", () => {
    const fake = storage();

    expect(
      writeOwnedSkills(
        ["python", "Python", "k8s", "Kubernetes", "쿠버네티스"],
        fake,
      ),
    ).toEqual(["k8s", "python"]);
    expect(removeOwnedSkill("Kubernetes", fake)).toEqual(["python"]);
  });

  it("keeps persisted skills within the personalization limit", () => {
    const fake = storage();
    const saved = writeOwnedSkills(
      Array.from({ length: 24 }, (_, index) => `skill-${index}`),
      fake,
    );

    expect(saved).toHaveLength(20);
    expect(readOwnedSkills(fake)).toHaveLength(20);
  });

  it("does not evict an existing skill when a full list receives another", () => {
    const fake = storage();
    const existing = Array.from(
      { length: 20 },
      (_, index) => `skill-${index.toString().padStart(2, "0")}`,
    );
    writeOwnedSkills(existing, fake);

    expect(addOwnedSkill("AAA", fake)).toEqual(existing);
    expect(readOwnedSkills(fake)).toEqual(existing);
  });

  it("drops an invalid overlong value from persisted state", () => {
    const fake = storage();

    expect(writeOwnedSkills(["C++", "x".repeat(101)], fake)).toEqual(["C++"]);
  });

  it("ignores invalid stored json", () => {
    const fake = storage();
    fake.setItem("ejik-fit:owned-skills", "{broken");

    expect(readOwnedSkills(fake)).toEqual([]);
  });

  it("stays usable when browser storage access is blocked", () => {
    const blocked = {
      ...storage(),
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;

    expect(readOwnedSkills(blocked)).toEqual([]);
    expect(writeOwnedSkills([" Python "], blocked)).toEqual(["Python"]);
    expect(clearOwnedSkills(blocked)).toEqual([]);
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

  it("notifies same-tab subscribers after writing and clearing browser storage", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOwnedSkills(listener);

    writeOwnedSkills([" Python ", "React", "Python"]);
    clearOwnedSkills();

    expect(listener).toHaveBeenNthCalledWith(1, ["Python", "React"]);
    expect(listener).toHaveBeenNthCalledWith(2, []);

    unsubscribe();
    writeOwnedSkills(["TypeScript"]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies subscribers when another tab changes owned skills", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOwnedSkills(listener);
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify([" Spring ", "Java", "Spring"]),
    );

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ejik-fit:owned-skills",
        newValue: window.localStorage.getItem("ejik-fit:owned-skills"),
        storageArea: window.localStorage,
      }),
    );

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(["Java", "Spring"]);
    unsubscribe();
  });

  it("ignores unrelated storage changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOwnedSkills(listener);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "another-key",
        newValue: "value",
      }),
    );

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
