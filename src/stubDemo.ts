import { createStubAdventureGen } from "./adventureGen.js";
import {
  DEMO_CHINATOWN_LOCATIONS,
  DEMO_MEMBER_IDS,
  DEMO_PRESIDIO_LOCATIONS,
} from "./demoLocations.js";
import { createConsoleDelivery, createRecordingDelivery } from "./delivery.js";
import { createEngine } from "./engine.js";
import { createStubMemory } from "./memory.js";
import { createStubStore } from "./store.js";
import { createStubVenueSource } from "./venues.js";

import type { AdventureGen } from "./adventureGen.js";
import type { Delivery, DeliveryRecord } from "./delivery.js";
import type { Memory } from "./memory.js";
import type { Store } from "./store.js";

const stableRandom = (): number => 0.5;

export type StubDemoResult = {
  deliveryRecords: readonly DeliveryRecord[];
  rerouted: boolean;
};

export const runStubDemo = async ({
  adventureGen = createStubAdventureGen(createStubVenueSource()),
  groupId = `group_demo_${Date.now()}`,
  memory = createStubMemory(),
  printToConsole = false,
  store = createStubStore(),
}: {
  adventureGen?: AdventureGen;
  groupId?: string;
  memory?: Memory;
  printToConsole?: boolean;
  store?: Store;
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
    groupId,
    initialLocations: DEMO_PRESIDIO_LOCATIONS,
    initiatorId: "user_ada",
    memberIds: DEMO_MEMBER_IDS,
    vibe: "mellow",
  });
  const rerouted = await engine.handleZoneExit({
    groupId,
    locations: DEMO_CHINATOWN_LOCATIONS,
  });

  return {
    deliveryRecords: recordingDelivery.records,
    rerouted,
  };
};
