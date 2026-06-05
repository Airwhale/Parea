import { describe, expect, it } from "vitest";

import { createVenueBackedAdventureGen } from "../src/adventureGen.js";

import type { Venue } from "../src/schemas.js";
import type { VenueSearch, VenueSource } from "../src/venues.js";

const venue = (
  name: string,
  category: string,
  lat = 37.7952,
  lng = -122.4078,
): Venue => ({
  category,
  lat,
  lng,
  name,
  openNow: true,
});

describe("createVenueBackedAdventureGen", () => {
  it("builds an ordered adventure from searched venues", async () => {
    const searches: VenueSearch[] = [];
    const source: VenueSource = {
      search: async (search) => {
        searches.push(search);
        return [
          venue("Good Mong Kok Bakery", "dim_sum"),
          venue("Vital Tea Leaf", "tea_house"),
          venue("Golden Gate Bakery", "bakery"),
        ];
      },
    };
    const generator = createVenueBackedAdventureGen(source);

    await expect(
      generator.generate({
        groupId: "group_foodie",
        lat: 37.7952,
        lng: -122.4078,
        vibe: "foodie",
      }),
    ).resolves.toMatchObject({
      beats: [
        { order: 1, venue: { name: "Good Mong Kok Bakery" } },
        { order: 2, venue: { name: "Vital Tea Leaf" } },
        { order: 3, venue: { name: "Golden Gate Bakery" } },
      ],
      groupId: "group_foodie",
      title: "Chinatown Snack Quest",
      vibe: "foodie",
    });
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatchObject({
      openNow: true,
      radiusM: 2_500,
    });
  });

  it("uses the maximum radius before falling back to another vibe", async () => {
    const searches: VenueSearch[] = [];
    const source: VenueSource = {
      search: async (search) => {
        searches.push(search);
        if (search.categories.includes("museum")) {
          return [];
        }

        return [
          venue("Cable Car Museum", "museum"),
          venue("Chinese Culture Center", "art_gallery"),
          venue("Portsmouth Square", "historic_site"),
        ];
      },
    };
    const generator = createVenueBackedAdventureGen(source, {
      searchRadiiM: [900, 1_500],
    });

    await expect(
      generator.generate({
        groupId: "group_cultural",
        lat: 37.7952,
        lng: -122.4078,
        vibe: "cultural",
      }),
    ).resolves.toMatchObject({
      title: "Chinatown Snack Quest",
      vibe: "foodie",
    });
    expect(searches.map((search) => search.radiusM)).toEqual([1_500, 1_500]);
  });
});
