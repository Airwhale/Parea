import { adventureToMessage } from "./delivery.js";
import { centroid, isOutsideZone, noisedCentroid } from "./geo.js";

import type { AdventureGen } from "./adventureGen.js";
import type { Delivery } from "./delivery.js";
import type { Memory } from "./memory.js";
import type { MemberLocation, Vibe } from "./schemas.js";
import type { Store } from "./store.js";

export type StartWanderInput = {
  groupId: string;
  initialLocations: readonly MemberLocation[];
  initiatorId: string;
  memberIds: readonly string[];
  vibe: Vibe;
};

export type ZoneExitInput = {
  groupId: string;
  locations: readonly MemberLocation[];
};

export type EngineDeps = {
  adventureGen: AdventureGen;
  clock?: () => Date;
  delivery: Delivery;
  memory: Memory;
  noiseSigmaM?: number;
  random?: () => number;
  store: Store;
};

export type Engine = {
  handleZoneExit: (input: ZoneExitInput) => Promise<boolean>;
  startWander: (input: StartWanderInput) => Promise<void>;
};

export const createEngine = ({
  adventureGen,
  clock = () => new Date(),
  delivery,
  memory,
  noiseSigmaM = 200,
  random = Math.random,
  store,
}: EngineDeps): Engine => ({
  handleZoneExit: async ({ groupId, locations }) => {
    const latestAdventure = await store.getLatestAdventure(groupId);

    if (latestAdventure === undefined) {
      throw new Error(`No adventure exists for group ${groupId}.`);
    }

    if (locations.length === 0) {
      return false;
    }

    const currentCentroid = centroid(locations);
    if (!isOutsideZone(currentCentroid, latestAdventure.zone)) {
      return false;
    }

    const beliefRef = await memory.contradict({
      groupId,
      observation: `Group ${groupId} left the ${latestAdventure.title} zone.`,
    });
    await store.saveBeliefRef(beliefRef);

    const currentBeliefs = await memory.current(groupId);
    const revisedBelief = currentBeliefs.at(-1);
    const rerouteVibe = revisedBelief?.vibe ?? latestAdventure.vibe;
    const publicCentroid = noisedCentroid(locations, {
      random,
      sigmaM: noiseSigmaM,
    });
    const adventure = await adventureGen.generate({
      ...(revisedBelief === undefined
        ? {}
        : { belief: revisedBelief.summary }),
      groupId,
      lat: publicCentroid.lat,
      lng: publicCentroid.lng,
      vibe: rerouteVibe,
    });

    await store.saveAdventure(adventure);
    await delivery.sendToGroup(
      groupId,
      adventureToMessage(adventure, "Reroute"),
    );

    return true;
  },
  startWander: async ({
    groupId,
    initialLocations,
    initiatorId,
    memberIds,
    vibe,
  }) => {
    if (initialLocations.length === 0) {
      throw new Error("At least one initial location is required to start a wander.");
    }

    const createdAt = clock().toISOString();
    await store.saveGroup({
      createdAt,
      id: groupId,
      initiatorId,
      vibe,
    });
    await store.addMemberships(
      memberIds.map((userId) => ({
        groupId,
        joinedAt: createdAt,
        userId,
      })),
    );

    const publicCentroid = noisedCentroid(initialLocations, {
      random,
      sigmaM: noiseSigmaM,
    });
    const adventure = await adventureGen.generate({
      groupId,
      lat: publicCentroid.lat,
      lng: publicCentroid.lng,
      vibe,
    });
    await store.saveAdventure(adventure);

    const beliefRef = await memory.seedBelief({
      adventureTitle: adventure.title,
      groupId,
      vibe,
      zone: adventure.zone,
    });
    await store.saveBeliefRef(beliefRef);
    await delivery.sendToGroup(groupId, adventureToMessage(adventure));
  },
});
