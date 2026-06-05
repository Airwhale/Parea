import type { Belief, BeliefRef, Vibe, Zone } from "./schemas.js";

export type SeedBeliefInput = {
  adventureTitle: string;
  groupId: string;
  vibe: Vibe;
  zone: Zone;
};

export type ContradictionInput = {
  groupId: string;
  observation: string;
};

export type Memory = {
  contradict: (input: ContradictionInput) => Promise<BeliefRef>;
  current: (groupId: string) => Promise<readonly Belief[]>;
  seedBelief: (belief: SeedBeliefInput) => Promise<BeliefRef>;
};

export type StubMemoryOptions = {
  rerouteVibe?: Vibe;
};

export const createStubMemory = ({
  rerouteVibe = "foodie",
}: StubMemoryOptions = {}): Memory => {
  const beliefsByGroup = new Map<string, Belief[]>();

  return {
    contradict: async ({ groupId, observation }) => {
      const prior = beliefsByGroup.get(groupId) ?? [];
      const revisedPrior = prior.map((belief) =>
        belief.status === "active"
          ? { ...belief, confidence: 0.25, status: "revised" as const }
          : belief,
      );
      const belief: Belief = {
        confidence: 0.88,
        groupId,
        id: `belief_${groupId}_${rerouteVibe}`,
        status: "active",
        summary: `${observation}; group now fits a ${rerouteVibe} reroute.`,
        vibe: rerouteVibe,
      };

      beliefsByGroup.set(groupId, [...revisedPrior, belief]);

      return {
        groupId,
        summary: belief.summary,
        xtraceId: belief.id,
      };
    },
    current: async (groupId) =>
      (beliefsByGroup.get(groupId) ?? []).filter(
        (belief) => belief.status === "active",
      ),
    seedBelief: async ({ adventureTitle, groupId, vibe, zone }) => {
      const belief: Belief = {
        confidence: 0.82,
        groupId,
        id: `belief_${groupId}_${vibe}`,
        status: "active",
        summary: `Group ${groupId} fits a ${vibe} adventure on ${adventureTitle} within ${zone.radiusM}m.`,
        vibe,
      };

      beliefsByGroup.set(groupId, [belief]);

      return {
        groupId,
        summary: belief.summary,
        xtraceId: belief.id,
      };
    },
  };
};
