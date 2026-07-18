import type {
  DashboardReadModel,
  HealthReadModel,
} from "../models/index.js";
import type { TenantContext } from "../tenant/index.js";

export interface DashboardReadPort {
  readonly getDashboard: (tenant: TenantContext) => DashboardReadModel;
}

export interface HealthReadPort {
  readonly getHealth: () => HealthReadModel;
}
