import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { runSpectrumApp } from "./spectrumApp.js";
import { TERMINAL_HELP_MESSAGE } from "./terminalSession.js";

export { runSpectrumApp as runSpectrumTerminal } from "./spectrumApp.js";

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
      console.error(
        error instanceof Error ? error.message : "Unknown startup error.",
      );
      process.exitCode = 1;
    }
  }
}
