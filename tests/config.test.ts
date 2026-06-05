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
    expect(APP_ROOT).toEqual(expect.stringContaining("Par"));
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
      orgId: "org_example",
    });
  });

  it("throws an actionable error for invalid values", () => {
    expect(() => {
      loadConfig({ PORT: "not-a-port" });
    }).toThrow(ConfigError);
  });
});
