import type { SAIEAgentType } from "./saie-agent.types.js";

export interface SAIEContext {
  readonly correlationId: string;
  readonly tenantId: string;
  readonly requestedBy: string;
  readonly source: "system" | "admin" | "workflow" | "agent";
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface SAIERequest<TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly id: string;
  readonly context: SAIEContext;
  readonly targetAgent: SAIEAgentType;
  readonly intent: string;
  readonly payload: TPayload;
}

export interface SAIEResponse<
  TResult extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  readonly requestId: string;
  readonly context: SAIEContext;
  readonly status: "accepted" | "planned" | "rejected";
  readonly result: TResult;
  readonly warnings: readonly string[];
}
