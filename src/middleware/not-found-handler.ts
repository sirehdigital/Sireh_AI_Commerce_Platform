/**
 * Project: Sireh AI Commerce Platform
 * Module: Not Found Handler Middleware
 * Sprint: SAI-02.09
 * Author: OpenAI + Codex
 * Status: Production Ready
 */

import type { RequestHandler } from "express";

import { AppError } from "../shared/errors/app-error.js";

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(AppError.notFound("Route not found"));
};
