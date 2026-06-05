import "dotenv/config";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const emptyToUndefined = (value: unknown): unknown => {
  if (value === "") {
    return undefined;
  }

  return value;
};

const PortSchema = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }

  return Number(value);
}, z.number().int().min(1).max(65_535).default(3000));

const OptionalStringSchema = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
);

const OptionalUrlSchema = z.preprocess(
  emptyToUndefined,
  z.string().url().optional(),
);

export const ConfigSchema = z.object({
  appEnv: z.enum(["development", "test", "production"]).default("development"),
  butterbase: z.object({
    anonKey: OptionalStringSchema,
    apiUrl: OptionalUrlSchema.default("https://api.butterbase.ai"),
    appId: OptionalStringSchema,
  }),
  logLevel: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  port: PortSchema,
  rocketrideUri: z.string().url().default("http://localhost:5565"),
  spectrumProvider: z.enum(["terminal", "slack", "imessage"]).default("terminal"),
  xtrace: z.object({
    apiKey: OptionalStringSchema,
    orgId: OptionalStringSchema,
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  constructor(readonly issues: z.ZodIssue[]) {
    super(`Invalid configuration: ${formatZodIssues(issues)}`);
    this.name = "ConfigError";
  }
}

export const formatZodIssues = (issues: z.ZodIssue[]): string =>
  issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

export const loadConfig = (
  env: Record<string, string | undefined> = process.env,
): AppConfig => {
  const result = ConfigSchema.safeParse({
    appEnv: env.APP_ENV,
    butterbase: {
      anonKey: env.BUTTERBASE_ANON_KEY,
      apiUrl: env.BUTTERBASE_API_URL,
      appId: env.BUTTERBASE_APP_ID,
    },
    logLevel: env.LOG_LEVEL,
    port: env.PORT,
    rocketrideUri: env.ROCKETRIDE_URI,
    spectrumProvider: env.SPECTRUM_PROVIDER,
    xtrace: {
      apiKey: env.XTRACE_API_KEY,
      orgId: env.XTRACE_ORG_ID,
    },
  });

  if (!result.success) {
    throw new ConfigError(result.error.issues);
  }

  return result.data;
};
