export function validatedHttpUrl(value: unknown, field = "URL") {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported URL protocol");
    }
  } catch {
    throw new Error(`Invalid ${field}`);
  }

  return value;
}
