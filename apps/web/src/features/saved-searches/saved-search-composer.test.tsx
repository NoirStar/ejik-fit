import {
  cleanup,
  fireEvent,
  render as testingRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

import { AuthViewerProvider } from "@/features/auth/auth-viewer-context";
import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import type { SavedJobSearch } from "@/lib/saved-job-searches";

import {
  type CreateSavedJobSearchResult,
  type SavedJobSearchesController,
  type SavedJobSearchesState,
  useSavedJobSearches,
} from "./use-saved-job-searches";
import { SavedSearchComposer } from "./saved-search-composer";

vi.mock("./use-saved-job-searches", () => ({
  useSavedJobSearches: vi.fn(),
}));

const viewer: AuthViewer = {
  id: "viewer-1",
  email: "developer@example.com",
};

const savedSearch: SavedJobSearch = {
  id: "search-1",
  userId: viewer.id,
  name: "Python · 백엔드",
  query: "Python",
  category: "backend",
  careerType: "",
  filterKey: "python|backend|",
  enabled: true,
  lastCheckedAt: "2026-07-20T00:00:00.000Z",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

const create = vi.fn<SavedJobSearchesController["create"]>();
const reload = vi.fn<SavedJobSearchesController["reload"]>();
const rename = vi.fn<SavedJobSearchesController["rename"]>();
const setEnabled = vi.fn<SavedJobSearchesController["setEnabled"]>();
const remove = vi.fn<SavedJobSearchesController["remove"]>();
const markChecked = vi.fn<SavedJobSearchesController["markChecked"]>();
let authState: { viewer: AuthViewer | null; ready: boolean } = {
  viewer: null,
  ready: true,
};

const readyState: SavedJobSearchesState = {
  status: "ready",
  items: [],
  error: "",
};

function mockAuth(activeViewer: AuthViewer | null, ready = true) {
  authState = { viewer: activeViewer, ready };
}

function TestAuthViewerProvider({ children }: { children: ReactNode }) {
  return (
    <AuthViewerProvider ready={authState.ready} viewer={authState.viewer}>
      {children}
    </AuthViewerProvider>
  );
}

function render(element: ReactElement) {
  return testingRender(element, { wrapper: TestAuthViewerProvider });
}

function mockSavedSearches(state: SavedJobSearchesState = readyState) {
  vi.mocked(useSavedJobSearches).mockReturnValue({
    state,
    create,
    reload,
    rename,
    setEnabled,
    remove,
    markChecked,
  });
}

function loginContinuationParams() {
  const href = screen
    .getByRole("link", { name: "이 검색 저장" })
    .getAttribute("href");
  if (!href) throw new Error("Expected a login continuation href");

  const next = new URL(href, "https://ejik.fit").searchParams.get("next");
  if (!next) throw new Error("Expected a next parameter");

  return new URL(next, "https://ejik.fit").searchParams;
}

describe("SavedSearchComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth(null);
    mockSavedSearches();
  });

  afterEach(() => cleanup());

  it("preserves the current filters through the login continuation", () => {
    render(
      <SavedSearchComposer
        filters={{ query: "Python", category: "backend", careerType: "" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "이 검색 저장" }),
    ).toHaveAttribute(
      "href",
      "/login?next=%2Fjobs%3Fq%3DPython%26category%3Dbackend%26save_search%3D1",
    );
  });

  it("preserves the career filter in the login continuation", () => {
    render(
      <SavedSearchComposer
        filters={{ query: "", category: "", careerType: "experienced" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "이 검색 저장" }),
    ).toHaveAttribute(
      "href",
      "/login?next=%2Fjobs%3Fcareer_type%3Dexperienced%26save_search%3D1",
    );
  });

  it("round-trips internal query whitespace through the login continuation", () => {
    render(
      <SavedSearchComposer
        filters={{ query: "Go  Rust", category: "", careerType: "" }}
      />,
    );

    expect(loginContinuationParams().get("q")).toBe("Go  Rust");
  });

  it("round-trips queries longer than the saved-search limit through login", () => {
    const query = "x".repeat(240);

    render(
      <SavedSearchComposer
        filters={{ query, category: "", careerType: "" }}
      />,
    );

    expect(loginContinuationParams().get("q")).toBe(query);
  });

  it("opens a bounded default name and saves the signed-in search", async () => {
    mockAuth(viewer);
    create.mockResolvedValue({ status: "created", item: savedSearch });

    render(
      <SavedSearchComposer
        filters={{ query: "Python", category: "backend", careerType: "" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이 검색 저장" }));
    expect(screen.getByLabelText("저장 검색 이름")).toHaveValue(
      "Python · 백엔드",
    );
    expect(screen.getByLabelText("저장 검색 이름")).toHaveAttribute(
      "maxlength",
      "60",
    );

    fireEvent.click(screen.getByRole("button", { name: "검색 조건 저장" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        { query: "Python", category: "backend", careerType: "" },
        "Python · 백엔드",
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "검색 조건을 저장했습니다.",
    );
    expect(
      screen.getByRole("link", { name: "공고 알림 관리" }),
    ).toHaveAttribute("href", "/career/alerts");
    expect(screen.queryByLabelText("저장 검색 이름")).not.toBeInTheDocument();
  });

  it.each<{
    result: CreateSavedJobSearchResult;
    message: string;
  }>([
    {
      result: { status: "duplicate", item: savedSearch },
      message: "이미 같은 조건을 저장했습니다.",
    },
    {
      result: { status: "limit" },
      message: "저장 검색은 최대 10개까지 만들 수 있습니다.",
    },
    {
      result: { status: "error" },
      message: "검색 조건을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
  ])("shows the $result.status mutation result", async ({ result, message }) => {
    mockAuth(viewer);
    create.mockResolvedValue(result);

    render(
      <SavedSearchComposer
        filters={{ query: "Python", category: "backend", careerType: "" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이 검색 저장" }));
    fireEvent.click(screen.getByRole("button", { name: "검색 조건 저장" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText("저장 검색 이름")).toBeInTheDocument();
  });

  it("keeps filterless saving disabled", () => {
    mockAuth(viewer);

    render(
      <SavedSearchComposer
        filters={{ query: "", category: "", careerType: "" }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "이 검색 저장" }),
    ).toBeDisabled();
    expect(screen.queryByLabelText("저장 검색 이름")).not.toBeInTheDocument();
  });

  it("keeps submission disabled until the saved-search list is ready", () => {
    mockAuth(viewer);
    mockSavedSearches({ status: "loading", items: [], error: "" });

    render(
      <SavedSearchComposer
        filters={{ query: "Python", category: "", careerType: "" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이 검색 저장" }));

    expect(
      screen.getByRole("button", { name: "검색 조건 저장" }),
    ).toBeDisabled();
  });

  it("opens automatically after a completed login continuation", () => {
    mockAuth(null, false);

    const { rerender } = render(
      <SavedSearchComposer
        filters={{ query: "", category: "backend", careerType: "experienced" }}
        openOnReady
      />,
    );
    expect(screen.queryByLabelText("저장 검색 이름")).not.toBeInTheDocument();

    mockAuth(viewer);
    rerender(
      <SavedSearchComposer
        filters={{ query: "", category: "backend", careerType: "experienced" }}
        openOnReady
      />,
    );
    expect(screen.getByLabelText("저장 검색 이름")).toHaveValue(
      "백엔드 · 경력",
    );
  });

  it("resets the composer when the current filters change", () => {
    mockAuth(viewer);

    const { rerender } = render(
      <SavedSearchComposer
        filters={{ query: "Python", category: "backend", careerType: "" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "이 검색 저장" }));
    expect(screen.getByLabelText("저장 검색 이름")).toHaveValue(
      "Python · 백엔드",
    );

    rerender(
      <SavedSearchComposer
        filters={{ query: "Go", category: "backend", careerType: "" }}
      />,
    );
    expect(screen.queryByLabelText("저장 검색 이름")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이 검색 저장" }));
    expect(screen.getByLabelText("저장 검색 이름")).toHaveValue(
      "Go · 백엔드",
    );

    rerender(
      <SavedSearchComposer
        filters={{ query: "", category: "", careerType: "" }}
      />,
    );
    expect(screen.queryByLabelText("저장 검색 이름")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "이 검색 저장" }),
    ).toBeDisabled();
  });
});
