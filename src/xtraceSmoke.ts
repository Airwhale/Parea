import "dotenv/config";

import { ConfigError, loadConfig } from "./config.js";
import { createXTraceMemory } from "./xtraceMemory.js";

const printUsage = (): void => {
  console.log(
    [
      "Runs a live XTrace write, contradiction, and read-back smoke.",
      "Required env: XTRACE_API_KEY and XTRACE_ORG_ID.",
      "Usage: npm run xtrace:smoke",
    ].join("\n"),
  );
};

const main = async (): Promise<void> => {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const config = loadConfig();
  if (config.xtrace.apiKey === undefined || config.xtrace.orgId === undefined) {
    throw new Error(
      "XTRACE_API_KEY and XTRACE_ORG_ID are required for the live XTrace smoke.",
    );
  }

  const memory = createXTraceMemory({
    apiKey: config.xtrace.apiKey,
    baseUrl: config.xtrace.apiUrl,
    orgId: config.xtrace.orgId,
  });
  const groupId = `group_xtrace_smoke_${Date.now()}`;

  const seeded = await memory.seedBelief({
    adventureTitle: "Presidio Stroll",
    groupId,
    vibe: "mellow",
    zone: {
      centerLat: 37.80286666769038,
      centerLng: -122.44863333065553,
      radiusM: 350,
    },
  });
  const revised = await memory.contradict({
    groupId,
    observation: `Group ${groupId} left the Presidio Stroll zone.`,
  });
  const current = await memory.current(groupId);

  console.log(
    JSON.stringify(
      {
        current,
        groupId,
        revised,
        seeded,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }

  process.exitCode = 1;
}
