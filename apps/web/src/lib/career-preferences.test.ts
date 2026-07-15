import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_CAREER_PREFERENCES,
  clearCareerPreferences,
  normalizeCareerPreferences,
  readCareerPreferences,
  subscribeCareerPreferences,
  writeCareerPreferences,
} from "./career-preferences";

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

describe("career preference storage", () => {
  afterEach(() => window.localStorage.clear());

  it("normalizes supported conditions and safe domain ids", () => {
    expect(
      normalizeCareerPreferences({
        careerCondition: "experienced",
        targetDomain: " backend ",
      }),
    ).toEqual({
      careerCondition: "experienced",
      targetDomain: "backend",
    });
    expect(
      normalizeCareerPreferences({
        careerCondition: "unknown",
        targetDomain: "백엔드<script>",
      }),
    ).toEqual(EMPTY_CAREER_PREFERENCES);
    expect(
      normalizeCareerPreferences({
        careerCondition: "new_comer",
        targetDomain: "x".repeat(81),
      }),
    ).toEqual({ careerCondition: "new_comer", targetDomain: "" });
  });

  it("persists and reads a normalized preference", () => {
    const fake = storage();

    expect(
      writeCareerPreferences(
        { careerCondition: "mixed", targetDomain: "computer_vision" },
        fake,
      ),
    ).toEqual({
      careerCondition: "mixed",
      targetDomain: "computer_vision",
    });
    expect(readCareerPreferences(fake)).toEqual({
      careerCondition: "mixed",
      targetDomain: "computer_vision",
    });
  });

  it("recovers from malformed and blocked browser storage", () => {
    const malformed = storage();
    malformed.setItem("ejik-fit:career-preferences", "{broken");
    const blocked = {
      ...storage(),
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;

    expect(readCareerPreferences(malformed)).toEqual(
      EMPTY_CAREER_PREFERENCES,
    );
    expect(readCareerPreferences(blocked)).toEqual(EMPTY_CAREER_PREFERENCES);
    expect(
      writeCareerPreferences(
        { careerCondition: "experienced", targetDomain: "backend" },
        blocked,
      ),
    ).toEqual(EMPTY_CAREER_PREFERENCES);
  });

  it("notifies same-tab subscribers and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCareerPreferences(listener);

    writeCareerPreferences({
      careerCondition: "experienced",
      targetDomain: "backend",
    });
    expect(listener).toHaveBeenCalledWith({
      careerCondition: "experienced",
      targetDomain: "backend",
    });

    unsubscribe();
    writeCareerPreferences(EMPTY_CAREER_PREFERENCES);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("notifies only for matching changes from another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCareerPreferences(listener);
    localStorage.setItem(
      "ejik-fit:career-preferences",
      JSON.stringify({
        careerCondition: "new_comer",
        targetDomain: "frontend",
      }),
    );

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ejik-fit:career-preferences",
        storageArea: localStorage,
      }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "another-key" }));

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      careerCondition: "new_comer",
      targetDomain: "frontend",
    });
    unsubscribe();
  });

  it("clears the storage key and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCareerPreferences(listener);
    writeCareerPreferences({
      careerCondition: "experienced",
      targetDomain: "backend",
    });

    expect(clearCareerPreferences()).toEqual(EMPTY_CAREER_PREFERENCES);
    expect(localStorage.getItem("ejik-fit:career-preferences")).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(EMPTY_CAREER_PREFERENCES);
    unsubscribe();
  });
});
