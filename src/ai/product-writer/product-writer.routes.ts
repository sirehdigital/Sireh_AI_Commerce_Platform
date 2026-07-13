/**
 * Project: Sireh AI Commerce Platform
 * Module: AI Product Writer Routes
 * Sprint: SAI-03A.06
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import { Router } from "express";
import { productWriterController } from "./product-writer.controller.js";

export const productWriterRouter = Router();

productWriterRouter.post("/generate", (req, res, next) => {
  void productWriterController.generate(req, res, next);
});

