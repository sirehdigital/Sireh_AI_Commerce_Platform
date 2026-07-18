import { logger as sharedLogger } from "../../../../shared/logger/logger.js";
import type { SaieLogEvent, SaieLogger } from "../../application/index.js";

interface SharedLoggerLike {
  readonly debug: (message: string, metadata?: Record<string, unknown>) => void;
  readonly info: (message: string, metadata?: Record<string, unknown>) => void;
  readonly warn: (message: string, metadata?: Record<string, unknown>) => void;
  readonly error: (message: string, metadata?: Record<string, unknown>) => void;
}

export class ProcessLocalSaieLogger implements SaieLogger {
  public constructor(private readonly targetLogger: SharedLoggerLike = sharedLogger) {}

  public debug(event: SaieLogEvent): void {
    this.targetLogger.debug(event.message, this.toSafeMetadata("debug", event));
  }

  public info(event: SaieLogEvent): void {
    this.targetLogger.info(event.message, this.toSafeMetadata("info", event));
  }

  public warn(event: SaieLogEvent): void {
    this.targetLogger.warn(event.message, this.toSafeMetadata("warn", event));
  }

  public error(event: SaieLogEvent): void {
    this.targetLogger.error(event.message, this.toSafeMetadata("error", event));
  }

  private toSafeMetadata(level: "debug" | "info" | "warn" | "error", event: SaieLogEvent): Record<string, unknown> {
    return {
      level,
      eventName: event.eventName,
      ...(event.correlationId === undefined ? {} : { correlationId: event.correlationId }),
      ...(event.operation === undefined ? {} : { operation: event.operation }),
      ...(event.entityType === undefined ? {} : { entityType: event.entityType }),
      ...(event.entityId === undefined ? {} : { entityId: event.entityId }),
      ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
      ...(event.outcome === undefined ? {} : { outcome: event.outcome }),
      ...(event.metadata === undefined ? {} : { metadata: event.metadata }),
    };
  }
}
