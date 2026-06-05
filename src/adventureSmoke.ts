import "dotenv/config";

import { createVenueBackedAdventureGen } from "./adventureGen.js";
import { loadConfig } from "./config.js";
import { createConfiguredAdventureGen } from "./rocketrideAdventureGen.js";
import { createOverpassVenueSource } from "./overpassVenues.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const venueSource = createOverpassVenueSource({
    endpointUrl: config.venues.overpassApiUrl,
  });
  const adventureGen =
    createConfiguredAdventureGen({
      rocketride: config.rocketride,
      venueSource,
    }) ?? createVenueBackedAdventureGen(venueSource);

  const adventure = await adventureGen.generate({
    groupId: `group_adventure_smoke_${Date.now()}`,
    lat: 37.7952,
    lng: -122.4078,
    vibe: "foodie",
  });

  console.log(JSON.stringify(adventure, null, 2));
};

try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify({
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      phase: "adventure_smoke",
      status: "failed",
      timestamp: new Date().toISOString(),
    }),
  );
  process.exitCode = 1;
}

