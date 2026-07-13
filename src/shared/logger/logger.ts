/**
 * Project: Sireh AI Commerce Platform
 * Module: Logger
 * Sprint: SAI-02.05
 * Author: OpenAI + Codex
 * Status: Production Ready
 */

import { env } from "../../config/env.js";

type LogLevel = "info" | "warn" | "error" | "debug";
type LogMetadata = Record<string, unknown>;
type LogMessage = string;

interface Logger {
  info(message: LogMessage, metadata?: LogMetadata): void;
  warn(message: LogMessage, metadata?: LogMetadata): void;
  error(message: LogMessage, metadata?: LogMetadata): void;
  debug(message: LogMessage, metadata?: LogMetadata): void;
}

function createLogEntry(level: LogLevel, message: LogMessage, metadata?: LogMetadata): LogMetadata {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(metadata === undefined ? {} : { metadata }),
  };
}

function writeLog(level: LogLevel, message: LogMessage, metadata?: LogMetadata): void {
  const entry = createLogEntry(level, message, metadata);

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

export const logger: Logger = {
  info(message, metadata) {
    writeLog("info", message, metadata);
  },

  warn(message, metadata) {
    writeLog("warn", message, metadata);
  },

  error(message, metadata) {
    writeLog("error", message, metadata);
  },

  debug(message, metadata) {
    if (env.NODE_ENV !== "development") {
      return;
    }

    writeLog("debug", message, metadata);
  },
};
