import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { Question, RocketRideClient } from "rocketride";
import { z } from "zod";

import { APP_ROOT } from "./config.js";
import {
  AdventureGenerateInputSchema,
  AdventureSchema,
  VenueSchema,
} from "./schemas.js";
import { VIBE_QUERIES } from "./vibes.js";

import type { AppConfig } from "./config.js";
import type { Adventure, AdventureGenerateInput, Venue } from "./schemas.js";
import type { VenueSource } from "./venues.js";
import type { PIPELINE_RESULT } from "rocketride";

type RocketRideGenerationClient = {
  chat: (options: {
    question: Question;
    token: string;
  }) => Promise<PIPELINE_RESULT | undefined>;
  connect: () => Promise<unknown>;
  disconnect: () => Promise<void>;
  terminate: (token: string) => Promise<void>;
  use: (options: {
    filepath: string;
    name?: string;
    source?: string;
    ttl?: number;
  }) => Promise<Record<string, unknown> & { token: string }>;
};

type RocketRideClientFactory = () => RocketRideGenerationClient;

export type { RocketRideGenerationClient };

export type RocketRideAdventureGenOptions = {
  apiKey: string;
  clientFactory?: RocketRideClientFactory;
  pipelinePath: string;
  pipelineSource?: string;
  promptPath?: string;
  ttlSeconds?: number;
  uri: string;
  venueSearchRadiusM?: number;
  venueSource: VenueSource;
};

const DEFAULT_PIPELINE_SOURCE = "chat_1";
const DEFAULT_PROMPT_PATH = join(APP_ROOT, "prompts", "adventure-generation.md");
const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_VENUE_SEARCH_RADIUS_M = 1_500;

const PromptVariablesSchema = z.object({
  belief: z.string(),
  groupId: z.string(),
  lat: z.string(),
  lng: z.string(),
  outputSchemaJson: z.string(),
  venuesJson: z.string(),
  vibe: z.string(),
});

const RocketRideResultSchema = z
  .object({
    adventure: z.unknown().optional(),
    answers: z.array(z.unknown()).optional(),
    data: z.unknown().optional(),
    output: z.unknown().optional(),
    result: z.unknown().optional(),
    text: z.unknown().optional(),
  })
  .passthrough();

const AdventureOutputSchema = z.object({
  beats: z.array(
    z.object({
      order: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      prompt: z.string(),
      venue: VenueSchema,
    }),
  ),
  groupId: z.string(),
  id: z.string(),
  title: z.string(),
  vibe: z.string(),
  zone: z.object({
    centerLat: z.number(),
    centerLng: z.number(),
    radiusM: z.number(),
  }),
});

const toAbsolutePath = (path: string): string =>
  isAbsolute(path) ? path : join(APP_ROOT, path);

const buildOutputSchemaJson = (): string =>
  JSON.stringify(
    {
      beats: [
        {
          order: 1,
          prompt: "string",
          venue: {
            category: "string",
            lat: "number",
            lng: "number",
            name: "string",
            openNow: "boolean optional",
            rating: "number optional, 0 through 5",
          },
        },
        {
          order: 2,
          prompt: "string",
          venue: "same shape as beat 1 venue",
        },
        {
          order: 3,
          prompt: "string",
          venue: "same shape as beat 1 venue",
        },
      ],
      groupId: "string",
      id: "string",
      title: "string",
      vibe: "mellow | foodie | cultural | active",
      zone: {
        centerLat: "number",
        centerLng: "number",
        radiusM: 350,
      },
    },
    null,
    2,
  );

const replaceTemplateVariables = (
  template: string,
  variables: z.infer<typeof PromptVariablesSchema>,
): string => {
  const validated = PromptVariablesSchema.parse(variables);
  const rendered = Object.entries(validated).reduce(
    (current, [key, value]) => current.replaceAll(`{{${key}}}`, value),
    template,
  );
  const leftover = rendered.match(/\{\{[A-Za-z0-9_]+\}\}/u);

  if (leftover !== null) {
    throw new Error(`Unknown adventure prompt variable ${leftover[0]}.`);
  }

  return rendered;
};

export const renderAdventurePrompt = async ({
  input,
  promptPath = DEFAULT_PROMPT_PATH,
  venues,
}: {
  input: AdventureGenerateInput;
  promptPath?: string;
  venues: readonly Venue[];
}): Promise<string> => {
  const template = await readFile(promptPath, "utf8");

  return replaceTemplateVariables(template, {
    belief: input.belief ?? "none",
    groupId: input.groupId,
    lat: input.lat.toFixed(6),
    lng: input.lng.toFixed(6),
    outputSchemaJson: buildOutputSchemaJson(),
    venuesJson: JSON.stringify(venues, null, 2),
    vibe: input.vibe,
  });
};

const parseJsonString = (value: string): unknown => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/u);
  const raw = fenced?.[1] ?? trimmed;

  return JSON.parse(raw);
};

const parseAdventureCandidate = (
  candidate: unknown,
  input: AdventureGenerateInput,
): Adventure | undefined => {
  if (candidate === undefined || candidate === null) {
    return undefined;
  }

  if (typeof candidate === "string") {
    let parsed: unknown;
    try {
      parsed = parseJsonString(candidate);
    } catch {
      return undefined;
    }

    return parseAdventureCandidate(parsed, input);
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const parsed = parseAdventureCandidate(item, input);
      if (parsed !== undefined) {
        return parsed;
      }
    }

    return undefined;
  }

  const nested = z
    .object({
      adventure: z.unknown().optional(),
    })
    .passthrough()
    .safeParse(candidate);

  if (nested.success && nested.data.adventure !== undefined) {
    return parseAdventureCandidate(nested.data.adventure, input);
  }

  const loose = AdventureOutputSchema.safeParse(candidate);
  if (!loose.success) {
    return undefined;
  }

  const adventure = AdventureSchema.parse(loose.data);
  if (adventure.groupId !== input.groupId) {
    throw new Error(
      `RocketRide returned adventure for ${adventure.groupId}, expected ${input.groupId}.`,
    );
  }

  return adventure;
};

export const parseRocketRideAdventureResult = (
  result: PIPELINE_RESULT | undefined,
  input: AdventureGenerateInput,
): Adventure => {
  const parsed = RocketRideResultSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error("RocketRide returned an empty or malformed result.");
  }

  const candidates = [
    parsed.data.adventure,
    parsed.data.data,
    parsed.data.result,
    parsed.data.output,
    parsed.data.answers,
    parsed.data.text,
    result,
  ];

  for (const candidate of candidates) {
    const adventure = parseAdventureCandidate(candidate, input);
    if (adventure !== undefined) {
      return adventure;
    }
  }

  throw new Error("RocketRide result did not contain a valid adventure JSON.");
};

export const createRocketRideAdventureGen = ({
  apiKey,
  clientFactory = () =>
    new RocketRideClient({
      auth: apiKey,
      requestTimeout: 60_000,
      uri,
    }),
  pipelinePath,
  pipelineSource = DEFAULT_PIPELINE_SOURCE,
  promptPath = DEFAULT_PROMPT_PATH,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  uri,
  venueSearchRadiusM = DEFAULT_VENUE_SEARCH_RADIUS_M,
  venueSource,
}: RocketRideAdventureGenOptions) => ({
  generate: async (rawInput: AdventureGenerateInput): Promise<Adventure> => {
    const input = AdventureGenerateInputSchema.parse(rawInput);
    const venues = await venueSource.search({
      categories: VIBE_QUERIES[input.vibe],
      lat: input.lat,
      lng: input.lng,
      openNow: true,
      radiusM: venueSearchRadiusM,
    });

    if (venues.length < 3) {
      throw new Error(
        `RocketRide generation needs at least 3 venues, got ${venues.length}.`,
      );
    }

    const prompt = await renderAdventurePrompt({
      input,
      promptPath,
      venues: venues.slice(0, 8),
    });
    const question = new Question({ expectJson: true });
    question.addInstruction("Parea Wander adventure contract", prompt);
    question.addQuestion("Generate the Parea Wander adventure JSON.");

    const client = clientFactory();
    let token: string | undefined;

    try {
      await client.connect();
      const pipeline = await client.use({
        filepath: toAbsolutePath(pipelinePath),
        name: `parea-adventure-${input.groupId}`,
        source: pipelineSource,
        ttl: ttlSeconds,
      });
      token = pipeline.token;
      const result = await client.chat({ question, token });

      return parseRocketRideAdventureResult(result, input);
    } finally {
      try {
        if (token !== undefined) {
          await client.terminate(token);
        }
      } finally {
        await client.disconnect();
      }
    }
  },
});

export const createConfiguredAdventureGen = ({
  rocketride,
  venueSource,
}: {
  rocketride: AppConfig["rocketride"];
  venueSource: VenueSource;
}) => {
  if (
    rocketride.apiKey !== undefined &&
    rocketride.adventurePipelinePath !== undefined
  ) {
    return createRocketRideAdventureGen({
      apiKey: rocketride.apiKey,
      pipelinePath: rocketride.adventurePipelinePath,
      uri: rocketride.uri,
      venueSource,
    });
  }

  return undefined;
};
