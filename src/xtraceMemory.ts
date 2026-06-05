import { MemoryClient } from "@xtraceai/memory";
import { z } from "zod";

import { createStubMemory } from "./memory.js";
import { BeliefSchema, VibeSchema } from "./schemas.js";

import type {
  IngestJob,
  IngestOptions,
  IngestRequest,
  Memory as XTraceMemoryRecord,
  MemoryClientOptions,
  SearchListEnvelope,
  SearchRequest,
} from "@xtraceai/memory";
import type { AppConfig } from "./config.js";
import type {
  ContradictionInput,
  Memory,
  SeedBeliefInput,
} from "./memory.js";
import type { Belief, BeliefRef, Vibe } from "./schemas.js";

const PAREA_AGENT_ID = "parea-wander";
const PAREA_APP_ID = "parea";
const XTRACE_DEFAULT_BASE_URL = "https://api.production.xtrace.ai";

const XTraceMemoryConfigSchema = z.object({
  agentId: z.string().trim().min(1).default(PAREA_AGENT_ID),
  apiKey: z.string().trim().min(1),
  appId: z.string().trim().min(1).default(PAREA_APP_ID),
  baseUrl: z.string().url().default(XTRACE_DEFAULT_BASE_URL),
  orgId: z.string().trim().min(1),
  rerouteVibe: VibeSchema.default("foodie"),
});

export type XTraceMemoryConfig = z.infer<typeof XTraceMemoryConfigSchema>;

type XTraceMemoriesClient = {
  ingest: (
    body: IngestRequest,
    options?: IngestOptions,
  ) => Promise<IngestJob>;
  jobs: {
    pollUntilDone: (jobId: string) => Promise<IngestJob>;
  };
  search: (body: SearchRequest) => Promise<SearchListEnvelope>;
};

export type XTraceMemoryClient = {
  memories: XTraceMemoriesClient;
};

export type XTraceMemoryOptions = z.input<typeof XTraceMemoryConfigSchema> & {
  client?: XTraceMemoryClient;
};

const VIBES = [
  "mellow",
  "foodie",
  "cultural",
  "active",
] as const satisfies readonly Vibe[];
const VIBE_REGEXES = new Map<Vibe, RegExp>(
  VIBES.map((vibe) => [vibe, new RegExp(`\\b${vibe}\\b`, "i")]),
);

const conversationIdForGroup = (groupId: string): string =>
  `parea_wander_${groupId}`;

const clampConfidence = (value: number | null | undefined): number => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, value));
};

const extractVibe = (text: string | null | undefined): Vibe | undefined => {
  if (text === null || text === undefined) {
    return undefined;
  }

  return VIBES.find((vibe) => VIBE_REGEXES.get(vibe)?.test(text));
};

const jobMemoryRefs = (job: IngestJob) => [
  ...(job.result?.memories_updated ?? []),
  ...(job.result?.memories_created ?? []),
];

const assertTerminalJob = (job: IngestJob): IngestJob => {
  if (job.status === "failed") {
    throw new Error(
      `XTrace memory ingest failed: ${job.error?.message ?? "unknown error"}`,
    );
  }

  return job;
};

const waitForTerminalJob = async (
  client: XTraceMemoryClient,
  job: IngestJob,
): Promise<IngestJob> => {
  if (job.status === "succeeded" || job.status === "failed") {
    return assertTerminalJob(job);
  }

  return assertTerminalJob(await client.memories.jobs.pollUntilDone(job.id));
};

const beliefRefFromJob = (
  groupId: string,
  job: IngestJob,
  fallbackSummary: string,
): BeliefRef => {
  const ref = jobMemoryRefs(job).at(0);

  return {
    groupId,
    summary: ref?.text ?? fallbackSummary,
    xtraceId: ref?.id ?? job.id,
  };
};

const xtraceStatusToBeliefStatus = (
  record: XTraceMemoryRecord,
): Belief["status"] => {
  if (record.type !== "fact") {
    return "active";
  }

  switch (record.details.status) {
    case "retracted":
      return "retracted";
    case "superseded":
      return "revised";
    case "active":
    case null:
    default:
      return "active";
  }
};

const recordToBelief = (groupId: string, record: XTraceMemoryRecord): Belief =>
  BeliefSchema.parse({
    confidence: clampConfidence(record.score),
    groupId,
    id: record.id,
    status: xtraceStatusToBeliefStatus(record),
    summary: record.text,
    vibe: extractVibe(record.text),
  });

const createdAtTimestamp = (record: XTraceMemoryRecord): number => {
  const timestamp = Date.parse(record.created_at ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const buildClient = (config: XTraceMemoryConfig): XTraceMemoryClient => {
  const options: MemoryClientOptions = {
    apiKey: config.apiKey,
    orgId: config.orgId,
  };

  if (config.baseUrl !== XTRACE_DEFAULT_BASE_URL) {
    options.baseUrl = config.baseUrl;
  }

  return new MemoryClient(options);
};

const seedMessage = ({ adventureTitle, groupId, vibe, zone }: SeedBeliefInput) =>
  [
    "Please remember this durable fact for Parea Wander:",
    `${groupId} is a group that currently fits a ${vibe} adventure named ${adventureTitle} inside a ${zone.radiusM} meter zone.`,
    "This is an active adventure-fit belief with confidence 0.82.",
    `The noised public adventure zone center is ${zone.centerLat}, ${zone.centerLng}.`,
  ].join(" ");

const contradictionMessage = (
  { groupId, observation }: ContradictionInput,
  rerouteVibe: Vibe,
) =>
  [
    "Please remember this corrected durable fact for Parea Wander:",
    `${groupId} received a zone-exit contradiction.`,
    observation,
    "The previous adventure-fit belief is superseded.",
    `The group now fits a ${rerouteVibe} reroute.`,
    "The revised belief confidence is 0.88.",
  ].join(" ");

export const createXTraceMemory = (options: XTraceMemoryOptions): Memory => {
  const config = XTraceMemoryConfigSchema.parse(options);
  const client = options.client ?? buildClient(config);

  const ingest = async (
    groupId: string,
    content: string,
  ): Promise<IngestJob> => {
    const job = await client.memories.ingest(
      {
        agent_id: config.agentId,
        app_id: config.appId,
        conv_id: conversationIdForGroup(groupId),
        extract_artifacts: false,
        messages: [{ content, role: "user" }],
        user_id: groupId,
      },
      { wait: true },
    );

    return waitForTerminalJob(client, job);
  };

  return {
    contradict: async (input) => {
      const summary = contradictionMessage(input, config.rerouteVibe);
      const job = await ingest(input.groupId, summary);
      return beliefRefFromJob(input.groupId, job, summary);
    },
    current: async (groupId) => {
      const result = await client.memories.search({
        agent_id: config.agentId,
        app_id: config.appId,
        limit: 10,
        mode: "retrieve",
        query: "current active Parea Wander adventure-fit belief",
        user_id: groupId,
      });

      return (result.data ?? [])
        .filter((record) => record.type === "fact")
        .sort(
          (left, right) => createdAtTimestamp(left) - createdAtTimestamp(right),
        )
        .map((record) => recordToBelief(groupId, record))
        .filter(
          (belief) => belief.status === "active" && belief.vibe !== undefined,
        );
    },
    seedBelief: async (input) => {
      const summary = seedMessage(input);
      const job = await ingest(input.groupId, summary);
      return beliefRefFromJob(input.groupId, job, summary);
    },
  };
};

export const createConfiguredMemory = (
  config: AppConfig["xtrace"],
): Memory => {
  if (config.apiKey === undefined || config.orgId === undefined) {
    return createStubMemory();
  }

  return createXTraceMemory({
    apiKey: config.apiKey,
    baseUrl: config.apiUrl,
    orgId: config.orgId,
  });
};
