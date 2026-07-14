import { describe, expect, it } from "vitest";

import { withObjectParticle } from "./korean-particles";

describe("withObjectParticle", () => {
  it("uses 을 after a Hangul final consonant", () => {
    expect(withObjectParticle("기술")).toBe("기술을");
  });

  it("uses 를 after a Hangul vowel or a Latin technology name", () => {
    expect(withObjectParticle("자바")).toBe("자바를");
    expect(withObjectParticle("Kubernetes")).toBe("Kubernetes를");
    expect(withObjectParticle("Docker")).toBe("Docker를");
  });
});
