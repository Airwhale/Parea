import { createClient, MemorySessionStorage } from "@butterbase/sdk";
import { z } from "zod";

import {
  AdventureSchema,
  BeliefRefSchema,
  GroupSchema,
} from "./schemas.js";
import { createStubStore } from "./store.js";

import type { ButterbaseResponse } from "@butterbase/sdk";
import type { AppConfig } from "./config.js";
import type { Adventure, BeliefRef, Group, Membership } from "./schemas.js";
import type { Store } from "./store.js";

const TABLES = {
  adventures: "parea_adventures",
  beliefRefs: "parea_belief_refs",
  groups: "parea_groups",
  memberships: "parea_memberships",
} as const;

const GroupRowSchema = z.object({
  created_at: z.string().datetime(),
  id: z.string().trim().min(1),
  initiator_id: z.string().trim().min(1),
  vibe: z.enum(["mellow", "foodie", "cultural", "active"]).nullable(),
});

const AdventureRowSchema = z.object({
  beats: z.unknown(),
  created_at: z.string().datetime(),
  group_id: z.string().trim().min(1),
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  vibe: z.enum(["mellow", "foodie", "cultural", "active"]),
  zone: z.unknown(),
});

const BeliefRefRowSchema = z.object({
  created_at: z.string().datetime(),
  group_id: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  xtrace_id: z.string().trim().min(1),
});

type GroupRow = z.infer<typeof GroupRowSchema>;
type MembershipRow = {
  group_id: string;
  joined_at: string;
  user_id: string;
};
type AdventureRow = z.infer<typeof AdventureRowSchema>;
type BeliefRefRow = z.infer<typeof BeliefRefRowSchema>;

type ButterbaseSelectBuilder<T> = PromiseLike<ButterbaseResponse<T[]>> & {
  eq: (column: string, value: unknown) => ButterbaseSelectBuilder<T>;
  limit: (count: number) => ButterbaseSelectBuilder<T>;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => ButterbaseSelectBuilder<T>;
  select: (columns?: string) => ButterbaseSelectBuilder<T>;
};

type ButterbaseTable<T> = {
  insert: (
    values: Partial<T> | Partial<T>[],
  ) => PromiseLike<ButterbaseResponse<T | T[]>>;
  select: (columns?: string) => ButterbaseSelectBuilder<T>;
};

export type ButterbaseStoreClient = {
  from: <T>(table: string) => ButterbaseTable<T>;
};

export type ButterbaseStoreOptions = {
  anonKey?: string;
  apiUrl: string;
  appId: string;
  client?: ButterbaseStoreClient;
};

const unwrap = <T>(response: ButterbaseResponse<T>, action: string): T => {
  if (response.error !== null) {
    throw new Error(`Butterbase ${action} failed: ${response.error.message}`);
  }

  if (response.data === null) {
    throw new Error(`Butterbase ${action} returned no data.`);
  }

  return response.data;
};

const assertNoError = (
  response: ButterbaseResponse<unknown>,
  action: string,
): void => {
  if (response.error !== null) {
    throw new Error(`Butterbase ${action} failed: ${response.error.message}`);
  }
};

const groupToRow = (group: Group): GroupRow => ({
  created_at: group.createdAt,
  id: group.id,
  initiator_id: group.initiatorId,
  vibe: group.vibe ?? null,
});

const rowToGroup = (row: unknown): Group =>
  GroupSchema.parse({
    createdAt: GroupRowSchema.parse(row).created_at,
    id: GroupRowSchema.parse(row).id,
    initiatorId: GroupRowSchema.parse(row).initiator_id,
    vibe: GroupRowSchema.parse(row).vibe ?? undefined,
  });

const membershipToRow = (membership: Membership): MembershipRow => ({
  group_id: membership.groupId,
  joined_at: membership.joinedAt,
  user_id: membership.userId,
});

const adventureToRow = (adventure: Adventure): AdventureRow => ({
  beats: adventure.beats,
  created_at: new Date().toISOString(),
  group_id: adventure.groupId,
  id: adventure.id,
  title: adventure.title,
  vibe: adventure.vibe,
  zone: adventure.zone,
});

const rowToAdventure = (row: unknown): Adventure => {
  const parsed = AdventureRowSchema.parse(row);

  return AdventureSchema.parse({
    beats: parsed.beats,
    groupId: parsed.group_id,
    id: parsed.id,
    title: parsed.title,
    vibe: parsed.vibe,
    zone: parsed.zone,
  });
};

const beliefRefToRow = (beliefRef: BeliefRef): BeliefRefRow => ({
  created_at: new Date().toISOString(),
  group_id: beliefRef.groupId,
  summary: beliefRef.summary,
  xtrace_id: beliefRef.xtraceId,
});

const rowToBeliefRef = (row: unknown): BeliefRef => {
  const parsed = BeliefRefRowSchema.parse(row);

  return BeliefRefSchema.parse({
    groupId: parsed.group_id,
    summary: parsed.summary,
    xtraceId: parsed.xtrace_id,
  });
};

const buildClient = ({
  anonKey,
  apiUrl,
  appId,
}: ButterbaseStoreOptions): ButterbaseStoreClient => {
  const baseOptions = {
    apiUrl,
    appId,
    persistSession: false,
    sessionStorage: new MemorySessionStorage(),
  };

  return createClient(
    anonKey === undefined ? baseOptions : { ...baseOptions, anonKey },
  );
};

export const createButterbaseStore = (
  options: ButterbaseStoreOptions,
): Store => {
  const client = options.client ?? buildClient(options);

  return {
    addMemberships: async (memberships) => {
      if (memberships.length === 0) {
        return;
      }

      const response = await client
        .from<MembershipRow>(TABLES.memberships)
        .insert(memberships.map(membershipToRow));
      assertNoError(response, "insert memberships");
    },
    getGroup: async (groupId) => {
      const rows = unwrap(
        await client
          .from<GroupRow>(TABLES.groups)
          .select("*")
          .eq("id", groupId)
          .limit(1),
        "select group",
      );

      return rows[0] === undefined ? undefined : rowToGroup(rows[0]);
    },
    getLatestAdventure: async (groupId) => {
      const rows = unwrap(
        await client
          .from<AdventureRow>(TABLES.adventures)
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(1),
        "select latest adventure",
      );

      return rows[0] === undefined ? undefined : rowToAdventure(rows[0]);
    },
    listBeliefRefs: async (groupId) => {
      const rows = unwrap(
        await client
          .from<BeliefRefRow>(TABLES.beliefRefs)
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: true }),
        "select belief refs",
      );

      return rows.map(rowToBeliefRef);
    },
    saveAdventure: async (adventure) => {
      const response = await client
        .from<AdventureRow>(TABLES.adventures)
        .insert(adventureToRow(adventure));
      assertNoError(response, "insert adventure");
    },
    saveBeliefRef: async (beliefRef) => {
      const response = await client
        .from<BeliefRefRow>(TABLES.beliefRefs)
        .insert(beliefRefToRow(beliefRef));
      assertNoError(response, "insert belief ref");
    },
    saveGroup: async (group) => {
      const response = await client
        .from<GroupRow>(TABLES.groups)
        .insert(groupToRow(group));
      assertNoError(response, "insert group");
    },
  };
};

export const createConfiguredStore = (
  config: AppConfig["butterbase"],
): Store => {
  if (config.appId === undefined) {
    return createStubStore();
  }

  return createButterbaseStore({
    apiUrl: config.apiUrl,
    appId: config.appId,
    ...(config.anonKey === undefined ? {} : { anonKey: config.anonKey }),
  });
};
