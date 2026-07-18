import type { ApprovalRecord, ApprovalRepository, TenantContext } from "../../application/index.js";
import { InMemoryApprovalRepository, createDeterministicApprovalSeedRecords } from "../../infrastructure/index.js";

export class ApprovalQueryService implements ApprovalRepository {
  private readonly approvalRepository: ApprovalRepository;

  public constructor(
    approvalRepository: ApprovalRepository = new InMemoryApprovalRepository(
      createDeterministicApprovalSeedRecords(),
    ),
  ) {
    this.approvalRepository = approvalRepository;
  }

  public list(context: TenantContext): readonly ApprovalRecord[] {
    return this.approvalRepository.list(context);
  }

  public findById(context: TenantContext, approvalId: string): ApprovalRecord | undefined {
    return this.approvalRepository.findById(context, approvalId);
  }

  public save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): ApprovalRecord {
    return this.approvalRepository.save(context, approval, expectedVersion);
  }

  public listApprovals(context: TenantContext): readonly ApprovalRecord[] {
    return this.list(context);
  }

  public findApproval(context: TenantContext, approvalId: string): ApprovalRecord | null {
    return this.findById(context, approvalId) ?? null;
  }
}
