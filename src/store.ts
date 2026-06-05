import type { Adventure, BeliefRef, Group, Membership } from "./schemas.js";

// Privacy rule: store implementations must not persist individual coordinates.
// Only noised group centroids embedded in adventure zones are allowed to persist.

export type Store = {
  addMemberships: (memberships: readonly Membership[]) => Promise<void>;
  getGroup: (groupId: string) => Promise<Group | undefined>;
  getLatestAdventure: (groupId: string) => Promise<Adventure | undefined>;
  listBeliefRefs: (groupId: string) => Promise<readonly BeliefRef[]>;
  saveAdventure: (adventure: Adventure) => Promise<void>;
  saveBeliefRef: (beliefRef: BeliefRef) => Promise<void>;
  saveGroup: (group: Group) => Promise<void>;
};

export const createStubStore = (): Store => {
  const groups = new Map<string, Group>();
  const membershipsByGroup = new Map<string, Membership[]>();
  const adventuresByGroup = new Map<string, Adventure[]>();
  const beliefRefsByGroup = new Map<string, BeliefRef[]>();

  return {
    addMemberships: async (memberships) => {
      for (const membership of memberships) {
        const existing = membershipsByGroup.get(membership.groupId) ?? [];
        membershipsByGroup.set(membership.groupId, [...existing, membership]);
      }
    },
    getGroup: async (groupId) => groups.get(groupId),
    getLatestAdventure: async (groupId) =>
      adventuresByGroup.get(groupId)?.at(-1),
    listBeliefRefs: async (groupId) => beliefRefsByGroup.get(groupId) ?? [],
    saveAdventure: async (adventure) => {
      const existing = adventuresByGroup.get(adventure.groupId) ?? [];
      adventuresByGroup.set(adventure.groupId, [...existing, adventure]);
    },
    saveBeliefRef: async (beliefRef) => {
      const existing = beliefRefsByGroup.get(beliefRef.groupId) ?? [];
      beliefRefsByGroup.set(beliefRef.groupId, [...existing, beliefRef]);
    },
    saveGroup: async (group) => {
      groups.set(group.id, group);
    },
  };
};
