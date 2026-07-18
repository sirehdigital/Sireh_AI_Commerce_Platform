import type { DashboardPreviewService } from "../../presentation/index.js";
import { dashboardPreviewService } from "../../presentation/index.js";
import type { DashboardReadModel } from "../models/index.js";
import type { DashboardReadPort } from "../ports/index.js";
import type { DashboardAggregationService } from "../services/dashboard-aggregation.service.js";
import type { TenantContext } from "../tenant/index.js";

export class DashboardPreviewReadAdapter implements DashboardReadPort {
  public constructor(private readonly dashboardService: DashboardPreviewService = dashboardPreviewService) {}

  public getDashboard(tenant: TenantContext): DashboardReadModel {
    void tenant;
    return this.dashboardService.createViewModel();
  }
}

export class DashboardAggregationReadAdapter implements DashboardReadPort {
  public constructor(private readonly dashboardAggregationService: DashboardAggregationService) {}

  public getDashboard(tenant: TenantContext): DashboardReadModel {
    return this.dashboardAggregationService.getDashboardSnapshot(tenant);
  }
}
