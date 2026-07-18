import type { AuditRecord, AuditRepository, TenantContext } from "../../application/index.js";
import { InMemoryAuditRepository, createDeterministicAuditSeedRecords } from "../../infrastructure/index.js";

export class AuditQueryService implements AuditRepository {
  private readonly auditRepository: AuditRepository;

  public constructor(
    auditRepository: AuditRepository = new InMemoryAuditRepository(createDeterministicAuditSeedRecords()),
  ) {
    this.auditRepository = auditRepository;
  }

  public list(context: TenantContext): readonly AuditRecord[] {
    return this.auditRepository.list(context);
  }

  public findById(context: TenantContext, auditId: string): AuditRecord | undefined {
    return this.auditRepository.findById(context, auditId);
  }

  public append(context: TenantContext, record: AuditRecord): AuditRecord {
    return this.auditRepository.append(context, record);
  }

  public listAudits(context: TenantContext): readonly AuditRecord[] {
    return this.list(context);
  }

  public findAudit(context: TenantContext, auditId: string): AuditRecord | null {
    return this.findById(context, auditId) ?? null;
  }
}
