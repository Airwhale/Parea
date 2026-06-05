import { describe, expect, it } from "vitest";

import {
  AdventureSchema,
  LocationUpdateSchema,
  VibeSchema,
} from "../src/schemas.js";

const venue = {
  category: "park",
  lat: 37.802,
  lng: -122.448,
  name: "Presidio Tunnel Tops",
  openNow: true,
  rating: 4.8,
};

describe("boundary schemas", () => {
  it("accepts the fixed vibe vocabulary", () => {
    expect(VibeSchema.options).toEqual([
      "mellow",
      "foodie",
      "cultural",
      "active",
    ]);
  });

  it("validates an adventure boundary object", () => {
    const parsed = AdventureSchema.parse({
      beats: [
        { order: 1, prompt: "Take in the bay view.", venue },
        { order: 2, prompt: "Find a quiet bench.", venue },
        { order: 3, prompt: "Share the favorite moment.", venue },
      ],
      groupId: "group_1",
      id: "adv_1",
      title: "Presidio Stroll",
      vibe: "mellow",
      zone: {
        centerLat: 37.802,
        centerLng: -122.448,
        radiusM: 350,
      },
    });

    expect(parsed.beats).toHaveLength(3);
  });

  it("rejects adventure beats that are not sequentially ordered", () => {
    const result = AdventureSchema.safeParse({
      beats: [
        { order: 2, prompt: "Find a quiet bench.", venue },
        { order: 1, prompt: "Take in the bay view.", venue },
        { order: 3, prompt: "Share the favorite moment.", venue },
      ],
      groupId: "group_1",
      id: "adv_1",
      title: "Presidio Stroll",
      vibe: "mellow",
      zone: {
        centerLat: 37.802,
        centerLng: -122.448,
        radiusM: 350,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid coordinates before they cross a boundary", () => {
    const result = LocationUpdateSchema.safeParse({
      groupId: "group_1",
      lat: 120,
      lng: -122.4,
      userId: "user_1",
    });

    expect(result.success).toBe(false);
  });
});
