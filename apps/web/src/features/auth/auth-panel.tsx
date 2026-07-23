"use client";

import {
  ArrowRight,
  CheckCircle,
  EnvelopeSimple,
  LockKey,
  PaperPlaneTilt,
  UserCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { safeAuthNextPath } from "@/lib/auth/redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import {
  type CredentialAuthMode,
  validateEmail,
  validateNickname,
  validatePassword,
  validatePasswordUpdate,
  validateSignUp,
} from "./auth-credentials";
import styles from "./auth-panel.module.css";

type AuthPanelProps = {
  initialMode: CredentialAuthMode;
  nextPath: string;
};

type FieldName =
  | "email"
  | "password"
  | "passwordConfirmation"
  | "nickname";
type FieldErrors = Partial<Record<FieldName, string>>;
type RecoveryStatus = "idle" | "checking" | "ready" | "missing";

type AuthFieldProps = {
  error?: string;
  helper?: string;
  icon: ReactNode;
  id: string;
  input: Omit<ComponentProps<"input">, "id">;
  label: string;
};

function AuthField({ error, helper, icon, id, input, label }: AuthFieldProps) {
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        {icon}
        <input
          {...input}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          id={id}
        />
      </div>
      {helper && (
        <p className={styles.helper} id={helperId}>
          {helper}
        </p>
      )}
      {error && (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

function modeHref(mode: CredentialAuthMode, nextPath: string) {
  const params = new URLSearchParams({
    mode,
    next: safeAuthNextPath(nextPath),
  });
  return `/login?${params.toString()}`;
}

function callbackUrl(nextPath: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", safeAuthNextPath(nextPath));
  return callback.toString();
}

function passwordResetCallbackUrl(nextPath: string) {
  const updatePassword = new URL("/login", window.location.origin);
  updatePassword.searchParams.set("mode", "update-password");
  updatePassword.searchParams.set("next", safeAuthNextPath(nextPath));

  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set(
    "next",
    `${updatePassword.pathname}${updatePassword.search}`,
  );
  return callback.toString();
}

function FormHeader({ children, title }: { children: ReactNode; title: string }) {
  return (
    <header className={styles.formHeader}>
      <h2>{title}</h2>
      <p>{children}</p>
    </header>
  );
}

export function AuthPanel({ initialMode, nextPath }: AuthPanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [nickname, setNickname] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [resetSentEmail, setResetSentEmail] = useState("");
  const [recoveryStatus, setRecoveryStatus] =
    useState<RecoveryStatus>("idle");

  useEffect(() => {
    if (initialMode !== "update-password") {
      setRecoveryStatus("idle");
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setRecoveryStatus("missing");
      return;
    }

    let active = true;
    setRecoveryStatus("checking");
    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        setRecoveryStatus(!error && data.user ? "ready" : "missing");
      })
      .catch(() => {
        if (active) setRecoveryStatus("missing");
      });

    return () => {
      active = false;
    };
  }, [initialMode]);

  function clearFeedback() {
    setFieldErrors({});
    setFormError("");
  }

  function finishAuthentication() {
    router.replace(safeAuthNextPath(nextPath));
    router.refresh();
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    const errors: FieldErrors = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setFormError(
        "로그인을 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setFormError("이메일 또는 비밀번호를 확인해 주세요.");
        return;
      }
      finishAuthentication();
    } catch {
      setFormError("로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    const errors = validateSignUp({
      email,
      nickname,
      password,
      passwordConfirmation,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setFormError(
        "회원가입을 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
      return;
    }

    setPending(true);
    try {
      const normalizedNickname = validateNickname(nickname).value;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { nickname: normalizedNickname },
          emailRedirectTo: callbackUrl(nextPath),
        },
      });
      if (error) {
        setFormError("회원가입하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      if (data.session) {
        finishAuthentication();
        return;
      }
      setVerificationEmail(email.trim());
      setVerificationMessage("확인 메일을 보냈습니다.");
    } catch {
      setFormError("회원가입하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function resendVerification(targetEmail = verificationEmail || email.trim()) {
    clearFeedback();
    const emailError = validateEmail(targetEmail);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setFormError(
        "메일 전송을 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: callbackUrl(nextPath) },
      });
      if (error) {
        setFormError("확인 메일을 다시 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setVerificationEmail(targetEmail);
      setVerificationMessage("확인 메일을 다시 보냈습니다.");
    } catch {
      setFormError("확인 메일을 다시 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    const emailError = validateEmail(email);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setFormError(
        "메일 전송을 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: passwordResetCallbackUrl(nextPath),
      });
      if (error) {
        setFormError("재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setResetSentEmail(email.trim());
    } catch {
      setFormError("재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    const errors = validatePasswordUpdate(password, passwordConfirmation);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase || recoveryStatus !== "ready") {
      setRecoveryStatus("missing");
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError("새 비밀번호를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      finishAuthentication();
    } catch {
      setFormError("새 비밀번호를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  const navigation = (
    <nav aria-label="계정 접근 방식" className={styles.modeTabs}>
      <Link
        aria-current={initialMode === "signin" ? "page" : undefined}
        data-active={initialMode === "signin" ? "true" : undefined}
        href={modeHref("signin", nextPath)}
      >
        로그인
      </Link>
      <Link
        aria-current={initialMode === "signup" ? "page" : undefined}
        data-active={initialMode === "signup" ? "true" : undefined}
        href={modeHref("signup", nextPath)}
      >
        회원가입
      </Link>
    </nav>
  );

  if (verificationEmail) {
    return (
      <div className={styles.root}>
        {navigation}
        <section className={styles.sentState} role="status">
          <CheckCircle aria-hidden="true" size={28} weight="fill" />
          <div>
            <h2>{verificationMessage}</h2>
            <p>
              <strong>{verificationEmail}</strong>의 메일함에서 가입을 확인해 주세요.
            </p>
          </div>
        </section>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <div className={styles.sentActions}>
          <button
            disabled={pending}
            onClick={() => void resendVerification()}
            type="button"
          >
            {pending ? "다시 보내는 중" : "확인 메일 다시 보내기"}
          </button>
          <button
            onClick={() => {
              setVerificationEmail("");
              setVerificationMessage("");
              setEmail("");
              setPassword("");
              setPasswordConfirmation("");
            }}
            type="button"
          >
            다른 이메일 사용
          </button>
        </div>
      </div>
    );
  }

  if (initialMode === "reset" && resetSentEmail) {
    return (
      <div className={styles.root}>
        {navigation}
        <section className={styles.sentState} role="status">
          <EnvelopeSimple aria-hidden="true" size={28} weight="duotone" />
          <div>
            <h2>비밀번호 재설정 요청을 완료했습니다.</h2>
            <p>
              <strong>{resetSentEmail}</strong>의 메일함을 확인해 주세요.
            </p>
          </div>
        </section>
        <Link className={styles.fullLink} href={modeHref("signin", nextPath)}>
          로그인으로 돌아가기
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    );
  }

  if (initialMode === "update-password") {
    if (recoveryStatus === "checking" || recoveryStatus === "idle") {
      return (
        <div className={styles.root}>
          {navigation}
          <p className={styles.checkingState} role="status">
            재설정 링크를 확인하고 있습니다.
          </p>
        </div>
      );
    }
    if (recoveryStatus === "missing") {
      return (
        <div className={styles.root}>
          {navigation}
          <section className={styles.missingState} role="alert">
            <LockKey aria-hidden="true" size={25} />
            <div>
              <h2>이 링크는 만료되었거나 사용할 수 없습니다.</h2>
            </div>
          </section>
          <Link className={styles.fullLink} href={modeHref("reset", nextPath)}>
            재설정 메일 다시 받기
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      );
    }

    return (
      <div className={styles.root}>
        {navigation}
        <form className={styles.form} noValidate onSubmit={handlePasswordUpdate}>
          <FormHeader title="새 비밀번호 설정">
            앞으로 사용할 비밀번호를 입력해 주세요.
          </FormHeader>
          <AuthField
            error={fieldErrors.password}
            helper="10-72자, 문자와 숫자를 각각 1개 이상 포함"
            icon={<LockKey aria-hidden="true" size={19} />}
            id="auth-new-password"
            input={{
              autoComplete: "new-password",
              maxLength: 72,
              onChange: (event) => setPassword(event.target.value),
              required: true,
              type: "password",
              value: password,
            }}
            label="새 비밀번호"
          />
          <AuthField
            error={fieldErrors.passwordConfirmation}
            icon={<LockKey aria-hidden="true" size={19} />}
            id="auth-new-password-confirmation"
            input={{
              autoComplete: "new-password",
              maxLength: 72,
              onChange: (event) => setPasswordConfirmation(event.target.value),
              required: true,
              type: "password",
              value: passwordConfirmation,
            }}
            label="새 비밀번호 확인"
          />
          <button className={styles.primaryButton} disabled={pending} type="submit">
            <LockKey aria-hidden="true" size={18} weight="bold" />
            {pending ? "저장하는 중" : "새 비밀번호 저장"}
          </button>
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
        </form>
      </div>
    );
  }

  if (initialMode === "reset") {
    return (
      <div className={styles.root}>
        {navigation}
        <form className={styles.form} noValidate onSubmit={handleResetRequest}>
          <FormHeader title="비밀번호 재설정">
            가입한 이메일로 새 비밀번호 설정 링크를 보내드립니다.
          </FormHeader>
          <AuthField
            error={fieldErrors.email}
            icon={<EnvelopeSimple aria-hidden="true" size={19} />}
            id="auth-reset-email"
            input={{
              autoComplete: "email",
              maxLength: 254,
              onChange: (event) => setEmail(event.target.value),
              placeholder: "name@example.com",
              required: true,
              type: "email",
              value: email,
            }}
            label="이메일"
          />
          <button className={styles.primaryButton} disabled={pending} type="submit">
            <PaperPlaneTilt aria-hidden="true" size={18} weight="bold" />
            {pending ? "보내는 중" : "재설정 메일 보내기"}
          </button>
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
        </form>
      </div>
    );
  }

  if (initialMode === "signup") {
    return (
      <div className={styles.root}>
        {navigation}
        <form className={styles.form} noValidate onSubmit={handleSignUp}>
          <FormHeader title="이직핏 계정 만들기">
            가입하려면 이메일 확인이 필요합니다.
          </FormHeader>
          <AuthField
            error={fieldErrors.email}
            icon={<EnvelopeSimple aria-hidden="true" size={19} />}
            id="auth-signup-email"
            input={{
              autoComplete: "email",
              maxLength: 254,
              onChange: (event) => setEmail(event.target.value),
              placeholder: "name@example.com",
              required: true,
              type: "email",
              value: email,
            }}
            label="이메일"
          />
          <AuthField
            error={fieldErrors.password}
            helper="10-72자, 문자와 숫자를 각각 1개 이상 포함"
            icon={<LockKey aria-hidden="true" size={19} />}
            id="auth-signup-password"
            input={{
              autoComplete: "new-password",
              maxLength: 72,
              onChange: (event) => setPassword(event.target.value),
              required: true,
              type: "password",
              value: password,
            }}
            label="비밀번호"
          />
          <AuthField
            error={fieldErrors.passwordConfirmation}
            icon={<LockKey aria-hidden="true" size={19} />}
            id="auth-signup-password-confirmation"
            input={{
              autoComplete: "new-password",
              maxLength: 72,
              onChange: (event) => setPasswordConfirmation(event.target.value),
              required: true,
              type: "password",
              value: passwordConfirmation,
            }}
            label="비밀번호 확인"
          />
          <AuthField
            error={fieldErrors.nickname}
            helper="공개 커뮤니티에 표시할 2-20자 이름"
            icon={<UserCircle aria-hidden="true" size={19} />}
            id="auth-signup-nickname"
            input={{
              autoComplete: "nickname",
              maxLength: 20,
              onChange: (event) => setNickname(event.target.value),
              placeholder: "예: 커리어곰",
              required: true,
              type: "text",
              value: nickname,
            }}
            label="닉네임"
          />
          <button className={styles.primaryButton} disabled={pending} type="submit">
            <ArrowRight aria-hidden="true" size={18} weight="bold" />
            {pending ? "가입하는 중" : "회원가입"}
          </button>
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {navigation}
      <form className={styles.form} noValidate onSubmit={handleSignIn}>
        <AuthField
          error={fieldErrors.email}
          icon={<EnvelopeSimple aria-hidden="true" size={19} />}
          id="auth-signin-email"
          input={{
            autoComplete: "email",
            maxLength: 254,
            onChange: (event) => setEmail(event.target.value),
            placeholder: "name@example.com",
            required: true,
            type: "email",
            value: email,
          }}
          label="이메일"
        />
        <AuthField
          error={fieldErrors.password}
          icon={<LockKey aria-hidden="true" size={19} />}
          id="auth-signin-password"
          input={{
            autoComplete: "current-password",
            maxLength: 72,
            onChange: (event) => setPassword(event.target.value),
            required: true,
            type: "password",
            value: password,
          }}
          label="비밀번호"
        />
        <button className={styles.primaryButton} disabled={pending} type="submit">
          <ArrowRight aria-hidden="true" size={18} weight="bold" />
          {pending ? "로그인 중" : "로그인"}
        </button>
        <div className={styles.formLinks}>
          <Link href={modeHref("reset", nextPath)}>비밀번호를 잊으셨나요?</Link>
          <button
            disabled={pending}
            onClick={() => void resendVerification()}
            type="button"
          >
            확인 메일 다시 받기
          </button>
        </div>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
      </form>
    </div>
  );
}
