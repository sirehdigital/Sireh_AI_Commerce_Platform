import { createHash } from "node:crypto";

export function handleize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "item";
}

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function cleanSettings(
  settings: Readonly<Record<string, string | number | boolean | null>>,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.fromEntries(Object.entries(settings).filter((entry) => entry[1] !== null && entry[1] !== ""));
}
