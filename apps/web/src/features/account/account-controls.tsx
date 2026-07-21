"use client";

import {
  BellRinging,
  DownloadSimple,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import { clearBrowserAccountState } from "@/lib/account-state";

import {
  createAccountDataArchive,
  deleteCurrentAccount,
  downloadAccountDataArchive,
  loadNotificationPreference,
  saveNotificationPreference,
} from "./account-actions";
import styles from "./account-overview.module.css";

type AccountControlsProps = {
  viewer: AuthViewer;
};

export function AccountControls({ viewer }: AccountControlsProps) {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [preferenceSupported, setPreferenceSupported] = useState(true);
  const [savingPreference, setSavingPreference] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setPreferenceReady(false);
    setMessage("");
    void loadNotificationPreference(viewer.id)
      .then((preference) => {
        if (!active) return;
        setNotificationsEnabled(preference.enabled);
        setPreferenceSupported(preference.supported);
        setPreferenceReady(true);
      })
      .catch(() => {
        if (!active) return;
        setPreferenceReady(true);
        setPreferenceSupported(false);
        setMessage("알림 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      });
    return () => {
      active = false;
    };
  }, [viewer.id]);

  async function toggleNotifications() {
    if (
      !preferenceReady ||
      !preferenceSupported ||
      savingPreference
    ) {
      return;
    }
    const nextEnabled = !notificationsEnabled;
    setSavingPreference(true);
    setMessage("");
    try {
      await saveNotificationPreference(viewer.id, nextEnabled);
      setNotificationsEnabled(nextEnabled);
    } catch {
      setMessage("알림 설정을 저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setSavingPreference(false);
    }
  }

  async function exportData() {
    setExporting(true);
    setMessage("");
    try {
      const archive = await createAccountDataArchive(viewer);
      downloadAccountDataArchive(archive);
      setMessage("내 데이터 파일을 만들었습니다.");
    } catch {
      setMessage("내 데이터를 내보내지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "탈퇴" || deleting) return;
    setDeleting(true);
    setMessage("");
    try {
      await deleteCurrentAccount();
      clearBrowserAccountState();
      router.replace("/");
      router.refresh();
    } catch {
      setDeleting(false);
      setMessage("계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <section
      aria-labelledby="account-controls-title"
      className={styles.controlsSection}
    >
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="account-controls-title">알림 및 계정 관리</h2>
          <p>새 공고 알림과 계정에 저장된 데이터 범위를 직접 관리합니다.</p>
        </div>
      </div>

      <div className={styles.controlRows}>
        <div className={styles.controlRow}>
          <span className={styles.controlIcon}>
            <BellRinging aria-hidden="true" size={20} />
          </span>
          <span className={styles.controlCopy}>
            <strong>새 공고 알림</strong>
            <small>
              저장 검색과 관심 기업에 맞는 새 공고를 알림 센터에서 받습니다.
            </small>
          </span>
          <button
            aria-checked={notificationsEnabled}
            aria-label="새 공고 알림"
            className={styles.switch}
            disabled={
              !preferenceReady ||
              !preferenceSupported ||
              savingPreference
            }
            onClick={() => void toggleNotifications()}
            role="switch"
            type="button"
          >
            <span />
          </button>
          <span className={styles.controlStatus}>
            {!preferenceReady
              ? "확인 중"
              : !preferenceSupported
                ? "설정 준비 중"
                : savingPreference
                  ? "저장 중"
                  : notificationsEnabled
                    ? "받는 중"
                    : "꺼짐"}
          </span>
        </div>

        <div className={styles.controlRow}>
          <span className={styles.controlIcon}>
            <DownloadSimple aria-hidden="true" size={20} />
          </span>
          <span className={styles.controlCopy}>
            <strong>내 데이터 내보내기</strong>
            <small>
              프로필, 기술, 저장 공고, 지원 기록, 저장 검색과 알림을 JSON 파일로
              받습니다.
            </small>
          </span>
          <button
            className={styles.secondaryAction}
            disabled={exporting}
            onClick={() => void exportData()}
            type="button"
          >
            {exporting ? "준비 중" : "내보내기"}
          </button>
        </div>

        <div className={styles.controlRow}>
          <span className={`${styles.controlIcon} ${styles.dangerIcon}`}>
            <Trash aria-hidden="true" size={20} />
          </span>
          <span className={styles.controlCopy}>
            <strong>계정 삭제</strong>
            <small>
              계정과 서버에 저장된 커리어 데이터는 복구할 수 없게 삭제됩니다.
            </small>
          </span>
          <button
            className={styles.dangerAction}
            onClick={() => {
              setConfirmingDeletion(true);
              setDeleteConfirmation("");
              setMessage("");
            }}
            type="button"
          >
            계정 삭제
          </button>
        </div>
      </div>

      {confirmingDeletion && (
        <div className={styles.deleteConfirmation}>
          <div>
            <strong>계정을 정말 삭제할까요?</strong>
            <p>
              계속하려면 아래 입력란에 <b>탈퇴</b>를 입력해주세요.
            </p>
          </div>
          <button
            aria-label="계정 삭제 닫기"
            className={styles.closeConfirmation}
            disabled={deleting}
            onClick={() => setConfirmingDeletion(false)}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
          <label>
            <span>확인 문구</span>
            <input
              autoComplete="off"
              disabled={deleting}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="탈퇴 입력"
              value={deleteConfirmation}
            />
          </label>
          <button
            className={styles.confirmDelete}
            disabled={deleteConfirmation !== "탈퇴" || deleting}
            onClick={() => void deleteAccount()}
            type="button"
          >
            {deleting ? "삭제 중" : "영구 삭제"}
          </button>
        </div>
      )}

      {message && (
        <p className={styles.controlMessage} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
