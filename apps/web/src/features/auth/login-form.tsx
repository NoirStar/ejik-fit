"use client";

import { EnvelopeSimple, PaperPlaneTilt } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";

import { safeAuthNextPath } from "@/lib/auth/redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import styles from "./login-form.module.css";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("로그인 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      setPending(false);
      return;
    }

    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", safeAuthNextPath(nextPath));
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: true,
      },
    });

    setPending(false);
    if (authError) {
      setError("로그인 링크를 보내지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.sentState}>
        <EnvelopeSimple aria-hidden="true" size={26} weight="duotone" />
        <div>
          <strong>이메일에서 로그인 링크를 확인해주세요.</strong>
          <p>{email.trim()} 주소로 일회용 링크를 보냈습니다.</p>
        </div>
        <button
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          type="button"
        >
          다른 이메일 사용
        </button>
        <span className="sr-only" role="status">
          이메일에서 로그인 링크를 확인해주세요.
        </span>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="login-email">이메일</label>
        <div className={styles.inputWrap}>
          <EnvelopeSimple aria-hidden="true" size={19} />
          <input
            autoComplete="email"
            id="login-email"
            maxLength={254}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            type="email"
            value={email}
          />
        </div>
      </div>
      <button className={styles.submit} disabled={pending} type="submit">
        <PaperPlaneTilt aria-hidden="true" size={18} weight="bold" />
        {pending ? "보내는 중" : "로그인 링크 받기"}
      </button>
      <p className={styles.helper}>
        비밀번호 없이 일회용 이메일 링크로 로그인합니다.
      </p>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  );
}
