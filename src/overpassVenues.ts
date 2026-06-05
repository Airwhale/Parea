import { z } from "zod";

import { haversineDistanceM } from "./geo.js";
import { VenueSchema } from "./schemas.js";

import type { Venue } from "./schemas.js";
import type { VenueSearch, VenueSource } from "./venues.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type OverpassTagQuery = {
  key: string;
  values?: readonly string[];
};

type OverpassCategoryRule = {
  category: string;
  queries: readonly OverpassTagQuery[];
};

export type OverpassVenueSourceOptions = {
  endpointUrl?: string;
  fetchImpl?: FetchLike;
  maxResults?: number;
  timeoutMs?: number;
};

const OVERPASS_CATEGORY_RULES: readonly OverpassCategoryRule[] = [
  {
    category: "park",
    queries: [{ key: "leisure", values: ["park"] }],
  },
  {
    category: "garden",
    queries: [{ key: "leisure", values: ["garden"] }],
  },
  {
    category: "viewpoint",
    queries: [{ key: "tourism", values: ["viewpoint"] }],
  },
  {
    category: "cafe",
    queries: [{ key: "amenity", values: ["cafe"] }],
  },
  {
    category: "bookshop",
    queries: [{ key: "shop", values: ["books"] }],
  },
  {
    category: "bakery",
    queries: [{ key: "shop", values: ["bakery"] }],
  },
  {
    category: "dim_sum",
    queries: [{ key: "cuisine", values: ["chinese", "dim_sum"] }],
  },
  {
    category: "tea_house",
    queries: [
      { key: "shop", values: ["tea"] },
      { key: "amenity", values: ["cafe"] },
    ],
  },
  {
    category: "market",
    queries: [
      { key: "amenity", values: ["marketplace"] },
      { key: "shop", values: ["supermarket", "convenience", "greengrocer"] },
    ],
  },
  {
    category: "dessert",
    queries: [
      { key: "amenity", values: ["ice_cream"] },
      { key: "shop", values: ["chocolate", "confectionery", "pastry"] },
    ],
  },
  {
    category: "trailhead",
    queries: [
      { key: "highway", values: ["trailhead"] },
      { key: "tourism", values: ["trailhead"] },
    ],
  },
  {
    category: "climbing",
    queries: [
      { key: "sport", values: ["climbing"] },
      { key: "leisure", values: ["sports_centre"] },
    ],
  },
  {
    category: "bike_rental",
    queries: [{ key: "amenity", values: ["bicycle_rental"] }],
  },
  {
    category: "pier",
    queries: [{ key: "man_made", values: ["pier"] }],
  },
  {
    category: "stairs",
    queries: [{ key: "highway", values: ["steps"] }],
  },
  {
    category: "art_gallery",
    queries: [{ key: "tourism", values: ["gallery"] }],
  },
  {
    category: "mural",
    queries: [{ key: "tourism", values: ["artwork"] }],
  },
  {
    category: "museum",
    queries: [{ key: "tourism", values: ["museum"] }],
  },
  {
    category: "historic_site",
    queries: [
      {
        key: "historic",
        values: ["building", "fort", "memorial", "monument", "yes"],
      },
      { key: "tourism", values: ["attraction"] },
    ],
  },
];

const OverpassElementSchema = z.object({
  center: z
    .object({
      lat: z.number(),
      lon: z.number(),
    })
    .optional(),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  tags: z.record(z.string(), z.string()).optional(),
  type: z.enum(["node", "relation", "way"]),
});

const OverpassResponseSchema = z.object({
  elements: z.array(OverpassElementSchema),
});

type OverpassElement = z.infer<typeof OverpassElementSchema>;

const ruleByCategory = new Map(
  OVERPASS_CATEGORY_RULES.map((rule) => [rule.category, rule]),
);

const regexEscape = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const selectorForQuery = ({ key, values }: OverpassTagQuery): string => {
  if (values === undefined) {
    return `["${key}"]`;
  }

  const alternatives = values.map(regexEscape).join("|");
  return `["${key}"~"^(${alternatives})$"]`;
};

const buildOverpassQuery = ({
  categories,
  lat,
  lng,
  radiusM,
}: VenueSearch): string => {
  const selectors = categories
    .map((category) => ruleByCategory.get(category))
    .filter((rule): rule is OverpassCategoryRule => rule !== undefined)
    .flatMap((rule) => rule.queries.map(selectorForQuery));

  if (selectors.length === 0) {
    throw new Error(`No Overpass mapping exists for ${categories.join(", ")}.`);
  }

  const statements = selectors.flatMap((selector) => [
    `node${selector}(around:${radiusM},${lat},${lng});`,
    `way${selector}(around:${radiusM},${lat},${lng});`,
    `relation${selector}(around:${radiusM},${lat},${lng});`,
  ]);

  return [
    "[out:json][timeout:20];",
    "(",
    ...statements,
    ");",
    "out center 40;",
  ].join("\n");
};

const categoryFromTags = (
  tags: Record<string, string>,
  requestedCategories: readonly string[],
): string | undefined => {
  for (const category of requestedCategories) {
    const rule = ruleByCategory.get(category);
    if (rule === undefined) {
      continue;
    }

    const matches = rule.queries.some(({ key, values }) => {
      const tagValue = tags[key];
      if (tagValue === undefined) {
        return false;
      }

      return values === undefined || values.includes(tagValue);
    });

    if (matches) {
      return category;
    }
  }

  return undefined;
};

const coordinatesForElement = (
  element: OverpassElement,
): { lat: number; lng: number } | undefined => {
  if (element.lat !== undefined && element.lon !== undefined) {
    return { lat: element.lat, lng: element.lon };
  }

  if (element.center !== undefined) {
    return { lat: element.center.lat, lng: element.center.lon };
  }

  return undefined;
};

const venueFromElement = (
  element: OverpassElement,
  search: VenueSearch,
): Venue | undefined => {
  const tags = element.tags ?? {};
  const name = tags.name ?? tags["name:en"];
  const coordinates = coordinatesForElement(element);
  const category = categoryFromTags(tags, search.categories);

  if (name === undefined || coordinates === undefined || category === undefined) {
    return undefined;
  }

  const parsed = VenueSchema.safeParse({
    category,
    lat: coordinates.lat,
    lng: coordinates.lng,
    name,
  });

  return parsed.success ? parsed.data : undefined;
};

const dedupeVenues = (venues: readonly Venue[]): readonly Venue[] => {
  const seen = new Set<string>();
  const deduped: Venue[] = [];

  for (const venue of venues) {
    const key = `${venue.name.toLowerCase()}|${venue.lat.toFixed(5)}|${venue.lng.toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(venue);
  }

  return deduped;
};

export const createOverpassVenueSource = ({
  endpointUrl = "https://overpass-api.de/api/interpreter",
  fetchImpl = fetch,
  maxResults = 12,
  timeoutMs = 20_000,
}: OverpassVenueSourceOptions = {}): VenueSource => ({
  search: async (search) => {
    const query = buildOverpassQuery(search);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    const url = new URL(endpointUrl);
    url.searchParams.set("data", query);

    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: "application/json",
          "user-agent": "PareaWander/0.1 (https://github.com/Airwhale/Parea)",
        },
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Overpass request failed with ${response.status} ${response.statusText}.`,
        );
      }

      const payload = OverpassResponseSchema.parse(await response.json());
      const center = { lat: search.lat, lng: search.lng };

      return dedupeVenues(
        payload.elements
          .map((element) => venueFromElement(element, search))
          .filter((venue): venue is Venue => venue !== undefined)
          .sort(
            (left, right) =>
              haversineDistanceM(center, left) -
              haversineDistanceM(center, right),
          ),
      ).slice(0, maxResults);
    } finally {
      clearTimeout(timeout);
    }
  },
});
