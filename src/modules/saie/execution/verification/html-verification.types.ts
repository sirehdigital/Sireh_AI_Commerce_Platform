export interface HtmlVerificationResult {
  readonly equivalent: boolean;
  readonly expectedCanonicalHash: string;
  readonly actualCanonicalHash: string;
  readonly differenceReason?: string;
  readonly rawStringsEqual: boolean;
  readonly canonicalStringsEqual: boolean;
}

export class UnsafeHtmlVerificationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UnsafeHtmlVerificationError";
  }
}
