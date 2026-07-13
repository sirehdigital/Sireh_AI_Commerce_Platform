import { InvalidContentValueError } from "../errors/content-domain.errors.js";

export interface ContentLengthInput {
  readonly wordCount: number;
  readonly characterCount: number;
}

export class ContentLength {
  public readonly wordCount: number;
  public readonly characterCount: number;

  private constructor(input: ContentLengthInput) {
    this.wordCount = input.wordCount;
    this.characterCount = input.characterCount;
  }

  public static create(input: ContentLengthInput): ContentLength {
    assertValidCount(input.wordCount, "wordCount");
    assertValidCount(input.characterCount, "characterCount");

    return new ContentLength({
      wordCount: Math.trunc(input.wordCount),
      characterCount: Math.trunc(input.characterCount),
    });
  }

  public static fromText(value: string): ContentLength {
    const trimmed = value.trim();
    const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;

    return ContentLength.create({
      wordCount,
      characterCount: value.length,
    });
  }

  public equals(other: ContentLength): boolean {
    return this.wordCount === other.wordCount && this.characterCount === other.characterCount;
  }
}

function assertValidCount(value: number, field: keyof ContentLengthInput): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidContentValueError(`${field} must be a non-negative finite number.`, {
      field,
    });
  }
}
