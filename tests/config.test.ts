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
      rocketride: {
        uri: "http://localhost:5565",
      },
      spectrum: {
        slack: {},
      },
      spectrumProvider: "terminal",
      venues: {
        overpassApiUrl: "https://overpass-api.de/api/interpreter",
        source: "stub",
      },
    });
    expect(existsSync(join(APP_ROOT, "package.json"))).toBe(true);
  });

  it("parses explicit environment values", () => {
    const config = loadConfig({
      APP_ENV: "test",
      BUTTERBASE_API_URL: "https://api.butterbase.ai",
      LOG_LEVEL: "debug",
      OVERPASS_API_URL: "https://overpass.example/api/interpreter",
      PORT: "4123",
      ROCKETRIDE_ADVENTURE_PIPELINE: "pipelines/parea-adventure.pipe",
      ROCKETRIDE_APIKEY: "rrk_example",
      ROCKETRIDE_URI: "http://localhost:5565",
      SLACK_BOT_TOKEN: "xoxb-example",
      SLACK_CHANNEL: "C123",
      SLACK_TEAM_ID: "T123",
      SPECTRUM_PROJECT_ID: "project_example",
      SPECTRUM_PROJECT_SECRET: "secret_example",
      SPECTRUM_PROVIDER: "terminal",
      VENUE_SOURCE: "overpass",
      XTRACE_API_KEY: "xtk_example",
      XTRACE_ORG_ID: "org_example",
    });

    expect(config.port).toBe(4123);
    expect(config.rocketride).toEqual({
      adventurePipelinePath: "pipelines/parea-adventure.pipe",
      apiKey: "rrk_example",
      uri: "http://localhost:5565",
    });
    expect(config.venues).toEqual({
      overpassApiUrl: "https://overpass.example/api/interpreter",
      source: "overpass",
    });
    expect(config.spectrum).toEqual({
      projectId: "project_example",
      projectSecret: "secret_example",
      slack: {
        botToken: "xoxb-example",
        channel: "C123",
        endpoint: undefined,
        teamId: "T123",
      },
    });
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
      ROCKETRIDE_ADVENTURE_PIPELINE: " ",
      ROCKETRIDE_APIKEY: " ",
      ROCKETRIDE_URI: "",
      SPECTRUM_PROVIDER: "",
      SPECTRUM_PROJECT_ID: "",
      SPECTRUM_PROJECT_SECRET: "",
      VENUE_SOURCE: "",
    });

    expect(config).toMatchObject({
      appEnv: "development",
      butterbase: {
        apiUrl: "https://api.butterbase.ai",
      },
      logLevel: "info",
      port: 3000,
      rocketride: {
        uri: "http://localhost:5565",
      },
      spectrumProvider: "terminal",
      venues: {
        source: "stub",
      },
    });
    expect(config.rocketride.apiKey).toBeUndefined();
    expect(config.rocketride.adventurePipelinePath).toBeUndefined();
    expect(config.spectrum.projectId).toBeUndefined();
    expect(config.spectrum.projectSecret).toBeUndefined();
    expect(config.spectrum.slack.botToken).toBeUndefined();
    expect(config.xtrace.apiUrl).toBe("https://api.production.xtrace.ai");
    expect(config.butterbase.appId).toBeUndefined();
  });

  it("throws an actionable error for invalid values", () => {
    expect(() => {
      loadConfig({ PORT: "not-a-port" });
    }).toThrow(ConfigError);
  });
});
