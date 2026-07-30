export type BrandedStorageKeys = {
  current: string;
  legacy: readonly string[];
};

export type StorageCodec<T> = {
  parse: (raw: string) => T | null;
  serialize: (value: T) => string;
};

function readItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeCurrentValue(
  storage: Storage,
  key: string,
  serialized: string,
) {
  try {
    storage.setItem(key, serialized);
    return storage.getItem(key) === serialized;
  } catch {
    return false;
  }
}

export function readMigratedStorageValue<T>(
  storage: Storage,
  keys: BrandedStorageKeys,
  codec: StorageCodec<T>,
): T | null {
  for (const key of [keys.current, ...keys.legacy]) {
    const raw = readItem(storage, key);
    if (raw === null) continue;

    const value = codec.parse(raw);
    if (value === null) continue;

    if (key !== keys.current) {
      writeCurrentValue(storage, keys.current, codec.serialize(value));
    }
    return value;
  }
  return null;
}

export function writeMigratedStorageValue<T>(
  storage: Storage,
  keys: BrandedStorageKeys,
  value: T,
  codec: StorageCodec<T>,
) {
  const serialized = codec.serialize(value);
  if (!writeCurrentValue(storage, keys.current, serialized)) return false;

  for (const legacyKey of keys.legacy) {
    try {
      storage.setItem(legacyKey, serialized);
    } catch {
      // The CareerFit key is authoritative after its verified write succeeds.
    }
  }
  return true;
}

export function clearMigratedStorageValue(
  storage: Storage,
  keys: BrandedStorageKeys,
) {
  for (const key of [keys.current, ...keys.legacy]) {
    try {
      storage.removeItem(key);
    } catch {
      // An unavailable storage area already behaves as though no value exists.
    }
  }
}

export function isMigratedStorageEventKey(
  key: string | null,
  keys: BrandedStorageKeys,
) {
  return key === null || key === keys.current || keys.legacy.includes(key);
}
