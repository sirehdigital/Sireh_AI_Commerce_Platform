/**
 * Project: Sireh AI Commerce Platform
 * Module: Environment Configuration
 * Sprint: SAI-02.04
 * Author: OpenAI + Codex
 * Status: Production Ready
 */

import "dotenv/config";

type NodeEnvironment = "development" | "production" | "test";

export interface Env {
  readonly NODE_ENV: NodeEnvironment;
  readonly PORT: number;
  readonly SHOPIFY_API_KEY: string;
  readonly SHOPIFY_API_SECRET: string;
  readonly SHOPIFY_APP_URL: string;
  readonly SHOPIFY_SCOPES: string;
  readonly SHOPIFY_STORE_DOMAIN: string;
  readonly SHOPIFY_API_VERSION: string;
  readonly OPENAI_API_KEY: string;
  readonly DATABASE_URL: string;
}

export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;

  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getNodeEnv(): NodeEnvironment {
  const value = process.env.NODE_ENV ?? "development";

  if (value === "development" || value === "production" || value === "test") {
    return value;
  }

  throw new Error(
    `Invalid NODE_ENV value: ${value}. Expected one of: development, production, test`,
  );
}

function getPort(): number {
  const value = process.env.PORT ?? "3000";
  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}. Expected an integer between 1 and 65535`);
  }

  return port;
}

export const env: Env = {
  NODE_ENV: getNodeEnv(),
  PORT: getPort(),
  SHOPIFY_API_KEY: getEnvVar("SHOPIFY_API_KEY"),
  SHOPIFY_API_SECRET: getEnvVar("SHOPIFY_API_SECRET"),
  SHOPIFY_APP_URL: getEnvVar("SHOPIFY_APP_URL"),
  SHOPIFY_SCOPES: getEnvVar("SHOPIFY_SCOPES", "read_products,write_products,read_orders,read_customers"),
  SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN ?? "",
  SHOPIFY_API_VERSION: getEnvVar("SHOPIFY_API_VERSION", "2025-01"),
  OPENAI_API_KEY: getEnvVar("OPENAI_API_KEY"),
  DATABASE_URL: getEnvVar("DATABASE_URL"),
};
