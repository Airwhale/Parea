import { createVenueBackedAdventureGen } from "./adventureGen.js";
import { createConfiguredStore } from "./butterbaseStore.js";
import { createConfiguredAdventureGen } from "./rocketrideAdventureGen.js";
import { createConfiguredVenueSource } from "./venues.js";
import { createConfiguredMemory } from "./xtraceMemory.js";

import type { AdventureGen } from "./adventureGen.js";
import type { AppConfig } from "./config.js";
import type { Memory } from "./memory.js";
import type { Store } from "./store.js";
import type { VenueSource } from "./venues.js";

export type RuntimeDeps = {
  adventureGen: AdventureGen;
  memory: Memory;
  store: Store;
  venueSource: VenueSource;
};

export const createRuntimeDeps = (config: AppConfig): RuntimeDeps => {
  const venueSource = createConfiguredVenueSource(config.venues);
  const adventureGen =
    createConfiguredAdventureGen({
      rocketride: config.rocketride,
      venueSource,
    }) ?? createVenueBackedAdventureGen(venueSource);

  return {
    adventureGen,
    memory: createConfiguredMemory(config.xtrace),
    store: createConfiguredStore(config.butterbase),
    venueSource,
  };
};
