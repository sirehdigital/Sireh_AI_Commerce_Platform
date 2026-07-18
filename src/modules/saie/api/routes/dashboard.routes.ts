import { Router } from "express";

import type { DashboardController } from "../controllers/index.js";

export const createDashboardRouter = (controller: DashboardController): Router => {
  const router = Router();

  router.get("/", controller.getDashboard);

  return router;
};
