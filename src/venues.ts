import { createOverpassVenueSource } from "./overpassVenues.js";

import type { AppConfig } from "./config.js";
import type { Venue } from "./schemas.js";

export type VenueSearch = {
  categories: readonly string[];
  lat: number;
  lng: number;
  openNow?: boolean;
  radiusM: number;
};

export type VenueSource = {
  search: (query: VenueSearch) => Promise<readonly Venue[]>;
};

const STUB_VENUES: readonly Venue[] = [
  {
    category: "park",
    lat: 37.8029,
    lng: -122.4487,
    name: "Presidio Tunnel Tops",
    openNow: true,
    rating: 4.8,
  },
  {
    category: "viewpoint",
    lat: 37.8087,
    lng: -122.475,
    name: "Golden Gate Overlook",
    openNow: true,
    rating: 4.7,
  },
  {
    category: "cafe",
    lat: 37.7982,
    lng: -122.4596,
    name: "Warming Hut Cafe",
    openNow: true,
    rating: 4.5,
  },
  {
    category: "bakery",
    lat: 37.7955,
    lng: -122.4078,
    name: "Golden Gate Bakery",
    openNow: true,
    rating: 4.6,
  },
  {
    category: "dim_sum",
    lat: 37.795,
    lng: -122.4058,
    name: "Good Mong Kok Bakery",
    openNow: true,
    rating: 4.6,
  },
  {
    category: "tea_house",
    lat: 37.7943,
    lng: -122.4079,
    name: "Vital Tea Leaf",
    openNow: true,
    rating: 4.7,
  },
  {
    category: "trailhead",
    lat: 37.8077,
    lng: -122.475,
    name: "Batteries to Bluffs Trail",
    openNow: true,
    rating: 4.8,
  },
  {
    category: "pier",
    lat: 37.808,
    lng: -122.4177,
    name: "Pier 39",
    openNow: true,
    rating: 4.5,
  },
  {
    category: "stairs",
    lat: 37.8024,
    lng: -122.4183,
    name: "Filbert Steps",
    openNow: true,
    rating: 4.7,
  },
  {
    category: "museum",
    lat: 37.8008,
    lng: -122.4586,
    name: "Walt Disney Family Museum",
    openNow: true,
    rating: 4.7,
  },
  {
    category: "historic_site",
    lat: 37.8014,
    lng: -122.4597,
    name: "Main Post",
    openNow: true,
    rating: 4.5,
  },
  {
    category: "art_gallery",
    lat: 37.7976,
    lng: -122.4018,
    name: "Chinese Culture Center",
    openNow: true,
    rating: 4.4,
  },
];

export const createStubVenueSource = (
  venues: readonly Venue[] = STUB_VENUES,
): VenueSource => ({
  search: async ({ categories, openNow = false }) =>
    venues.filter(
      (venue) =>
        categories.includes(venue.category) &&
        (!openNow || venue.openNow === true),
    ),
});

export const createConfiguredVenueSource = (
  config: AppConfig["venues"],
): VenueSource => {
  switch (config.source) {
    case "overpass":
      return createOverpassVenueSource({
        endpointUrl: config.overpassApiUrl,
      });
    case "stub":
      return createStubVenueSource();
  }
};
