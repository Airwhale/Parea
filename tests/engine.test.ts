import { describe, expect, it } from "vitest";

import { createStubAdventureGen } from "../src/adventureGen.js";
import { createRecordingDelivery } from "../src/delivery.js";
import { createEngine } from "../src/engine.js";
import { createStubMemory } from "../src/memory.js";
import { runStubDemo } from "../src/stubDemo.js";
import { createStubStore } from "../src/store.js";
import { createStubVenueSource } from "../src/venues.js";

const presidioLocations = [
  { lat: 37.8028, lng: -122.4487, userId: "user_ada" },
  { lat: 37.8034, lng: -122.4492, userId: "user_grace" },
];

const chinatownLocations = [
  { lat: 37.7953, lng: -122.4078, userId: "user_ada" },
  { lat: 37.7958, lng: -122.4064, userId: "user_grace" },
];

const createTestEngine = () => {
  const delivery = createRecordingDelivery();
  const store = createStubStore();
  const memory = createStubMemory();
  const adventureGen = createStubAdventureGen(createStubVenueSource());
  const engine = createEngine({
    adventureGen,
    clock: () => new Date("2026-06-05T19:00:00.000Z"),
    delivery,
    memory,
    noiseSigmaM: 0,
    random: () => 0.5,
    store,
  });

  return { delivery, engine, memory, store };
};

describe("engine", () => {
  it("starts a stub wander and stores the initial adventure", async () => {
    const { delivery, engine, store } = createTestEngine();

    await engine.startWander({
      groupId: "group_test",
      initialLocations: presidioLocations,
      initiatorId: "user_ada",
      memberIds: ["user_ada", "user_grace"],
      vibe: "mellow",
    });

    await expect(store.getGroup("group_test")).resolves.toMatchObject({
      id: "group_test",
      vibe: "mellow",
    });
    await expect(store.getLatestAdventure("group_test")).resolves.toMatchObject({
      title: "Presidio Stroll",
      vibe: "mellow",
    });
    expect(delivery.records).toHaveLength(1);
    expect(delivery.records[0]?.message.body).toContain("Presidio Stroll");
  });

  it("does not reroute while the group remains inside the zone", async () => {
    const { delivery, engine } = createTestEngine();

    await engine.startWander({
      groupId: "group_test",
      initialLocations: presidioLocations,
      initiatorId: "user_ada",
      memberIds: ["user_ada", "user_grace"],
      vibe: "mellow",
    });

    await expect(
      engine.handleZoneExit({
        groupId: "group_test",
        locations: presidioLocations,
      }),
    ).resolves.toBe(false);
    expect(delivery.records).toHaveLength(1);
  });

  it("ignores empty location updates during zone checks", async () => {
    const { delivery, engine } = createTestEngine();

    await engine.startWander({
      groupId: "group_test",
      initialLocations: presidioLocations,
      initiatorId: "user_ada",
      memberIds: ["user_ada", "user_grace"],
      vibe: "mellow",
    });

    await expect(
      engine.handleZoneExit({
        groupId: "group_test",
        locations: [],
      }),
    ).resolves.toBe(false);
    expect(delivery.records).toHaveLength(1);
  });

  it("rejects wander starts without any initial location", async () => {
    const { engine } = createTestEngine();

    await expect(
      engine.startWander({
        groupId: "group_test",
        initialLocations: [],
        initiatorId: "user_ada",
        memberIds: ["user_ada", "user_grace"],
        vibe: "mellow",
      }),
    ).rejects.toThrow("At least one initial location");
  });

  it("revises memory and delivers a foodie reroute after zone exit", async () => {
    const { delivery, engine, memory, store } = createTestEngine();

    await engine.startWander({
      groupId: "group_test",
      initialLocations: presidioLocations,
      initiatorId: "user_ada",
      memberIds: ["user_ada", "user_grace"],
      vibe: "mellow",
    });

    await expect(
      engine.handleZoneExit({
        groupId: "group_test",
        locations: chinatownLocations,
      }),
    ).resolves.toBe(true);

    await expect(memory.current("group_test")).resolves.toMatchObject([
      {
        status: "active",
        vibe: "foodie",
      },
    ]);
    await expect(store.getLatestAdventure("group_test")).resolves.toMatchObject({
      title: "Chinatown Snack Quest",
      vibe: "foodie",
    });
    expect(delivery.records).toHaveLength(2);
    expect(delivery.records[1]?.message.body).toContain("Reroute");
  });

  it("uses the structured belief vibe for rerouting", async () => {
    const delivery = createRecordingDelivery();
    const store = createStubStore();
    const engine = createEngine({
      adventureGen: createStubAdventureGen(createStubVenueSource()),
      delivery,
      memory: createStubMemory({ rerouteVibe: "active" }),
      noiseSigmaM: 0,
      random: () => 0.5,
      store,
    });

    await engine.startWander({
      groupId: "group_active",
      initialLocations: presidioLocations,
      initiatorId: "user_ada",
      memberIds: ["user_ada", "user_grace"],
      vibe: "mellow",
    });
    await engine.handleZoneExit({
      groupId: "group_active",
      locations: chinatownLocations,
    });

    await expect(store.getLatestAdventure("group_active")).resolves.toMatchObject(
      {
        title: "Bay Motion Loop",
        vibe: "active",
      },
    );
  });

  it("runs the full canned demo loop", async () => {
    await expect(runStubDemo()).resolves.toMatchObject({
      deliveryRecords: expect.arrayContaining([
        expect.objectContaining({
          message: expect.objectContaining({ title: "Presidio Stroll" }),
        }),
        expect.objectContaining({
          message: expect.objectContaining({ title: "Chinatown Snack Quest" }),
        }),
      ]),
      rerouted: true,
    });
  });
});
