import { AdventureGenerateInputSchema, AdventureSchema } from "./schemas.js";

import type { Adventure, AdventureGenerateInput, Venue, Vibe } from "./schemas.js";
import type { VenueSource } from "./venues.js";
import { VIBE_QUERIES } from "./vibes.js";

export type AdventureGen = {
  generate: (input: AdventureGenerateInput) => Promise<Adventure>;
};

const DEFAULT_SEARCH_RADII_M = [900, 1_500, 2_500] as const;
const DEFAULT_ZONE_RADIUS_M = 350;

const VIBE_FALLBACKS: Record<Vibe, readonly Vibe[]> = {
  active: ["cultural", "foodie", "mellow"],
  cultural: ["foodie", "mellow", "active"],
  foodie: ["cultural", "mellow", "active"],
  mellow: ["cultural", "foodie", "active"],
};

export type VenueBackedAdventureGenOptions = {
  searchRadiiM?: readonly number[];
  zoneRadiusM?: number;
};

export const titleForVibe = (vibe: Vibe): string => {
  const titles: Record<Vibe, string> = {
    active: "Bay Motion Loop",
    cultural: "North Beach Story Walk",
    foodie: "Chinatown Snack Quest",
    mellow: "Presidio Stroll",
  };

  return titles[vibe];
};

export const promptForBeat = (vibe: Vibe, order: 1 | 2 | 3): string => {
  const prompts: Record<Vibe, Record<1 | 2 | 3, string>> = {
    active: {
      1: "Start with a quick pace check.",
      2: "Find the most energetic route segment.",
      3: "End with a shared photo stop.",
    },
    cultural: {
      1: "Notice the first detail that feels local.",
      2: "Trade one historical guess before looking it up.",
      3: "Pick the best story from the walk.",
    },
    foodie: {
      1: "Order one small bite to split.",
      2: "Compare the aromas before choosing the next stop.",
      3: "Close with tea or dessert and pick a favorite.",
    },
    mellow: {
      1: "Take in the view without rushing.",
      2: "Find a quiet place to sit for a minute.",
      3: "Share the calmest moment from the walk.",
    },
  };

  return prompts[vibe][order];
};

const orderedVibes = (vibe: Vibe): readonly Vibe[] => [
  vibe,
  ...VIBE_FALLBACKS[vibe],
];

const findThreeVenues = async ({
  lat,
  lng,
  searchRadiiM,
  venueSource,
  vibe,
}: AdventureGenerateInput & {
  searchRadiiM: readonly number[];
  venueSource: VenueSource;
}): Promise<{ selectedVibe: Vibe; venues: readonly [Venue, Venue, Venue] }> => {
  for (const candidateVibe of orderedVibes(vibe)) {
    for (const radiusM of searchRadiiM) {
      const venues = await venueSource.search({
        categories: VIBE_QUERIES[candidateVibe],
        lat,
        lng,
        openNow: true,
        radiusM,
      });
      const selected = venues.slice(0, 3);

      if (selected.length === 3) {
        return {
          selectedVibe: candidateVibe,
          venues: selected as [Venue, Venue, Venue],
        };
      }
    }
  }

  throw new Error(
    `Could not find 3 venues near ${lat},${lng} for vibe ${vibe}.`,
  );
};

export const buildAdventureFromVenues = ({
  groupId,
  lat,
  lng,
  venueTuple,
  vibe,
  zoneRadiusM = DEFAULT_ZONE_RADIUS_M,
}: {
  groupId: string;
  lat: number;
  lng: number;
  venueTuple: readonly [Venue, Venue, Venue];
  vibe: Vibe;
  zoneRadiusM?: number;
}): Adventure =>
  AdventureSchema.parse({
    beats: [
      { order: 1, prompt: promptForBeat(vibe, 1), venue: venueTuple[0] },
      { order: 2, prompt: promptForBeat(vibe, 2), venue: venueTuple[1] },
      { order: 3, prompt: promptForBeat(vibe, 3), venue: venueTuple[2] },
    ],
    groupId,
    id: `adv_${vibe}_${groupId}`,
    title: titleForVibe(vibe),
    vibe,
    zone: {
      centerLat: lat,
      centerLng: lng,
      radiusM: zoneRadiusM,
    },
  });

export const createVenueBackedAdventureGen = (
  venueSource: VenueSource,
  {
    searchRadiiM = DEFAULT_SEARCH_RADII_M,
    zoneRadiusM = DEFAULT_ZONE_RADIUS_M,
  }: VenueBackedAdventureGenOptions = {},
): AdventureGen => ({
  generate: async (rawInput) => {
    const input = AdventureGenerateInputSchema.parse(rawInput);
    const { selectedVibe, venues } = await findThreeVenues({
      ...input,
      searchRadiiM,
      venueSource,
    });

    return buildAdventureFromVenues({
      groupId: input.groupId,
      lat: input.lat,
      lng: input.lng,
      venueTuple: venues,
      vibe: selectedVibe,
      zoneRadiusM,
    });
  },
});

export const createStubAdventureGen = (
  venueSource: VenueSource,
): AdventureGen => createVenueBackedAdventureGen(venueSource, { searchRadiiM: [900] });
