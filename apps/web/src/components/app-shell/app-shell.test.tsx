import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SavedSearchComposer } from "@/features/saved-searches/saved-search-composer";
import { useSavedJobSearches } from "@/features/saved-searches/use-saved-job-searches";

import { AppShell } from "./app-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  search: "",
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const authViewer = vi.hoisted(() => ({
  state: {
    viewer: null as { id: string; email: string } | null,
    ready: true,
    signingOut: false,
    error: "",
    signOut: vi.fn(async () => true),
  },
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

const accountSync = vi.hoisted(() => ({
  status: "local" as "error" | "local" | "synced" | "syncing",
}));

const legacyMigration = vi.hoisted(() => ({
  observe: vi.fn(),
  status: {
    phase: "complete" as "idle" | "running" | "complete" | "failed",
    failureCount: 0,
    retry: vi.fn(async () => undefined),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({
    replace: navigation.replace,
    refresh: navigation.refresh,
  }),
}));

vi.mock("@/features/auth/use-auth-viewer", async () => {
  const { useEffect } = await import("react");

  return {
    useAuthViewer: vi.fn(() => {
      useEffect(() => {
        authViewer.subscribe();
        return () => authViewer.unsubscribe();
      }, []);
      return authViewer.state;
    }),
  };
});

vi.mock("@/features/auth/use-account-state-sync", () => ({
  useAccountStateSync: () => accountSync.status,
}));

vi.mock("@/features/community/use-community-legacy-migration", () => ({
  useCommunityLegacyMigration: (viewer: unknown) => {
    legacyMigration.observe(viewer);
    return legacyMigration.status;
  },
}));

vi.mock("@/features/saved-searches/use-saved-job-searches", () => ({
  useSavedJobSearches: vi.fn(),
}));

describe("AppShell", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    navigation.pathname = "/";
    navigation.search = "";
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
    localStorage.clear();
    authViewer.state.viewer = null;
    authViewer.state.ready = true;
    authViewer.state.signingOut = false;
    authViewer.state.error = "";
    accountSync.status = "local";
    legacyMigration.status.phase = "complete";
    legacyMigration.status.failureCount = 0;
    legacyMigration.status.retry.mockReset();
    legacyMigration.status.retry.mockResolvedValue(undefined);
    vi.mocked(useSavedJobSearches).mockReturnValue({
      state: { status: "ready", items: [], error: "" },
      create: vi.fn(),
      reload: vi.fn(),
      rename: vi.fn(),
      setEnabled: vi.fn(),
      remove: vi.fn(),
      markChecked: vi.fn(),
    });
  });

  it("exposes desktop and mobile access to five product destinations", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    expect(screen.getAllByRole("link", { name: "홈" })[0]).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link", { name: "시장" })[0]).toHaveAttribute("href", "/market");
    expect(screen.getAllByRole("link", { name: "스킬맵" })[0]).toHaveAttribute("href", "/skill-map");
    expect(screen.getAllByRole("link", { name: "공고" })[0]).toHaveAttribute("href", "/jobs");
    expect(screen.getAllByRole("link", { name: "내 커리어" })[0]).toHaveAttribute("href", "/career");
    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute("href", "/?compose=1");
    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute(
      "aria-label",
      "글쓰기",
    );
    expect(screen.getByRole("searchbox", { name: "통합 검색" })).toHaveAttribute("name", "q");
    expect(screen.getByRole("searchbox", { name: "통합 검색" })).toHaveAttribute(
      "placeholder",
      "회사, 직무, 기술, 주제 검색",
    );
    expect(screen.getByRole("searchbox", { name: "통합 검색" }).closest("form")).toHaveAttribute(
      "action",
      "/search",
    );
    expect(screen.queryByText("김민준")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 기술 열기" })).toHaveTextContent(
      "내 기술",
    );
  });

  it("places the desktop navigation inside the single header row", () => {
    const { container } = render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    const header = container.querySelector("header");
    const row = header?.firstElementChild;
    expect(row).not.toBeNull();
    expect(row?.querySelector('nav[aria-label="주요 탐색"]')).toBeInTheDocument();
    expect(
      row?.querySelector('img[src="/brand/ejik-fit-wordmark.svg"]'),
    ).toBeInTheDocument();
    expect(screen.queryByText("EJIK FIT")).not.toBeInTheDocument();
  });

  it("keeps the current query visible on the global search route", () => {
    navigation.pathname = "/search";
    navigation.search = "q=Python&scope=skills";

    render(
      <AppShell>
        <main>검색 결과</main>
      </AppShell>,
    );

    expect(screen.getByRole("searchbox", { name: "통합 검색" })).toHaveValue(
      "Python",
    );
  });

  it("derives the current destination from the pathname", () => {
    navigation.pathname = "/jobs/job-1";

    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    expect(screen.getAllByRole("link", { name: "공고" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { name: "홈" })[0]).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps company hiring profiles inside the jobs destination", () => {
    navigation.pathname = "/companies/naver";

    render(
      <AppShell>
        <main>기업 채용 현황</main>
      </AppShell>,
    );

    for (const link of screen.getAllByRole("link", { name: "공고" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("shares its auth viewer with a saved-search composer", () => {
    authViewer.state.viewer = {
      id: "viewer-1",
      email: "developer@example.com",
    };
    accountSync.status = "synced";

    render(
      <AppShell>
        <SavedSearchComposer
          filters={{ query: "Python", category: "", careerType: "" }}
        />
      </AppShell>,
    );

    expect(
      screen.getByRole("button", { name: "이 검색 저장" }),
    ).toBeEnabled();
    expect(authViewer.subscribe).toHaveBeenCalledTimes(1);
    expect(legacyMigration.observe).toHaveBeenCalledWith(authViewer.state.viewer);
    fireEvent.click(
      screen.getByRole("button", { name: "사용자 메뉴 열기" }),
    );
    expect(
      screen.getByText("내 기술과 저장 항목을 계정에 저장했습니다."),
    ).toBeInTheDocument();
  });

  it("offers a retry when legacy community records could not move", () => {
    authViewer.state.viewer = {
      id: "viewer-1",
      email: "developer@example.com",
    };
    legacyMigration.status.phase = "failed";
    legacyMigration.status.failureCount = 2;

    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "이전 브라우저 글 2개를 계정으로 옮기지 못했습니다",
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 옮기기" }));
    expect(legacyMigration.status.retry).toHaveBeenCalledTimes(1);
  });

  it("marks the desktop skill graph as an immersive route", () => {
    navigation.pathname = "/skills/graph";

    const { container } = render(
      <AppShell>
        <main>그래프</main>
      </AppShell>,
    );

    expect(container.querySelector('[data-immersive="true"]')).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "스킬맵" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("dismisses utility disclosures and restores opener focus", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    const notificationButton = screen.getByRole("button", { name: "알림 열기" });
    fireEvent.click(notificationButton);
    expect(screen.getByLabelText("알림")).toBeInTheDocument();
    expect(screen.getByText("새 공고와 지원 현황을 확인합니다.")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByLabelText("알림")).not.toBeInTheDocument();
    expect(notificationButton).toHaveFocus();

    const userButton = screen.getByRole("button", { name: "사용자 메뉴 열기" });
    expect(userButton).toBeEnabled();
    fireEvent.click(userButton);
    expect(screen.getByLabelText("사용자 메뉴")).toBeInTheDocument();
    expect(screen.getByText("내 기술은 이 기기에 저장됩니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "저장 목록" })).toHaveAttribute(
      "href",
      "/career/saved",
    );
    expect(screen.getByRole("link", { name: "공고 알림" })).toHaveAttribute(
      "href",
      "/career/alerts",
    );
    expect(screen.getByRole("link", { name: "채용 일정" })).toHaveAttribute(
      "href",
      "/career/calendar",
    );
    expect(screen.getByRole("link", { name: "내 글" })).toHaveAttribute(
      "href",
      "/career/questions",
    );
    expect(screen.getByRole("link", { name: "계정 및 동기화" })).toHaveAttribute(
      "href",
      "/career/account",
    );
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute(
      "href",
      "/login?next=%2F",
    );
    fireEvent.pointerDown(screen.getByText("내용"));
    expect(screen.queryByLabelText("사용자 메뉴")).not.toBeInTheDocument();
  });

  it("keeps the current filters in the guest login return path", () => {
    navigation.pathname = "/jobs";
    navigation.search = "q=Python&category=backend";

    render(
      <AppShell>
        <main>필터된 공고</main>
      </AppShell>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "사용자 메뉴 열기" }),
    );

    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute(
      "href",
      "/login?next=%2Fjobs%3Fq%3DPython%26category%3Dbackend",
    );
  });

  it("focuses global search when slash is pressed outside an editor", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );
    const search = screen.getByRole("searchbox", { name: "통합 검색" });

    fireEvent.keyDown(document, { key: "/" });

    expect(search).toHaveFocus();
  });

  it("hydrates browser-stored skills into a direct home visit", async () => {
    localStorage.setItem("ejik-fit:owned-skills", JSON.stringify(["Kubernetes"]));

    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        "/?owned_skills=Kubernetes#my-stack",
        { scroll: false },
      );
    });
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("hydrates browser-stored career preferences into a direct home visit", async () => {
    localStorage.setItem(
      "ejik-fit:career-preferences",
      JSON.stringify({
        careerCondition: "experienced",
        targetDomain: "backend",
      }),
    );

    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        "/?career_type=experienced&target_domain=backend#my-stack",
        { scroll: false },
      );
    });
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("persists an explicit home career context from the URL", async () => {
    navigation.search = "career_type=new_comer&target_domain=frontend";

    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    await waitFor(() => {
      expect(
        JSON.parse(
          localStorage.getItem("ejik-fit:career-preferences") ?? "null",
        ),
      ).toEqual({
        careerCondition: "new_comer",
        targetDomain: "frontend",
      });
    });
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute(
      "href",
      "/?career_type=new_comer&target_domain=frontend&compose=1",
    );
  });
});
