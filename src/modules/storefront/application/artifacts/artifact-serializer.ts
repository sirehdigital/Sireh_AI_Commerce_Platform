import { createHash } from "node:crypto";

import type { SerializedThemeArtifact, ThemePreviewArtifactKind } from "./theme-artifact.types.js";

export class ArtifactSerializer {
  public serialize(input: {
    readonly kind: ThemePreviewArtifactKind;
    readonly path: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }): SerializedThemeArtifact {
    return {
      kind: input.kind,
      path: input.path,
      payload: input.payload,
      contentHash: this.hash(input.payload),
    };
  }

  public hash(value: unknown): string {
    return createHash("sha256").update(this.stableStringify(value)).digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    }
    if (value !== null && typeof value === "object") {
      const record = value as Readonly<Record<string, unknown>>;
      return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }
}
