import { Router } from "express";

import type { MetricsController } from "../controllers/index.js";

export const createMetricsRouter = (controller: MetricsController): Router => {
  const router = Router();

  router.get("/", controller.getMetrics);

  return router;
};
