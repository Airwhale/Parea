import "dotenv/config";

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Spectrum } from "spectrum-ts";
import { slack } from "spectrum-ts/providers/slack";
import { terminal } from "spectrum-ts/providers/terminal";

import { ConfigError, loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createRuntimeDeps } from "./runtime.js";
import {
  createTerminalSessionController,
  formatTerminalOutMessage,
  TERMINAL_HELP_MESSAGE,
} from "./terminalSession.js";

import type { AppConfig } from "./config.js";
import type { Message, PlatformProviderConfig } from "spectrum-ts";

const TERMINAL_COMMANDS: { description: string; name: string }[] = [
  { description: "Show Parea terminal commands.", name: "/help" },
  { description: "Choose a vibe for a new Wander.", name: "/start" },
  { description: "Join the terminal group.", name: "/join" },
  { description: "Pick mellow, foodie, cultural, or active.", name: "/vibe" },
  { description: "Simulate a location update.", name: "/move" },
  { description: "Show the current session state.", name: "/status" },
];

const extractTextContent = (message: Message): string | undefined => {
  const { content } = message;

  if (content.type !== "text") {
    return undefined;
  }

  return content.text;
};

const createSlackProvider = (
  config: AppConfig["spectrum"],
): PlatformProviderConfig => {
  const { botToken, endpoint, teamId } = config.slack;

  if (botToken !== undefined && teamId !== undefined) {
    return slack.config({
      ...(endpoint === undefined ? {} : { endpoint }),
      tokens: {
        [teamId]: botToken,
      },
    }) as unknown as PlatformProviderConfig;
  }

  return slack.config() as unknown as PlatformProviderConfig;
};

const createProvider = (config: AppConfig): PlatformProviderConfig => {
  switch (config.spectrumProvider) {
    case "slack":
      return createSlackProvider(config.spectrum);
    case "terminal":
      return terminal.config({
        commands: TERMINAL_COMMANDS,
      }) as unknown as PlatformProviderConfig;
    case "imessage":
      throw new Error("iMessage is not enabled for this demo branch.");
  }
};

const createSpectrumApp = async (
  config: AppConfig,
  provider: PlatformProviderConfig,
) => {
  const { projectId, projectSecret } = config.spectrum;

  if (projectId !== undefined && projectSecret !== undefined) {
    return Spectrum({
      projectId,
      projectSecret,
      providers: [provider],
      telemetry: false,
    });
  }

  return Spectrum({
    providers: [provider],
    telemetry: false,
  });
};

export const runSpectrumApp = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  const runtime = createRuntimeDeps(config);
  const controller = createTerminalSessionController({
    adventureGen: runtime.adventureGen,
    clock: () => new Date(),
    memory: runtime.memory,
    noiseSigmaM: 0,
    store: runtime.store,
  });
  const provider = createProvider(config);
  const app = await createSpectrumApp(config, provider);

  logger.info({
    fields: {
      butterbaseConfigured: config.butterbase.appId !== undefined,
      rocketrideConfigured:
        config.rocketride.apiKey !== undefined &&
        config.rocketride.adventurePipelinePath !== undefined,
      slackDirectConfigured:
        config.spectrum.slack.botToken !== undefined &&
        config.spectrum.slack.teamId !== undefined,
      spectrumCloudConfigured:
        config.spectrum.projectId !== undefined &&
        config.spectrum.projectSecret !== undefined,
      spectrumProvider: config.spectrumProvider,
      xtraceConfigured:
        config.xtrace.apiKey !== undefined && config.xtrace.orgId !== undefined,
    },
    message: "Spectrum provider ready.",
    phase: "spectrum",
    schemaId: "app.spectrum.v1",
    status: "started",
  });

  for await (const [space, message] of app.messages) {
    try {
      const text = extractTextContent(message);
      const userId = message.sender?.id ?? "message_user";

      await space.responding(async () => {
        if (text === undefined) {
          await message.reply(
            "Parea currently accepts text commands only. Use help for commands.",
          );
          return;
        }

        const replies = await controller.handleText({
          spaceId: space.id,
          text,
          userId,
        });

        for (const reply of replies) {
          await space.send(formatTerminalOutMessage(reply));
        }
      });
    } catch (error) {
      logger.error({
        fields: {
          error: error instanceof Error ? error.message : String(error),
          messageId: message.id,
          spaceId: space.id,
        },
        message: "Failed to process Spectrum message.",
        phase: "spectrum_message",
        schemaId: "app.spectrum.message.v1",
        status: "failed",
      });
    }
  }
};

const isMainModule = (): boolean => {
  const entryPath = process.argv[1];
  return (
    entryPath !== undefined &&
    import.meta.url === pathToFileURL(resolve(entryPath)).href
  );
};

if (isMainModule()) {
  if (process.argv.includes("--help")) {
    console.log(TERMINAL_HELP_MESSAGE);
  } else {
    try {
      await runSpectrumApp();
    } catch (error) {
      if (error instanceof ConfigError) {
        console.error(error.message);
      } else {
        console.error(
          error instanceof Error ? error.message : "Unknown startup error.",
        );
      }

      process.exitCode = 1;
    }
  }
}
