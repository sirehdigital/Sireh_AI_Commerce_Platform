export type SaieLogLevel = "debug" | "info" | "warn" | "error";
export type SaieLogOutcome = "success" | "failure" | "conflict" | "blocked";
export type SaieLogMetadata = Readonly<Record<string, string | number | boolean | null>>;

export interface SaieLogEvent {
  readonly eventName: string;
  readonly message: string;
  readonly correlationId?: string | undefined;
  readonly operation?: string | undefined;
  readonly entityType?: string | undefined;
  readonly entityId?: string | undefined;
  readonly durationMs?: number | undefined;
  readonly outcome?: SaieLogOutcome | undefined;
  readonly metadata?: SaieLogMetadata | undefined;
}

export interface SaieLogger {
  readonly debug: (event: SaieLogEvent) => void;
  readonly info: (event: SaieLogEvent) => void;
  readonly warn: (event: SaieLogEvent) => void;
  readonly error: (event: SaieLogEvent) => void;
}

export class NoopSaieLogger implements SaieLogger {
  public debug(event: SaieLogEvent): void {
    void event;
  }

  public info(event: SaieLogEvent): void {
    void event;
  }

  public warn(event: SaieLogEvent): void {
    void event;
  }

  public error(event: SaieLogEvent): void {
    void event;
  }
}
