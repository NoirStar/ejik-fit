const LOCK_PREFIX = "ejik-fit:community-migration-lock:";
const DEFAULT_LEASE_MS = 5 * 60 * 1_000;

type MigrationLease = {
  token: string;
  expiresAt: number;
};

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function keyFor(postId: string) {
  return `${LOCK_PREFIX}${postId}`;
}

function readLease(
  postId: string,
  storage: Storage | null,
): MigrationLease | null {
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(keyFor(postId)) ?? "null") as
      | Partial<MigrationLease>
      | null;
    return value &&
      typeof value.token === "string" &&
      value.token.length > 0 &&
      typeof value.expiresAt === "number" &&
      Number.isFinite(value.expiresAt)
      ? { token: value.token, expiresAt: value.expiresAt }
      : null;
  } catch {
    return null;
  }
}

export function isLocalCommunityMigrationLocked(
  postId: string,
  storage: Storage | null = browserStorage(),
  now = Date.now(),
) {
  const lease = readLease(postId, storage);
  return Boolean(lease && lease.expiresAt > now);
}

export function acquireLocalCommunityMigrationLease(
  postId: string,
  storage: Storage | null = browserStorage(),
  now = Date.now(),
): string | null {
  if (!storage) return "storage-unavailable";
  const current = readLease(postId, storage);
  if (current && current.expiresAt > now) return null;
  const token = globalThis.crypto.randomUUID();
  try {
    storage.setItem(
      keyFor(postId),
      JSON.stringify({ token, expiresAt: now + DEFAULT_LEASE_MS }),
    );
  } catch {
    return null;
  }
  return readLease(postId, storage)?.token === token ? token : null;
}

export function ownsLocalCommunityMigrationLease(
  postId: string,
  token: string,
  storage: Storage | null = browserStorage(),
) {
  return readLease(postId, storage)?.token === token;
}

export function releaseLocalCommunityMigrationLease(
  postId: string,
  token: string,
  storage: Storage | null = browserStorage(),
) {
  if (!storage || !ownsLocalCommunityMigrationLease(postId, token, storage)) {
    return;
  }
  try {
    storage.removeItem(keyFor(postId));
  } catch {
    // An expired lease is harmless; later callers can replace it.
  }
}
