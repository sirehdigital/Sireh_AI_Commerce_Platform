import type { AuditRecord, TenantContext } from "../../../saie/application/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface ReleaseAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export class ReleaseAuditService {
  private sequence = 0;

  public constructor(
    private readonly repository: ReleaseAuditRepository | undefined,
    private readonly now: () => Date,
    private readonly idGenerator: () => string,
  ) {}

  public async record(
    tenant: TenantContext,
    eventType: string,
    entityId: string,
    summary: string,
    correlationId: string | undefined,
    details: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    if (this.repository === undefined) {
      return;
    }
    await this.repository.append(tenant, {
      ...tenant,
      id: `audit:${entityId}:production-release:${this.nextSequence()}:${this.idGenerator()}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "storefront-production-launch",
      occurredAt: this.timestamp(),
      summary,
      details: { ...details, storefrontEventType: eventType, activeSprint: "SACP-03.03F" },
      source: "deterministic-preview",
      sequence: this.sequence,
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "storefront.production-launch",
      status: eventType === "ROLLBACK_FAILED" ? "BLOCKED" : "READY_FOR_REVIEW",
      recordedAt: this.timestamp(),
    });
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }
}
