"use client";

import { FloppyDisk, X } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useState } from "react";

import styles from "@/app/posts/[id]/post-detail.module.css";
import {
  COMMUNITY_CATEGORIES,
  MAX_COMMUNITY_POST_BODY_LENGTH,
  MAX_COMMUNITY_POST_TAGS,
  MAX_COMMUNITY_POST_TITLE_LENGTH,
  MAX_COMMUNITY_TAG_LENGTH,
  normalizeCommunityTags,
  normalizeCommunityText,
  type CommunityCategory,
  type CommunityPost,
} from "@/lib/community-contract";

import {
  COMMUNITY_FAILURE_COPY,
  type CommunityStore,
} from "./community-store";

type PostEditorStore = Pick<CommunityStore, "updatePost">;

type ServerPostEditorProps = {
  onCancel(): void;
  onSaved(post: CommunityPost): void;
  post: CommunityPost;
  store: PostEditorStore;
  viewerId: string | null;
};

type EditorErrors = Partial<
  Record<"body" | "storage" | "tags" | "title", string>
>;

function tagCandidates(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function ServerPostEditor({
  onCancel,
  onSaved,
  post,
  store,
  viewerId,
}: ServerPostEditorProps) {
  const [category, setCategory] = useState<CommunityCategory>(post.category);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [tags, setTags] = useState(post.tags.join(", "));
  const [errors, setErrors] = useState<EditorErrors>({});
  const [saving, setSaving] = useState(false);
  const authorId = viewerId;

  if (!authorId || authorId !== post.author.id) return null;

  function clearError(field: keyof EditorErrors) {
    setErrors((current) => {
      if (!current[field] && !current.storage) return current;
      const next = { ...current };
      delete next[field];
      delete next.storage;
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !authorId || authorId !== post.author.id) return;

    const normalizedTitle = normalizeCommunityText(
      title,
      MAX_COMMUNITY_POST_TITLE_LENGTH,
    );
    const normalizedBody = normalizeCommunityText(
      body,
      MAX_COMMUNITY_POST_BODY_LENGTH,
    );
    const normalizedTags = normalizeCommunityTags(tagCandidates(tags));
    const nextErrors: EditorErrors = {};

    if (!normalizedTitle) {
      nextErrors.title = title.trim()
        ? `제목은 ${MAX_COMMUNITY_POST_TITLE_LENGTH}자까지 입력할 수 있습니다.`
        : "제목을 입력해 주세요.";
    }
    if (!normalizedBody) {
      nextErrors.body = body.trim()
        ? `본문은 ${MAX_COMMUNITY_POST_BODY_LENGTH}자까지 입력할 수 있습니다.`
        : "내용을 입력해 주세요.";
    }
    if (!normalizedTags) {
      nextErrors.tags = `태그는 중복 없이 ${MAX_COMMUNITY_POST_TAGS}개, 각 ${MAX_COMMUNITY_TAG_LENGTH}자까지 입력해 주세요.`;
    }
    if (
      Object.keys(nextErrors).length > 0 ||
      !normalizedTitle ||
      !normalizedBody ||
      !normalizedTags
    ) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const updated = await store.updatePost(authorId, post.id, {
        category,
        title: normalizedTitle,
        body: normalizedBody,
        tags: normalizedTags,
      });
      onSaved(updated);
    } catch {
      setErrors({
        storage: COMMUNITY_FAILURE_COPY.update,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="글 수정" className={styles.postEditor}>
      <header>
        <div>
          <h2>글 수정</h2>
        </div>
        <button
          aria-label="편집 닫기"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden="true" size={17} weight="bold" />
          취소
        </button>
      </header>

      <form onSubmit={submit}>
        <label htmlFor="server-post-edit-category">카테고리</label>
        <select
          id="server-post-edit-category"
          onChange={(event) => {
            setCategory(event.target.value as CommunityCategory);
            clearError("storage");
          }}
          value={category}
        >
          {COMMUNITY_CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label htmlFor="server-post-edit-title">제목</label>
        <input
          aria-describedby={errors.title ? "server-post-edit-title-error" : undefined}
          id="server-post-edit-title"
          maxLength={MAX_COMMUNITY_POST_TITLE_LENGTH}
          onChange={(event) => {
            setTitle(event.target.value);
            clearError("title");
          }}
          value={title}
        />
        {errors.title && (
          <p id="server-post-edit-title-error" role="alert">
            {errors.title}
          </p>
        )}

        <label htmlFor="server-post-edit-body">내용</label>
        <textarea
          aria-describedby={errors.body ? "server-post-edit-body-error" : undefined}
          id="server-post-edit-body"
          maxLength={MAX_COMMUNITY_POST_BODY_LENGTH}
          onChange={(event) => {
            setBody(event.target.value);
            clearError("body");
          }}
          rows={9}
          value={body}
        />
        <div className={styles.editorCounter}>
          <span>{body.length}/{MAX_COMMUNITY_POST_BODY_LENGTH}</span>
        </div>
        {errors.body && (
          <p id="server-post-edit-body-error" role="alert">
            {errors.body}
          </p>
        )}

        <label htmlFor="server-post-edit-tags">태그 (선택)</label>
        <input
          aria-describedby={errors.tags ? "server-post-edit-tags-error" : "server-post-edit-tags-note"}
          id="server-post-edit-tags"
          maxLength={MAX_COMMUNITY_POST_TAGS * (MAX_COMMUNITY_TAG_LENGTH + 2)}
          onChange={(event) => {
            setTags(event.target.value);
            clearError("tags");
          }}
          value={tags}
        />
        <small id="server-post-edit-tags-note">
          쉼표로 구분해 최대 {MAX_COMMUNITY_POST_TAGS}개까지 입력할 수 있습니다.
        </small>
        {errors.tags && (
          <p id="server-post-edit-tags-error" role="alert">
            {errors.tags}
          </p>
        )}

        {errors.storage && <p role="alert">{errors.storage}</p>}

        <div className={styles.editorActions}>
          <button disabled={saving} onClick={onCancel} type="button">
            수정 취소
          </button>
          <button disabled={saving} type="submit">
            <FloppyDisk aria-hidden="true" size={18} weight="bold" />
            {saving ? "저장 중…" : "수정 내용 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}
