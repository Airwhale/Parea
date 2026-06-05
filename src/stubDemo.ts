import { createStubAdventureGen } from "./adventureGen.js";
import { createConsoleDelivery, createRecordingDelivery } from "./delivery.js";
import { createEngine } from "./engine.js";
import { createStubMemory } from "./memory.js";
import { createStubStore } from "./store.js";
import { createStubVenueSource } from "./venues.js";

import type { Delivery, DeliveryRecord } from "./delivery.js";
import type { MemberLocation } from "./schemas.js";

const PRESIDIO_LOCATIONS: readonly MemberLocation[] = [
  { lat: 37.8028, lng: -122.4487, userId: "user_ada" },
  { lat: 37.8034, lng: -122.4492, userId: "user_grace" },
  { lat: 37.8024, lng: -122.448, userId: "user_katherine" },
];

const CHINATOWN_LOCATIONS: readonly MemberLocation[] = [
  { lat: 37.7953, lng: -122.4078, userId: "user_ada" },
  { lat: 37.7958, lng: -122.4064, userId: "user_grace" },
  { lat: 37.7948, lng: -122.4069, userId: "user_katherine" },
];

const stableRandom = (): number => 0.5;

export type StubDemoResult = {
  deliveryRecords: readonly DeliveryRecord[];
  rerouted: boolean;
};

export const runStubDemo = async ({
  printToConsole = false,
}: {
  printToConsole?: boolean;
} = {}): Promise<StubDemoResult> => {
  const recordingDelivery = createRecordingDelivery();
  const consoleDelivery = createConsoleDelivery();
  const delivery: Delivery = {
    sendToGroup: async (groupId, message) => {
      await recordingDelivery.sendToGroup(groupId, message);
      if (printToConsole) {
        await consoleDelivery.sendToGroup(groupId, message);
      }
    },
  };
  const store = createStubStore();
  const memory = createStubMemory();
  const adventureGen = createStubAdventureGen(createStubVenueSource());
  const engine = createEngine({
    adventureGen,
    clock: () => new Date("2026-06-05T19:00:00.000Z"),
    delivery,
    memory,
    noiseSigmaM: 0,
    random: stableRandom,
    store,
  });

  await engine.startWander({
    groupId: "group_demo",
    initialLocations: PRESIDIO_LOCATIONS,
    initiatorId: "user_ada",
    memberIds: ["user_ada", "user_grace", "user_katherine"],
    vibe: "mellow",
  });
  const rerouted = await engine.handleZoneExit({
    groupId: "group_demo",
    locations: CHINATOWN_LOCATIONS,
  });

  return {
    deliveryRecords: recordingDelivery.records,
    rerouted,
  };
};
