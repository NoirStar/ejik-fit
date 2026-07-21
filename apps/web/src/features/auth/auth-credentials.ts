export type CredentialAuthMode =
  | "signin"
  | "signup"
  | "reset"
  | "update-password";

export type SignUpFields = {
  email: string;
  password: string;
  passwordConfirmation: string;
  nickname: string;
};

export type SignUpErrors = Partial<Record<keyof SignUpFields, string>>;

const CREDENTIAL_AUTH_MODES = new Set<CredentialAuthMode>([
  "signin",
  "signup",
  "reset",
  "update-password",
]);

function characterCount(value: string) {
  return Array.from(value).length;
}

export function normalizeCredentialAuthMode(
  value: unknown,
): CredentialAuthMode {
  return typeof value === "string" &&
    CREDENTIAL_AUTH_MODES.has(value as CredentialAuthMode)
    ? (value as CredentialAuthMode)
    : "signin";
}

export function validateEmail(value: string) {
  const email = value.trim();
  if (!email) return "이메일을 입력해주세요.";
  if (email.length > 254) return "이메일은 254자 이하여야 합니다.";

  const parts = email.split("@");
  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1] ||
    /\s/u.test(parts[0]) ||
    /\s/u.test(parts[1])
  ) {
    return "올바른 이메일 주소를 입력해주세요.";
  }
  return "";
}

export function validatePassword(value: string) {
  const length = characterCount(value);
  if (length < 10 || length > 72) {
    return "비밀번호는 10자 이상 72자 이하로 입력해주세요.";
  }
  if (!/\p{L}/u.test(value)) {
    return "비밀번호에 영문자나 한글 등 문자를 1개 이상 포함해주세요.";
  }
  if (!/\d/u.test(value)) {
    return "비밀번호에 숫자를 1개 이상 포함해주세요.";
  }
  return "";
}

export function validateNickname(value: string) {
  const nickname = value.trim();
  if (/[\p{Cc}\p{Cf}]/u.test(nickname)) {
    return {
      value: nickname,
      error: "닉네임에는 제어 문자를 사용할 수 없습니다.",
    };
  }
  const length = characterCount(nickname);
  if (length < 2 || length > 20) {
    return {
      value: nickname,
      error: "닉네임은 2자 이상 20자 이하로 입력해주세요.",
    };
  }
  return { value: nickname, error: "" };
}

export function validateSignUp(fields: SignUpFields): SignUpErrors {
  const errors: SignUpErrors = {};
  const emailError = validateEmail(fields.email);
  const passwordError = validatePassword(fields.password);
  const nicknameError = validateNickname(fields.nickname).error;

  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  if (!fields.passwordConfirmation) {
    errors.passwordConfirmation = "비밀번호를 한 번 더 입력해주세요.";
  } else if (fields.passwordConfirmation !== fields.password) {
    errors.passwordConfirmation = "비밀번호가 일치하지 않습니다.";
  }
  if (nicknameError) errors.nickname = nicknameError;

  return errors;
}

export function validatePasswordUpdate(
  password: string,
  passwordConfirmation: string,
): Partial<Record<"password" | "passwordConfirmation", string>> {
  const errors: Partial<
    Record<"password" | "passwordConfirmation", string>
  > = {};
  const passwordError = validatePassword(password);

  if (passwordError) errors.password = passwordError;
  if (!passwordConfirmation) {
    errors.passwordConfirmation = "비밀번호를 한 번 더 입력해주세요.";
  } else if (passwordConfirmation !== password) {
    errors.passwordConfirmation = "비밀번호가 일치하지 않습니다.";
  }
  return errors;
}
