import { describe, expect, it } from "vitest";

import {
  createButterbaseStore,
  type ButterbaseStoreClient,
} from "../src/butterbaseStore.js";

import type { ButterbaseResponse } from "@butterbase/sdk";
import type { Adventure, BeliefRef, Group, Membership } from "../src/schemas.js";

type Row = Record<string, unknown>;

class FakeSelectBuilder<T extends Row> implements PromiseLike<ButterbaseResponse<T[]>> {
  private filters: { column: string; value: unknown }[] = [];
  private limitCount: number | undefined;
  private orderBy:
    | { ascending: boolean; column: string }
    | undefined;

  constructor(private readonly rows: T[]) {}

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orderBy = {
      ascending: options.ascending ?? true,
      column,
    };
    return this;
  }

  select(): this {
    return this;
  }

  then<TResult1 = ButterbaseResponse<T[]>, TResult2 = never>(
    onfulfilled?:
      | ((value: ButterbaseResponse<T[]>) => PromiseLike<TResult1> | TResult1)
      | null,
    onrejected?: ((reason: unknown) => PromiseLike<TResult2> | TResult2) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): ButterbaseResponse<T[]> {
    let selected = [...this.rows];

    for (const filter of this.filters) {
      selected = selected.filter((row) => row[filter.column] === filter.value);
    }

    if (this.orderBy !== undefined) {
      const { ascending, column } = this.orderBy;
      selected.sort((left, right) => {
        const leftValue = String(left[column]);
        const rightValue = String(right[column]);
        return ascending
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      });
    }

    if (this.limitCount !== undefined) {
      selected = selected.slice(0, this.limitCount);
    }

    return { data: selected, error: null };
  }
}

class FakeButterbaseClient {
  readonly tables = new Map<string, Row[]>();
  private insertCount = 0;

  from<T extends Row>(table: string) {
    const rows = this.getRows(table) as T[];

    return {
      insert: async (
        values: Partial<T> | Partial<T>[],
      ): Promise<ButterbaseResponse<T | T[]>> => {
        const inserted = (Array.isArray(values) ? values : [values]).map(
          (value) => {
            this.insertCount += 1;
            return table === "parea_adventures"
              ? {
                  ...value,
                  created_at: new Date(
                    Date.UTC(2026, 5, 5, 19, 0, this.insertCount),
                  ).toISOString(),
                }
              : value;
          },
        );
        rows.push(...(inserted as T[]));
        return {
          data: Array.isArray(values) ? (inserted as T[]) : (inserted[0] as T),
          error: null,
        };
      },
      select: () => new FakeSelectBuilder(rows),
    };
  }

  private getRows(table: string): Row[] {
    const existing = this.tables.get(table);
    if (existing !== undefined) {
      return existing;
    }

    const created: Row[] = [];
    this.tables.set(table, created);
    return created;
  }
}

const group: Group = {
  createdAt: "2026-06-05T19:00:00.000Z",
  id: "group_test",
  initiatorId: "user_ada",
  vibe: "mellow",
};

const membership: Membership = {
  groupId: group.id,
  joinedAt: group.createdAt,
  userId: "user_ada",
};

const adventure = (id: string, title: string): Adventure => ({
  beats: [
    {
      order: 1,
      prompt: "Start here.",
      venue: { category: "park", lat: 37.8, lng: -122.44, name: "A" },
    },
    {
      order: 2,
      prompt: "Then here.",
      venue: { category: "cafe", lat: 37.81, lng: -122.45, name: "B" },
    },
    {
      order: 3,
      prompt: "End here.",
      venue: { category: "viewpoint", lat: 37.82, lng: -122.46, name: "C" },
    },
  ],
  groupId: group.id,
  id,
  title,
  vibe: "mellow",
  zone: { centerLat: 37.8, centerLng: -122.44, radiusM: 350 },
});

const beliefRef: BeliefRef = {
  groupId: group.id,
  summary: "Group fits mellow.",
  xtraceId: "belief_1",
};

describe("createButterbaseStore", () => {
  it("persists and reads the Parea store contract", async () => {
    const client = new FakeButterbaseClient();
    const store = createButterbaseStore({
      apiUrl: "https://api.butterbase.ai",
      appId: "app_test",
      client: client as unknown as ButterbaseStoreClient,
    });

    await store.saveGroup(group);
    await store.addMemberships([membership]);
    await store.saveAdventure(adventure("adv_1", "First"));
    await store.saveAdventure(adventure("adv_2", "Second"));
    await store.saveBeliefRef(beliefRef);

    await expect(store.getGroup(group.id)).resolves.toEqual(group);
    await expect(store.getLatestAdventure(group.id)).resolves.toMatchObject({
      id: "adv_2",
      title: "Second",
    });
    await expect(store.listBeliefRefs(group.id)).resolves.toEqual([beliefRef]);
  });
});
