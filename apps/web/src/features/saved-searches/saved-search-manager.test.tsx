import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthViewerContext } from "@/features/auth/auth-viewer-context";
import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import type { SavedJobSearch } from "@/lib/saved-job-searches";
import type {
  SavedSearchEvaluationGroup,
  SavedSearchEvaluationState,
} from "@/lib/saved-search-notifications";
import type { PostingSummary } from "@/lib/types";

import { SavedSearchManager } from "./saved-search-manager";
import {
  type SavedJobSearchesController,
  type SavedJobSearchesState,
  useSavedJobSearches,
} from "./use-saved-job-searches";
import { useSavedSearchEvaluation } from "./use-saved-search-evaluation";

vi.mock("@/features/auth/auth-viewer-context", () => ({
  useAuthViewerContext: vi.fn(),
}));

vi.mock("./use-saved-job-searches", () => ({
  useSavedJobSearches: vi.fn(),
}));

vi.mock("./use-saved-search-evaluation", () => ({
  useSavedSearchEvaluation: vi.fn(),
}));

const viewer: AuthViewer = {
  id: "viewer-1",
  email: "developer@example.com",
};

const pythonSearch: SavedJobSearch = {
  id: "search-1",
  userId: viewer.id,
  name: "Python 백엔드",
  query: "Python",
  category: "backend",
  careerType: "",
  filterKey: "python|backend|",
  enabled: true,
  lastCheckedAt: "2026-07-20T00:00:00.000Z",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

const pausedSearch: SavedJobSearch = {
  ...pythonSearch,
  id: "search-2",
  name: "경력 인프라",
  query: "",
  category: "infra",
  careerType: "experienced",
  filterKey: "|infra|experienced",
  enabled: false,
};

const reload = vi.fn<SavedJobSearchesController["reload"]>();
const create = vi.fn<SavedJobSearchesController["create"]>();
const rename = vi.fn<SavedJobSearchesController["rename"]>();
const setEnabled = vi.fn<SavedJobSearchesController["setEnabled"]>();
const remove = vi.fn<SavedJobSearchesController["remove"]>();
const markChecked = vi.fn<SavedJobSearchesController["markChecked"]>();
const refresh = vi.fn<() => void>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function posting(id: string): PostingSummary {
  return {
    id,
    title: `공고 ${id}`,
    company_name: "이직핏 테스트",
    career_type: null,
    employment_type: null,
    career_min: null,
    career_max: null,
    location: null,
    status: "open",
    source_url: `https://example.com/jobs/${id}`,
    first_seen_at: "2026-07-20T01:00:00.000Z",
    last_verified_at: "2026-07-20T01:00:00.000Z",
  };
}

function readyGroup(
  searchId: string,
  total: number,
  newIds: string[] = [],
): SavedSearchEvaluationGroup {
  return {
    searchId,
    status: "ready",
    total,
    items: newIds.map(posting),
  };
}

function mockAuth(activeViewer: AuthViewer | null, ready = true) {
  vi.mocked(useAuthViewerContext).mockReturnValue({
    error: "",
    viewer: activeViewer,
    ready,
    status: ready
      ? activeViewer
        ? "authenticated"
        : "unauthenticated"
      : "loading",
  });
}

function mockSearches(
  state: SavedJobSearchesState = {
    status: "ready",
    items: [pythonSearch],
    error: "",
  },
) {
  vi.mocked(useSavedJobSearches).mockReturnValue({
    state,
    reload,
    create,
    rename,
    setEnabled,
    remove,
    markChecked,
  });
}

function mockEvaluation(
  state: SavedSearchEvaluationState = {
    status: "ready",
    groups: [readyGroup(pythonSearch.id, 23, ["job-1", "job-2"])],
    error: "",
  },
) {
  vi.mocked(useSavedSearchEvaluation).mockReturnValue({ state, refresh });
}

describe("SavedSearchManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth(viewer);
    mockSearches();
    mockEvaluation();
    rename.mockResolvedValue(true);
    setEnabled.mockResolvedValue(true);
    remove.mockResolvedValue(true);
  });

  afterEach(() => cleanup());

  it("manages an active saved search and links to its exact jobs filter", async () => {
    render(<SavedSearchManager />);

    expect(screen.getByText("Python 백엔드")).toBeInTheDocument();
    expect(screen.getByText("현재 공식 공고 23건")).toBeInTheDocument();
    expect(screen.getByText("새로 확인 2건")).toBeInTheDocument();
    expect(screen.getByText(/최근 확인/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "공고 보기" })).toHaveAttribute(
      "href",
      "/jobs?q=Python&category=backend",
    );
    expect(useSavedSearchEvaluation).toHaveBeenCalledWith(
      [pythonSearch],
      "ready",
      markChecked,
      { includePaused: true },
    );

    fireEvent.click(screen.getByRole("button", { name: "일시 중지" }));
    await waitFor(() =>
      expect(setEnabled).toHaveBeenCalledWith(pythonSearch.id, false),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "이름 수정" }),
      ).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "이름 수정" }));
    const nameInput = screen.getByLabelText("저장 검색 이름");
    expect(nameInput).toHaveFocus();
    fireEvent.change(nameInput, {
      target: { value: "Python 서버 개발" },
    });
    fireEvent.click(screen.getByRole("button", { name: "이름 저장" }));
    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith(
        pythonSearch.id,
        "Python 서버 개발",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByLabelText("저장 검색 이름"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "이름 수정" }),
    ).toHaveFocus();

    const deleteButton = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(deleteButton);
    expect(remove).not.toHaveBeenCalled();
    const deleteConfirm = screen.getByRole("button", { name: "삭제 확인" });
    expect(deleteConfirm).toHaveFocus();
    fireEvent.click(deleteConfirm);
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(pythonSearch.id),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "삭제" }),
      ).toHaveFocus(),
    );
  });

  it("keeps each row pending until that row's own mutation settles", async () => {
    const firstToggle = deferred<boolean>();
    const secondToggle = deferred<boolean>();
    const secondSearch = { ...pausedSearch, enabled: true };
    mockSearches({
      status: "ready",
      items: [pythonSearch, secondSearch],
      error: "",
    });
    mockEvaluation({
      status: "ready",
      groups: [
        readyGroup(pythonSearch.id, 23),
        readyGroup(secondSearch.id, 12),
      ],
      error: "",
    });
    setEnabled.mockImplementation((id) =>
      id === pythonSearch.id ? firstToggle.promise : secondToggle.promise,
    );

    render(<SavedSearchManager />);

    const firstActions = screen.getByRole("group", {
      name: `${pythonSearch.name} 관리`,
    });
    const secondActions = screen.getByRole("group", {
      name: `${secondSearch.name} 관리`,
    });
    fireEvent.click(
      within(firstActions).getByRole("button", { name: "일시 중지" }),
    );
    fireEvent.click(
      within(secondActions).getByRole("button", { name: "일시 중지" }),
    );

    const secondRename = within(secondActions).getByRole("button", {
      name: "이름 수정",
    });
    expect(secondRename).toBeDisabled();

    await act(async () => {
      firstToggle.resolve(true);
      await firstToggle.promise;
    });

    expect(secondRename).toBeDisabled();

    await act(async () => {
      secondToggle.resolve(true);
      await secondToggle.promise;
    });
    await waitFor(() => expect(secondRename).toBeEnabled());
  });

  it("keeps current totals but never shows an active new count for a paused rule", async () => {
    mockSearches({
      status: "ready",
      items: [pausedSearch],
      error: "",
    });
    mockEvaluation({
      status: "ready",
      groups: [readyGroup(pausedSearch.id, 12, ["job-3", "job-4"])],
      error: "",
    });

    render(<SavedSearchManager />);

    expect(screen.getByText("현재 공식 공고 12건")).toBeInTheDocument();
    expect(screen.getAllByText("일시 중지")).toHaveLength(2);
    expect(screen.queryByText("새로 확인 2건")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시작" }));
    await waitFor(() =>
      expect(setEnabled).toHaveBeenCalledWith(pausedSearch.id, true),
    );
  });

  it("keeps a failed rename editable and associates the error with its input", async () => {
    rename.mockResolvedValue(false);

    render(<SavedSearchManager />);

    fireEvent.click(screen.getByRole("button", { name: "이름 수정" }));
    fireEvent.change(screen.getByLabelText("저장 검색 이름"), {
      target: { value: "새 알림 이름" },
    });
    fireEvent.click(screen.getByRole("button", { name: "이름 저장" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "이름을 변경하지 못했습니다. 다시 시도해 주세요.",
    );
    expect(screen.getByLabelText("저장 검색 이름")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("저장 검색 이름")).toHaveAttribute(
      "aria-describedby",
      alert.id,
    );
    expect(screen.getByLabelText("저장 검색 이름")).toHaveFocus();
  });

  it("restores delete-button focus after cancellation and a failed deletion", async () => {
    remove.mockResolvedValue(false);

    render(<SavedSearchManager />);

    const deleteButton = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(deleteButton);
    expect(
      screen.getByRole("button", { name: "삭제 확인" }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "삭제" }),
      ).toHaveFocus(),
    );

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));

    expect(
      await screen.findByText(
        "저장 검색을 삭제하지 못했습니다. 다시 시도해 주세요.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "삭제" }),
      ).toHaveFocus(),
    );
  });

  it("offers login when authentication is ready without a viewer", () => {
    mockAuth(null);

    render(<SavedSearchManager />);

    expect(
      screen.getByRole("link", { name: "로그인하고 공고 알림 관리" }),
    ).toHaveAttribute(
      "href",
      "/login?next=%2Fcareer%2Falerts",
    );
    expect(useSavedJobSearches).toHaveBeenCalledWith(null);
  });

  it("shows an authentication error without presenting a login action", () => {
    vi.mocked(useAuthViewerContext).mockReturnValue({
      error: "인증 서버 응답을 확인하지 못했습니다.",
      viewer: null,
      ready: true,
      status: "error",
    });

    render(<SavedSearchManager />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "인증 서버 응답을 확인하지 못했습니다.",
    );
    expect(
      screen.queryByRole("link", { name: "로그인하고 공고 알림 관리" }),
    ).not.toBeInTheDocument();
  });

  it("links an empty account back to the jobs explorer", () => {
    mockSearches({ status: "ready", items: [], error: "" });
    mockEvaluation({ status: "ready", groups: [], error: "" });

    render(<SavedSearchManager />);

    expect(
      screen.getByRole("heading", { name: "저장한 알림이 없습니다." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "공고에서 알림 만들기" }),
    ).toHaveAttribute("href", "/jobs");
  });

  it("retries a failed saved-search list load", async () => {
    mockSearches({
      status: "error",
      items: [],
      error: "저장된 검색을 불러오지 못했습니다.",
    });
    mockEvaluation({ status: "idle", groups: [], error: "" });

    render(<SavedSearchManager />);

    expect(
      screen.getByText("저장된 검색을 불러오지 못했습니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("preserves successful rows and retries only the partial evaluation", () => {
    mockSearches({
      status: "ready",
      items: [pythonSearch, pausedSearch],
      error: "",
    });
    mockEvaluation({
      status: "partial",
      groups: [
        readyGroup(pythonSearch.id, 23, ["job-1"]),
        {
          searchId: pausedSearch.id,
          status: "error",
          total: null,
          items: [],
        },
      ],
      error: "일부 저장 검색 공고를 확인하지 못했습니다.",
    });

    render(<SavedSearchManager />);

    expect(
      screen.getByText("일부 저장 검색 공고를 확인하지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("현재 공식 공고 23건")).toBeInTheDocument();
    expect(screen.getByText("새로 확인 1건")).toBeInTheDocument();
    expect(screen.getByText("공고 수 확인 실패")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "공고 수 다시 확인" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
