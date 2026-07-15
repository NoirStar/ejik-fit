export type ResourceState<T> =
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export async function settledResource<T>(
  promise: Promise<T>,
  failureMessage = "데이터를 불러오지 못했습니다.",
): Promise<ResourceState<T>> {
  try {
    return { status: "ready", data: await promise };
  } catch (error) {
    console.error("[resource] request failed", error);
    return {
      status: "error",
      message: failureMessage,
    };
  }
}
