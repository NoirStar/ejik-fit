export type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; updatedAt?: string }
  | { status: "empty"; reason: "no-data" | "no-match" }
  | { status: "error"; message: string; retryable: boolean };

export type DashboardStatus = "ready" | "partial" | "empty" | "error";

function hasEmptyItems(value: unknown) {
  if (!value || typeof value !== "object" || !("items" in value)) {
    return false;
  }

  return Array.isArray(value.items) && value.items.length === 0;
}

export async function settledResource<T>(
  promise: Promise<T>,
): Promise<ResourceState<T>> {
  try {
    const data = await promise;
    return hasEmptyItems(data)
      ? { status: "empty", reason: "no-data" }
      : { status: "ready", data };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error
        ? error.message
        : "데이터를 불러오지 못했습니다.",
      retryable: true,
    };
  }
}

export function dashboardStatus(
  resources: readonly ResourceState<unknown>[],
): DashboardStatus {
  const ready = resources.filter((item) => item.status === "ready").length;
  const empty = resources.filter((item) => item.status === "empty").length;
  const error = resources.filter((item) => item.status === "error").length;

  if (ready > 0 && error > 0) return "partial";
  if (ready > 0) return "ready";
  if (empty > 0 && error === 0) return "empty";
  return "error";
}
