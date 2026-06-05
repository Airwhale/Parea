import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { AppConfig } from "./config.js";

export const LogEventSchema = z.object({
  durationMs: z.number().nonnegative().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  message: z.string().optional(),
  phase: z.string().min(1),
  runId: z.string().min(1),
  schemaId: z.string().min(1).optional(),
  status: z.enum(["started", "succeeded", "failed", "info"]),
});

export type LogEvent = z.infer<typeof LogEventSchema>;
type LogInput = Omit<z.input<typeof LogEventSchema>, "runId">;
type LogLevel = AppConfig["logLevel"];

type LogSink = Pick<Console, "debug" | "error" | "info" | "warn">;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  error: 40,
  info: 20,
  silent: 50,
  warn: 30,
};

export type Logger = {
  debug: (event: LogInput) => void;
  error: (event: LogInput) => void;
  info: (event: LogInput) => void;
  warn: (event: LogInput) => void;
};

export type LoggerOptions = {
  level?: LogLevel;
  runId?: string;
  sink?: LogSink;
};

export const createLogger = ({
  level = "info",
  runId = randomUUID(),
  sink = console,
}: LoggerOptions = {}): Logger => {
  const emit = (
    eventLevel: Exclude<LogLevel, "silent">,
    event: LogInput,
  ): void => {
    if (levelPriority[eventLevel] < levelPriority[level]) {
      return;
    }

    const parsed = LogEventSchema.safeParse({ ...event, runId });
    if (!parsed.success) {
      sink.error(
        JSON.stringify({
          level: "error",
          message: `Log validation failed: ${parsed.error.message}`,
          phase: "logger",
          runId,
          status: "failed",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    sink[eventLevel](
      JSON.stringify({
        ...parsed.data,
        level: eventLevel,
        timestamp: new Date().toISOString(),
      }),
    );
  };

  return {
    debug: (event) => {
      emit("debug", event);
    },
    error: (event) => {
      emit("error", event);
    },
    info: (event) => {
      emit("info", event);
    },
    warn: (event) => {
      emit("warn", event);
    },
  };
};
