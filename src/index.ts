import "dotenv/config";

import { ConfigError, loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { runStubDemo } from "./stubDemo.js";
import { createConfiguredMemory } from "./xtraceMemory.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  const xtraceConfigured =
    config.xtrace.apiKey !== undefined && config.xtrace.orgId !== undefined;

  logger.info({
    fields: {
      appEnv: config.appEnv,
      port: config.port,
      spectrumProvider: config.spectrumProvider,
      xtraceConfigured,
    },
    message: "Parea Wander bootstrap ready.",
    phase: "boot",
    schemaId: "app.config.v1",
    status: "succeeded",
  });

  const result = await runStubDemo({
    memory: createConfiguredMemory(config.xtrace),
    printToConsole: true,
  });
  logger.info({
    fields: {
      rerouted: result.rerouted,
    },
    message: "Stub Wander loop completed.",
    phase: "stub_demo",
    schemaId: "app.stub_demo.v1",
    status: "succeeded",
  });
};

try {
  await main();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(
      JSON.stringify({
        issues: error.issues,
        level: "error",
        message: error.message,
        phase: "config",
        status: "failed",
        timestamp: new Date().toISOString(),
      }),
    );
    process.exitCode = 1;
  } else {
    console.error(
      JSON.stringify({
        level: "error",
        message: error instanceof Error ? error.message : String(error),
        phase: "boot",
        stack: error instanceof Error ? error.stack : undefined,
        status: "failed",
        timestamp: new Date().toISOString(),
      }),
    );
    process.exitCode = 1;
  }
}
