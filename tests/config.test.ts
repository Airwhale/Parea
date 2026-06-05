import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_ROOT, ConfigError, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads defaults for local development", () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      appEnv: "development",
      logLevel: "info",
      port: 3000,
      rocketrideUri: "http://localhost:5565",
      spectrumProvider: "terminal",
    });
    expect(existsSync(join(APP_ROOT, "package.json"))).toBe(true);
  });

  it("parses explicit environment values", () => {
    const config = loadConfig({
      APP_ENV: "test",
      BUTTERBASE_API_URL: "https://api.butterbase.ai",
      LOG_LEVEL: "debug",
      PORT: "4123",
      ROCKETRIDE_URI: "http://localhost:5565",
      SPECTRUM_PROVIDER: "terminal",
      XTRACE_API_KEY: "xtk_example",
      XTRACE_ORG_ID: "org_example",
    });

    expect(config.port).toBe(4123);
    expect(config.xtrace).toEqual({
      apiKey: "xtk_example",
      apiUrl: "https://api.production.xtrace.ai",
      orgId: "org_example",
    });
  });

  it("treats blank environment values as absent", () => {
    const config = loadConfig({
      APP_ENV: "",
      BUTTERBASE_API_URL: "   ",
      BUTTERBASE_APP_ID: "   ",
      LOG_LEVEL: " ",
      PORT: "",
      ROCKETRIDE_URI: "",
      SPECTRUM_PROVIDER: "",
    });

    expect(config).toMatchObject({
      appEnv: "development",
      butterbase: {
        apiUrl: "https://api.butterbase.ai",
      },
      logLevel: "info",
      port: 3000,
      rocketrideUri: "http://localhost:5565",
      spectrumProvider: "terminal",
    });
    expect(config.xtrace.apiUrl).toBe("https://api.production.xtrace.ai");
    expect(config.butterbase.appId).toBeUndefined();
  });

  it("throws an actionable error for invalid values", () => {
    expect(() => {
      loadConfig({ PORT: "not-a-port" });
    }).toThrow(ConfigError);
  });
});
