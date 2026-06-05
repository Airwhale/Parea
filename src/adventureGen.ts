import type { Adventure, Venue, Vibe } from "./schemas.js";
import type { VenueSource } from "./venues.js";
import { VIBE_QUERIES } from "./vibes.js";

export type AdventureGenerateInput = {
  belief?: string;
  groupId: string;
  lat: number;
  lng: number;
  vibe: Vibe;
};

export type AdventureGen = {
  generate: (input: AdventureGenerateInput) => Promise<Adventure>;
};

const titleForVibe = (vibe: Vibe): string => {
  const titles: Record<Vibe, string> = {
    active: "Bay Motion Loop",
    cultural: "North Beach Story Walk",
    foodie: "Chinatown Snack Quest",
    mellow: "Presidio Stroll",
  };

  return titles[vibe];
};

const promptForBeat = (vibe: Vibe, order: 1 | 2 | 3): string => {
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

export const createStubAdventureGen = (
  venueSource: VenueSource,
): AdventureGen => ({
  generate: async ({ groupId, lat, lng, vibe }) => {
    const venues = await venueSource.search({
      categories: VIBE_QUERIES[vibe],
      lat,
      lng,
      openNow: true,
      radiusM: 900,
    });
    const selected = venues.slice(0, 3);

    if (selected.length < 3) {
      throw new Error(
        `Stub venue source returned ${selected.length} venues, but 3 are required.`,
      );
    }

    const [firstVenue, secondVenue, thirdVenue] = selected as [
      Venue,
      Venue,
      Venue,
    ];

    return {
      beats: [
        { order: 1, prompt: promptForBeat(vibe, 1), venue: firstVenue },
        { order: 2, prompt: promptForBeat(vibe, 2), venue: secondVenue },
        { order: 3, prompt: promptForBeat(vibe, 3), venue: thirdVenue },
      ],
      groupId,
      id: `adv_${vibe}_${groupId}`,
      title: titleForVibe(vibe),
      vibe,
      zone: {
        centerLat: lat,
        centerLng: lng,
        radiusM: 350,
      },
    };
  },
});
