import { describe, expect, it } from "vitest";

import {
  clearMigratedStorageValue,
  readMigratedStorageValue,
  writeMigratedStorageValue,
} from "./browser-storage-migration";

const keys = {
  current: "careerfit:example",
  legacy: ["ejik-fit:example"],
} as const;

const stringListCodec = {
  parse(raw: string) {
    try {
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value) && value.every((item) => typeof item === "string")
        ? value
        : null;
    } catch {
      return null;
    }
  },
  serialize(value: string[]) {
    return JSON.stringify(value);
  },
};

describe("browser storage brand migration", () => {
  it("copies valid legacy data to the CareerFit key without deleting the backup", () => {
    localStorage.setItem(keys.legacy[0], '["Python"]');

    expect(
      readMigratedStorageValue(localStorage, keys, stringListCodec),
    ).toEqual(["Python"]);
    expect(localStorage.getItem(keys.current)).toBe('["Python"]');
    expect(localStorage.getItem(keys.legacy[0])).toBe('["Python"]');
  });

  it("repairs an invalid current value from valid legacy data", () => {
    localStorage.setItem(keys.current, "{broken");
    localStorage.setItem(keys.legacy[0], '["Kubernetes"]');

    expect(
      readMigratedStorageValue(localStorage, keys, stringListCodec),
    ).toEqual(["Kubernetes"]);
    expect(localStorage.getItem(keys.current)).toBe('["Kubernetes"]');
  });

  it("returns legacy data when the new key cannot be written", () => {
    const values = new Map<string, string>([[keys.legacy[0], '["C++"]']]);
    const blockedStorage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem(key: string) {
        values.delete(key);
      },
    } as unknown as Storage;

    expect(
      readMigratedStorageValue(blockedStorage, keys, stringListCodec),
    ).toEqual(["C++"]);
    expect(values.get(keys.legacy[0])).toBe('["C++"]');
  });

  it("writes the new key first and keeps the legacy key compatible", () => {
    expect(
      writeMigratedStorageValue(localStorage, keys, ["Rust"], stringListCodec),
    ).toBe(true);
    expect(localStorage.getItem(keys.current)).toBe('["Rust"]');
    expect(localStorage.getItem(keys.legacy[0])).toBe('["Rust"]');
  });

  it("clears both key generations after an explicit user deletion", () => {
    localStorage.setItem(keys.current, '["Go"]');
    localStorage.setItem(keys.legacy[0], '["Go"]');

    clearMigratedStorageValue(localStorage, keys);

    expect(localStorage.getItem(keys.current)).toBeNull();
    expect(localStorage.getItem(keys.legacy[0])).toBeNull();
  });
});
