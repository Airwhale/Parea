import { describe, expect, it } from "vitest";

import { createXTraceMemory } from "../src/xtraceMemory.js";

import type {
  IngestJob,
  IngestOptions,
  IngestRequest,
  Memory as XTraceMemoryRecord,
  MemoryStatus,
  SearchListEnvelope,
  SearchRequest,
} from "@xtraceai/memory";
import type { XTraceMemoryClient } from "../src/xtraceMemory.js";

const timestamp = "2026-06-05T19:00:00.000Z";

type FakeClientOptions = {
  ingestJobs?: IngestJob[];
  omitSearchData?: boolean;
  pollJobs?: IngestJob[];
  searchData?: SearchListEnvelope["data"];
};

type FakeXTraceMemoryClient = XTraceMemoryClient & {
  ingestCalls: IngestRequest[];
  ingestOptions: Array<IngestOptions | undefined>;
  pollCalls: string[];
  searchCalls: SearchRequest[];
};

const createJob = ({
  id,
  refs = [],
  status = "succeeded",
}: {
  id: string;
  refs?: { id: string; text: string }[];
  status?: IngestJob["status"];
}): IngestJob => ({
  created_at: timestamp,
  error:
    status === "failed"
      ? {
          code: "xtrace_failed",
          message: "memory extraction failed",
        }
      : null,
  id,
  object: "ingest_job",
  result:
    status === "succeeded"
      ? {
          ignored_group_ids: [],
          memories_created: refs.map((ref) => ({
            id: ref.id,
            text: ref.text,
            type: "fact",
          })),
          memories_superseded_by: {},
          memories_updated: [],
          object: "ingest_result",
          stage_timings: {},
        }
      : null,
  status,
  updated_at: timestamp,
});

const factMemory = (input: {
  id: string;
  score?: number | null | undefined;
  status?: MemoryStatus | null;
  text: string;
}): XTraceMemoryRecord => {
  const score = "score" in input ? input.score : 0.88;

  return {
  agent_id: "parea-wander",
  app_id: "parea",
  categories: [],
  conv_id: "parea_wander_group_test",
  created_at: timestamp,
  details: {
    artifact_id: null,
    artifact_ids: [],
    episode_id: null,
    fact_type: "belief",
    source_event_ids: [],
    source_role: "user",
    status: input.status ?? "active",
    supersedes: null,
  },
  group_ids: [],
  id: input.id,
  object: "memory",
  score: score ?? null,
  text: input.text,
  type: "fact",
  updated_at: timestamp,
  user_id: "group_test",
  };
};

const createFakeClient = ({
  ingestJobs = [],
  omitSearchData = false,
  pollJobs = [],
  searchData = [],
}: FakeClientOptions = {}): FakeXTraceMemoryClient => {
  const ingestCalls: IngestRequest[] = [];
  const ingestOptions: Array<IngestOptions | undefined> = [];
  const pollCalls: string[] = [];
  const searchCalls: SearchRequest[] = [];

  return {
    ingestCalls,
    ingestOptions,
    memories: {
      ingest: async (body, options) => {
        ingestCalls.push(body);
        ingestOptions.push(options);
        return ingestJobs.shift() ?? createJob({ id: "job_default" });
      },
      jobs: {
        pollUntilDone: async (jobId) => {
          pollCalls.push(jobId);
          return pollJobs.shift() ?? createJob({ id: jobId });
        },
      },
      search: async (body): Promise<SearchListEnvelope> => {
        searchCalls.push(body);
        const envelope: SearchListEnvelope = {
          data: searchData,
          has_more: false,
          next_cursor: null,
          object: "list",
        };

        if (omitSearchData) {
          delete (envelope as Partial<SearchListEnvelope>).data;
        }

        return envelope;
      },
    },
    pollCalls,
    searchCalls,
  };
};

describe("createXTraceMemory", () => {
  it("ingests the seed belief through the XTrace memory SDK", async () => {
    const client = createFakeClient({
      ingestJobs: [
        createJob({
          id: "job_seed",
          refs: [
            {
              id: "mem_seed",
              text: "Group group_test fits a mellow adventure.",
            },
          ],
        }),
      ],
    });
    const memory = createXTraceMemory({
      apiKey: "xtk_test",
      client,
      orgId: "org_test",
    });

    await expect(
      memory.seedBelief({
        adventureTitle: "Presidio Stroll",
        groupId: "group_test",
        vibe: "mellow",
        zone: {
          centerLat: 37.8,
          centerLng: -122.4,
          radiusM: 350,
        },
      }),
    ).resolves.toEqual({
      groupId: "group_test",
      summary: "Group group_test fits a mellow adventure.",
      xtraceId: "mem_seed",
    });

    expect(client.ingestCalls).toHaveLength(1);
    expect(client.ingestCalls[0]).toMatchObject({
      agent_id: "parea-wander",
      app_id: "parea",
      conv_id: "parea_wander_group_test",
      extract_artifacts: false,
      user_id: "group_test",
    });
    expect(client.ingestCalls[0]?.messages[0]?.content).toContain(
      "Presidio Stroll",
    );
    expect(client.ingestOptions[0]).toEqual({ wait: true });
  });

  it("ingests a contradiction and waits for async extraction", async () => {
    const client = createFakeClient({
      ingestJobs: [createJob({ id: "job_pending", status: "pending" })],
      pollJobs: [
        createJob({
          id: "job_pending",
          refs: [
            {
              id: "mem_revised",
              text: "Group group_test now fits a foodie reroute.",
            },
          ],
        }),
      ],
    });
    const memory = createXTraceMemory({
      apiKey: "xtk_test",
      client,
      orgId: "org_test",
      rerouteVibe: "foodie",
    });

    await expect(
      memory.contradict({
        groupId: "group_test",
        observation: "Group group_test left the Presidio Stroll zone.",
      }),
    ).resolves.toEqual({
      groupId: "group_test",
      summary: "Group group_test now fits a foodie reroute.",
      xtraceId: "mem_revised",
    });

    expect(client.pollCalls).toEqual(["job_pending"]);
    expect(client.ingestCalls[0]?.messages[0]?.content).toContain(
      "foodie reroute",
    );
    expect(client.ingestCalls[0]?.messages[0]?.content).toContain("superseded");
  });

  it("reads back active beliefs and maps XTrace status to local belief state", async () => {
    const client = createFakeClient({
      searchData: [
        factMemory({
          id: "mem_active",
          text: "Group group_test now fits a foodie reroute.",
        }),
        factMemory({
          id: "mem_old",
          status: "superseded",
          text: "Group group_test fits a mellow adventure.",
        }),
        factMemory({
          id: "mem_retracted",
          status: "retracted",
          text: "Group group_test fits an active adventure.",
        }),
      ],
    });
    const memory = createXTraceMemory({
      apiKey: "xtk_test",
      client,
      orgId: "org_test",
    });

    await expect(memory.current("group_test")).resolves.toEqual([
      {
        confidence: 0.88,
        groupId: "group_test",
        id: "mem_active",
        status: "active",
        summary: "Group group_test now fits a foodie reroute.",
        vibe: "foodie",
      },
    ]);
    expect(client.searchCalls).toEqual([
      {
        agent_id: "parea-wander",
        app_id: "parea",
        limit: 10,
        mode: "retrieve",
        query: "current active Parea Wander adventure-fit belief",
        user_id: "group_test",
      },
    ]);
  });

  it("defaults missing scores and empty search payloads safely", async () => {
    const emptyClient = createFakeClient({
      omitSearchData: true,
    });
    const emptyMemory = createXTraceMemory({
      apiKey: "xtk_test",
      client: emptyClient,
      orgId: "org_test",
    });

    await expect(emptyMemory.current("group_test")).resolves.toEqual([]);

    const missingScoreRecord = factMemory({
      id: "mem_without_score",
      text: "Group group_test now fits a foodie reroute.",
    });
    delete (missingScoreRecord as Partial<XTraceMemoryRecord>).score;

    const missingScoreClient = createFakeClient({
      searchData: [
        missingScoreRecord,
      ],
    });
    const missingScoreMemory = createXTraceMemory({
      apiKey: "xtk_test",
      client: missingScoreClient,
      orgId: "org_test",
    });

    await expect(missingScoreMemory.current("group_test")).resolves.toEqual([
      {
        confidence: 0.5,
        groupId: "group_test",
        id: "mem_without_score",
        status: "active",
        summary: "Group group_test now fits a foodie reroute.",
        vibe: "foodie",
      },
    ]);
  });

  it("surfaces failed ingest jobs as actionable errors", async () => {
    const client = createFakeClient({
      ingestJobs: [createJob({ id: "job_failed", status: "failed" })],
    });
    const memory = createXTraceMemory({
      apiKey: "xtk_test",
      client,
      orgId: "org_test",
    });

    await expect(
      memory.seedBelief({
        adventureTitle: "Presidio Stroll",
        groupId: "group_test",
        vibe: "mellow",
        zone: {
          centerLat: 37.8,
          centerLng: -122.4,
          radiusM: 350,
        },
      }),
    ).rejects.toThrow("XTrace memory ingest failed");
  });
});
