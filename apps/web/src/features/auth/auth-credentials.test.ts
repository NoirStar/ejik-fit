import { describe, expect, it } from "vitest";

import {
  normalizeCredentialAuthMode,
  validateEmail,
  validateNickname,
  validatePassword,
  validatePasswordUpdate,
  validateSignUp,
} from "./auth-credentials";

describe("credential auth validation", () => {
  it("accepts only supported URL modes", () => {
    expect(normalizeCredentialAuthMode("signup")).toBe("signup");
    expect(normalizeCredentialAuthMode("update-password")).toBe(
      "update-password",
    );
    expect(normalizeCredentialAuthMode("unknown")).toBe("signin");
    expect(normalizeCredentialAuthMode(["reset"])).toBe("signin");
  });

  it("rejects malformed or unreasonably long email addresses", () => {
    expect(validateEmail(" developer@example.com ")).toBe("");
    expect(validateEmail("")).toBe("이메일을 입력해 주세요.");
    expect(validateEmail("developer.example.com")).toBe(
      "올바른 이메일 주소를 입력해 주세요.",
    );
    expect(validateEmail(`a@${"b".repeat(253)}`)).toContain("254자");
  });

  it("enforces the password and nickname contract", () => {
    expect(validatePassword("career2026")).toBe("");
    expect(validatePassword("onlyletters")).toBe(
      "비밀번호에 숫자를 1개 이상 포함해 주세요.",
    );
    expect(validatePassword("1234567890")).toBe(
      "비밀번호에 영문자나 한글 등 문자를 1개 이상 포함해 주세요.",
    );
    expect(validatePassword("short1")).toBe(
      "비밀번호는 10자 이상 72자 이하로 입력해 주세요.",
    );
    expect(validatePassword(`a1${"x".repeat(71)}`)).toContain("72자");
    expect(validateNickname(" 커리어곰 ")).toEqual({
      value: "커리어곰",
      error: "",
    });
    expect(validateNickname("a").error).toContain("2자");
    expect(validateNickname("커리어\u200B곰").error).toContain("제어 문자");
  });

  it("returns field errors without leaking credentials", () => {
    expect(
      validateSignUp({
        email: "bad",
        password: "short",
        passwordConfirmation: "different",
        nickname: "x",
      }),
    ).toMatchObject({
      email: expect.any(String),
      password: expect.any(String),
      passwordConfirmation: expect.any(String),
      nickname: expect.any(String),
    });
    expect(validatePasswordUpdate("career2026", "career2026")).toEqual({});
    expect(validatePasswordUpdate("career2026", "career2027")).toEqual({
      passwordConfirmation: "비밀번호가 일치하지 않습니다.",
    });
    expect(validatePasswordUpdate("career2026", "")).toEqual({
      passwordConfirmation: "비밀번호를 한 번 더 입력해 주세요.",
    });
  });
});
