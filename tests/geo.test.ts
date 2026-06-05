import { describe, expect, it } from "vitest";

import {
  centroid,
  haversineDistanceM,
  isOutsideZone,
  noisedCentroid,
} from "../src/geo.js";

const locations = [
  { lat: 37.802, lng: -122.448, userId: "user_1" },
  { lat: 37.804, lng: -122.45, userId: "user_2" },
];

describe("geo", () => {
  it("computes a member-location centroid", () => {
    expect(centroid(locations)).toEqual({
      lat: 37.803,
      lng: -122.449,
    });
  });

  it("adds configurable Gaussian noise to a centroid", () => {
    const noisy = noisedCentroid(locations, {
      random: () => 0.5,
      sigmaM: 200,
    });

    expect(noisy.lat).not.toBe(37.803);
    expect(noisy.lng).not.toBe(-122.449);
    expect(haversineDistanceM(centroid(locations), noisy)).toBeGreaterThan(100);
  });

  it("throws when no member locations are available", () => {
    expect(() => centroid([])).toThrow("At least one location");
  });

  it("detects a location outside an adventure zone with hysteresis", () => {
    const zone = {
      centerLat: 37.802,
      centerLng: -122.448,
      radiusM: 350,
    };

    expect(
      isOutsideZone({ lat: 37.8025, lng: -122.4485 }, zone, 25),
    ).toBe(false);
    expect(isOutsideZone({ lat: 37.795, lng: -122.407 }, zone, 25)).toBe(true);
  });
});
