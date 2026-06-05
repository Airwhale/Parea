import "dotenv/config";

import { ConfigError, loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createRuntimeDeps } from "./runtime.js";
import { runStubDemo } from "./stubDemo.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  const runtime = createRuntimeDeps(config);
  const result = await runStubDemo({
    adventureGen: runtime.adventureGen,
    groupId: `group_full_loop_${Date.now()}`,
    memory: runtime.memory,
    printToConsole: true,
    store: runtime.store,
  });

  logger.info({
    fields: {
      butterbaseConfigured: config.butterbase.appId !== undefined,
      deliveryCount: result.deliveryRecords.length,
      rerouted: result.rerouted,
      rocketrideConfigured:
        config.rocketride.apiKey !== undefined &&
        config.rocketride.adventurePipelinePath !== undefined,
      venueSource: config.venues.source,
      xtraceConfigured:
        config.xtrace.apiKey !== undefined && config.xtrace.orgId !== undefined,
    },
    message: "Full Parea Wander loop smoke completed.",
    phase: "full_loop_smoke",
    schemaId: "app.full_loop_smoke.v1",
    status: result.rerouted ? "succeeded" : "failed",
  });

  if (!result.rerouted || result.deliveryRecords.length < 2) {
    throw new Error("Full loop smoke did not produce a reroute.");
  }
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
  } else {
    console.error(
      JSON.stringify({
        level: "error",
        message: error instanceof Error ? error.message : String(error),
        phase: "full_loop_smoke",
        status: "failed",
        timestamp: new Date().toISOString(),
      }),
    );
  }

  process.exitCode = 1;
}
