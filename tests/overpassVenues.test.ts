import { describe, expect, it } from "vitest";

import { createOverpassVenueSource } from "../src/overpassVenues.js";

describe("createOverpassVenueSource", () => {
  it("queries Overpass around the requested coordinate and normalizes venues", async () => {
    const requests: string[] = [];
    const source = createOverpassVenueSource({
      fetchImpl: async (input) => {
        const url = new URL(input.toString());
        requests.push(url.searchParams.get("data") ?? "");

        return new Response(
          JSON.stringify({
            elements: [
              {
                id: 1,
                lat: 37.795,
                lon: -122.407,
                tags: {
                  cuisine: "dim_sum",
                  name: "Good Mong Kok Bakery",
                },
                type: "node",
              },
              {
                center: {
                  lat: 37.7955,
                  lon: -122.4078,
                },
                id: 2,
                tags: {
                  name: "Vital Tea Leaf",
                  shop: "tea",
                },
                type: "way",
              },
              {
                id: 3,
                lat: 37.796,
                lon: -122.408,
                tags: {
                  name: "Ignored Venue",
                  shop: "shoes",
                },
                type: "node",
              },
            ],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      },
    });

    await expect(
      source.search({
        categories: ["dim_sum", "tea_house"],
        lat: 37.7952,
        lng: -122.4078,
        radiusM: 900,
      }),
    ).resolves.toEqual([
      {
        category: "tea_house",
        lat: 37.7955,
        lng: -122.4078,
        name: "Vital Tea Leaf",
      },
      {
        category: "dim_sum",
        lat: 37.795,
        lng: -122.407,
        name: "Good Mong Kok Bakery",
      },
    ]);
    expect(requests[0]).toContain("around:900,37.7952,-122.4078");
    expect(requests[0]).toContain('["cuisine"~"^(chinese|dim_sum)$"]');
  });

  it("surfaces non-OK Overpass responses", async () => {
    const source = createOverpassVenueSource({
      fetchImpl: async () =>
        new Response("rate limited", {
          status: 429,
          statusText: "Too Many Requests",
        }),
    });

    await expect(
      source.search({
        categories: ["museum"],
        lat: 37.8,
        lng: -122.4,
        radiusM: 900,
      }),
    ).rejects.toThrow("Overpass request failed with 429 Too Many Requests.");
  });
});
