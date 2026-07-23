"use client";

import { EnvelopeSimple, FloppyDisk, UserCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { validateNickname } from "@/features/auth/auth-credentials";
import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import styles from "./account-overview.module.css";
import { createSupabaseUserProfileStore } from "./user-profile-store";

type ProfileEditorProps = {
  viewer: AuthViewer;
};

type LoadState = "loading" | "ready" | "error";

export function ProfileEditor({ viewer }: ProfileEditorProps) {
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saveError) nicknameInputRef.current?.focus();
  }, [saveError]);

  const loadProfile = useCallback(async () => {
    const client = createBrowserSupabaseClient();
    if (!client) throw new Error("Profile client is unavailable.");
    return createSupabaseUserProfileStore(client).load(viewer.id);
  }, [viewer.id]);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setFieldError("");
    setSaveError("");
    setStatus("");

    void loadProfile()
      .then((profile) => {
        if (!active) return;
        const value = profile.nickname ?? "";
        setNickname(value);
        setSavedNickname(value);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, loadProfile]);

  async function saveNickname() {
    const validated = validateNickname(nickname);
    setFieldError(validated.error);
    setSaveError("");
    setStatus("");
    if (validated.error) return;

    const client = createBrowserSupabaseClient();
    if (!client) {
      setSaveError(
        "닉네임을 저장하지 못했습니다. 입력한 내용은 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }

    setSaving(true);
    try {
      await createSupabaseUserProfileStore(client).updateNickname(
        viewer.id,
        validated.value,
      );
      setNickname(validated.value);
      setSavedNickname(validated.value);
      setStatus("닉네임을 저장했습니다.");
    } catch {
      setSaveError(
        "닉네임을 저장하지 못했습니다. 입력한 내용은 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="profile-editor-title" className={styles.profileSection}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="profile-editor-title">내 프로필</h2>
          <p>이메일은 비공개이며, 닉네임만 커뮤니티에 공개됩니다.</p>
        </div>
        <span className={styles.verifiedBadge}>이메일 확인됨</span>
      </div>

      <div className={styles.profileForm}>
        <div className={styles.profileField}>
          <label htmlFor="profile-email">계정 이메일</label>
          <span className={styles.profileInput} data-read-only="true">
            <EnvelopeSimple aria-hidden="true" size={18} />
            <input
              aria-describedby="profile-email-helper"
              id="profile-email"
              readOnly
              type="email"
              value={viewer.email}
            />
          </span>
          <small id="profile-email-helper">로그인에 사용하는 확인된 이메일입니다.</small>
        </div>

        <div className={styles.profileField}>
          <label htmlFor="profile-nickname">닉네임</label>
          <span
            className={styles.profileInput}
            data-invalid={fieldError ? "true" : undefined}
          >
            <UserCircle aria-hidden="true" size={18} />
            <input
              aria-describedby={
                fieldError
                  ? "profile-nickname-helper profile-nickname-error"
                  : "profile-nickname-helper"
              }
              aria-invalid={Boolean(fieldError)}
              autoComplete="nickname"
              disabled={loadState !== "ready" || saving}
              id="profile-nickname"
              maxLength={20}
              onChange={(event) => {
                setNickname(event.target.value);
                setFieldError("");
                setSaveError("");
                setStatus("");
              }}
              placeholder={loadState === "loading" ? "불러오는 중…" : "2-20자 닉네임"}
              ref={nicknameInputRef}
              type="text"
              value={nickname}
            />
          </span>
          <small id="profile-nickname-helper">
            공개 커뮤니티에 표시되는 2-20자 이름입니다.
          </small>
        </div>

        <button
          className={styles.profileSave}
          disabled={
            loadState !== "ready" ||
            saving ||
            nickname.trim() === savedNickname
          }
          onClick={() => void saveNickname()}
          type="button"
        >
          <FloppyDisk aria-hidden="true" size={17} />
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>

      {loadState === "error" && (
        <div className={styles.profileError} role="alert">
          <span>프로필 설정을 아직 불러오지 못했습니다.</span>
          <button onClick={() => setLoadAttempt((attempt) => attempt + 1)} type="button">
            다시 시도
          </button>
        </div>
      )}
      {fieldError && (
        <p className={styles.profileFieldError} id="profile-nickname-error" role="alert">
          {fieldError}
        </p>
      )}
      {saveError && (
        <p className={styles.profileFieldError} role="alert">
          {saveError}
        </p>
      )}
      <p aria-live="polite" className={styles.profileStatus} role="status">
        {status}
      </p>
    </section>
  );
}
