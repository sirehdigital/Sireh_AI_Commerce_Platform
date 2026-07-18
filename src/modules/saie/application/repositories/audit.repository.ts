import type { AuditReadModel } from "../models/index.js";
import type { TenantContext } from "../tenant/index.js";

export type AuditRecord = AuditReadModel;

export interface AuditRepository {
  readonly list: (context: TenantContext) => readonly AuditRecord[];
  readonly findById: (context: TenantContext, auditId: string) => AuditRecord | undefined;
  readonly append: (context: TenantContext, record: AuditRecord) => AuditRecord;
}
