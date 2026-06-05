import { describe, expect, it } from "vitest";

import { createLogger } from "../src/logger.js";

describe("createLogger", () => {
  it("writes structured JSON log events", () => {
    const messages: string[] = [];
    const logger = createLogger({
      runId: "run_test",
      sink: {
        debug: (message) => messages.push(message),
        error: (message) => messages.push(message),
        info: (message) => messages.push(message),
        warn: (message) => messages.push(message),
      },
    });

    logger.info({
      fields: { port: 3000 },
      message: "ready",
      phase: "boot",
      schemaId: "app.config.v1",
      status: "succeeded",
    });

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? "{}")).toMatchObject({
      fields: { port: 3000 },
      level: "info",
      message: "ready",
      phase: "boot",
      runId: "run_test",
      schemaId: "app.config.v1",
      status: "succeeded",
    });
  });

  it("respects the configured minimum log level", () => {
    const messages: string[] = [];
    const logger = createLogger({
      level: "warn",
      runId: "run_test",
      sink: {
        debug: (message) => messages.push(message),
        error: (message) => messages.push(message),
        info: (message) => messages.push(message),
        warn: (message) => messages.push(message),
      },
    });

    logger.info({ phase: "boot", status: "info" });
    logger.warn({ phase: "boot", status: "info" });

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? "{}")).toMatchObject({
      level: "warn",
      phase: "boot",
    });
  });

  it("does not throw when a log event is invalid", () => {
    const messages: string[] = [];
    const logger = createLogger({
      runId: "run_test",
      sink: {
        debug: (message) => messages.push(message),
        error: (message) => messages.push(message),
        info: (message) => messages.push(message),
        warn: (message) => messages.push(message),
      },
    });

    expect(() => {
      logger.info({ phase: "", status: "info" });
    }).not.toThrow();

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? "{}")).toMatchObject({
      issues: expect.any(Array),
      level: "error",
      message: "Log validation failed",
      phase: "logger",
      runId: "run_test",
      status: "failed",
    });
  });

  it("does not throw when fields cannot be serialized", () => {
    const messages: string[] = [];
    const logger = createLogger({
      runId: "run_test",
      sink: {
        debug: (message) => messages.push(message),
        error: (message) => messages.push(message),
        info: (message) => messages.push(message),
        warn: (message) => messages.push(message),
      },
    });
    const fields: Record<string, unknown> = {};
    fields.self = fields;

    expect(() => {
      logger.info({ fields, phase: "boot", status: "info" });
    }).not.toThrow();

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? "{}")).toMatchObject({
      level: "error",
      message: expect.stringContaining("Failed to serialize log event"),
      phase: "logger",
      runId: "run_test",
      status: "failed",
    });
  });
});
