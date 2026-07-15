export type ControlledExecutionErrorCode =
  | "APPROVAL_EXPIRED"
  | "APPROVAL_SCOPE_MISMATCH"
  | "EXTRA_EXECUTION_INPUT"
  | "INVALID_APPROVAL_TOKEN"
  | "INVALID_EXECUTION_MODE"
  | "INVALID_EXECUTION_REQUEST"
  | "INVALID_PROPOSAL"
  | "PREFLIGHT_MISMATCH"
  | "PRODUCT_NOT_FOUND"
  | "READBACK_MISMATCH"
  | "SAFE_UPDATE_FAILED"
  | "TAG_POLICY_UNSUPPORTED";

export class ControlledExecutionError extends Error {
  public constructor(
    public readonly code: ControlledExecutionErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "ControlledExecutionError";
  }
}
