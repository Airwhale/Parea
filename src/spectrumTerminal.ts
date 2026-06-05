import "dotenv/config";

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Spectrum } from "spectrum-ts";
import { terminal } from "spectrum-ts/providers/terminal";

import { ConfigError, loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import {
  createTerminalSessionController,
  formatTerminalOutMessage,
  TERMINAL_HELP_MESSAGE,
} from "./terminalSession.js";

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

export const runSpectrumTerminal = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  const controller = createTerminalSessionController();
  const terminalProvider = terminal.config({
    commands: TERMINAL_COMMANDS,
  }) as unknown as PlatformProviderConfig;
  const app = await Spectrum({
    providers: [terminalProvider],
    telemetry: false,
  });

  logger.info({
    fields: {
      spectrumProvider: config.spectrumProvider,
    },
    message: "Spectrum terminal provider ready.",
    phase: "spectrum_terminal",
    schemaId: "app.spectrum_terminal.v1",
    status: "started",
  });

  for await (const [space, message] of app.messages) {
    const text = extractTextContent(message);
    const userId = message.sender?.id ?? "terminal_user";

    await space.responding(async () => {
      if (text === undefined) {
        await message.reply(
          "Parea terminal currently accepts text commands only. Use help for commands.",
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
      await runSpectrumTerminal();
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
