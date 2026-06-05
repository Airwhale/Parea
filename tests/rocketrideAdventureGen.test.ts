import { describe, expect, it } from "vitest";

import {
  createRocketRideAdventureGen,
  parseRocketRideAdventureResult,
  renderAdventurePrompt,
} from "../src/rocketrideAdventureGen.js";

import type { Adventure, AdventureGenerateInput, Venue } from "../src/schemas.js";
import type {
  RocketRideGenerationClient,
} from "../src/rocketrideAdventureGen.js";
import type { VenueSource } from "../src/venues.js";
import type { PIPELINE_RESULT } from "rocketride";

const input: AdventureGenerateInput = {
  groupId: "group_rocketride",
  lat: 37.7952,
  lng: -122.4078,
  vibe: "foodie",
};

const venues: readonly [Venue, Venue, Venue] = [
  {
    category: "dim_sum",
    lat: 37.795,
    lng: -122.407,
    name: "Good Mong Kok Bakery",
  },
  {
    category: "tea_house",
    lat: 37.7955,
    lng: -122.4078,
    name: "Vital Tea Leaf",
  },
  {
    category: "bakery",
    lat: 37.7958,
    lng: -122.4074,
    name: "Golden Gate Bakery",
  },
];

const adventure: Adventure = {
  beats: [
    {
      order: 1,
      prompt: "Pick one dim sum bite to split.",
      venue: venues[0],
    },
    {
      order: 2,
      prompt: "Choose tea for the group.",
      venue: venues[1],
    },
    {
      order: 3,
      prompt: "End with a bakery favorite.",
      venue: venues[2],
    },
  ],
  groupId: input.groupId,
  id: "adv_foodie_group_rocketride",
  title: "Chinatown Snack Quest",
  vibe: "foodie",
  zone: {
    centerLat: input.lat,
    centerLng: input.lng,
    radiusM: 350,
  },
};

describe("renderAdventurePrompt", () => {
  it("renders the versioned prompt without dangling variables", async () => {
    const prompt = await renderAdventurePrompt({
      input,
      venues,
    });

    expect(prompt).toContain("group_rocketride");
    expect(prompt).toContain("Good Mong Kok Bakery");
    expect(prompt).not.toMatch(/\{\{[A-Za-z0-9_]+\}\}/u);
  });
});

describe("parseRocketRideAdventureResult", () => {
  it("extracts adventure JSON from RocketRide answers", () => {
    const result: PIPELINE_RESULT = {
      answers: [`\`\`\`json\n${JSON.stringify(adventure)}\n\`\`\``],
      name: "result",
      objectId: "object",
      path: "",
    };

    expect(parseRocketRideAdventureResult(result, input)).toEqual(adventure);
  });

  it("rejects adventures for the wrong group", () => {
    const result: PIPELINE_RESULT = {
      answers: [
        JSON.stringify({
          ...adventure,
          groupId: "group_other",
        }),
      ],
      name: "result",
      objectId: "object",
      path: "",
    };

    expect(() => parseRocketRideAdventureResult(result, input)).toThrow(
      "expected group_rocketride",
    );
  });
});

describe("createRocketRideAdventureGen", () => {
  it("starts the configured pipeline, sends a question, and cleans up", async () => {
    const calls: string[] = [];
    const source: VenueSource = {
      search: async () => venues,
    };
    const client: RocketRideGenerationClient = {
      chat: async () => {
        calls.push("chat");
        return {
          answers: [JSON.stringify(adventure)],
          name: "result",
          objectId: "object",
          path: "",
        };
      },
      connect: async () => {
        calls.push("connect");
      },
      disconnect: async () => {
        calls.push("disconnect");
      },
      terminate: async (token) => {
        calls.push(`terminate:${token}`);
      },
      use: async (options) => {
        calls.push(`use:${options.source}:${options.ttl}`);
        expect(options.filepath).toContain("pipelines");
        return { token: "token_test" };
      },
    };
    const generator = createRocketRideAdventureGen({
      apiKey: "rrk_test",
      clientFactory: () => client,
      pipelinePath: "pipelines/parea-adventure.pipe",
      uri: "http://localhost:5565",
      venueSource: source,
    });

    await expect(generator.generate(input)).resolves.toEqual(adventure);
    expect(calls).toEqual([
      "connect",
      "use:chat_1:300",
      "chat",
      "terminate:token_test",
      "disconnect",
    ]);
  });
});
