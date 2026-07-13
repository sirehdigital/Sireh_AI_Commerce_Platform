/**
 * Project: Sireh AI Commerce Platform
 * Module: Server Bootstrap
 * Sprint: SAI-02.03
 * Author: OpenAI + Codex
 * Status: Production Ready
 */
import { env } from "./config/env.js";
import { createApp } from "./app/app.js";

const projectName = "Sireh AI Engine Backend";
const environment = env.NODE_ENV;
const port = env.PORT;
const app = createApp();

const server = app.listen(port, () => {
  console.log(`${projectName} started`, {
    environment,
    port,
  });
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${projectName} received ${signal}. Shutting down gracefully.`);

  server.close((error) => {
    if (error) {
      console.error(`${projectName} shutdown failed`, error);
      process.exit(1);
    }

    console.log(`${projectName} shutdown complete.`);
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
