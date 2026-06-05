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
    expect(centroid(locations)).toMatchObject({
      lat: expect.closeTo(37.803, 3),
      lng: expect.closeTo(-122.449, 3),
    });
  });

  it("computes centroids across the antimeridian", () => {
    const center = centroid([
      { lat: 0, lng: 179, userId: "user_1" },
      { lat: 0, lng: -179, userId: "user_2" },
    ]);

    expect(Math.abs(center.lng)).toBeGreaterThan(179);
    expect(center.lat).toBeCloseTo(0);
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

  it("returns a finite distance for antipodal points", () => {
    expect(
      haversineDistanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }),
    ).toBeCloseTo(20_015_086, -3);
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
