import { ConfigError, loadConfig } from "./config.js";
import { createLogger } from "./logger.js";

const main = (): void => {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });

  logger.info({
    fields: {
      appEnv: config.appEnv,
      port: config.port,
      spectrumProvider: config.spectrumProvider,
    },
    message: "Parea Wander bootstrap ready.",
    phase: "boot",
    schemaId: "app.config.v1",
    status: "succeeded",
  });
};

try {
  main();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(
      JSON.stringify({
        issues: error.issues,
        level: "error",
        message: error.message,
        phase: "config",
        status: "failed",
      }),
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
}
