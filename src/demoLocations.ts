import type { Coordinate, MemberLocation } from "./schemas.js";

export const DEMO_MEMBER_IDS = [
  "user_ada",
  "user_grace",
  "user_katherine",
] as const;

const DEMO_COORDINATES = {
  chinatown: [
    { lat: 37.7953, lng: -122.4078 },
    { lat: 37.7958, lng: -122.4064 },
    { lat: 37.7948, lng: -122.4069 },
  ],
  presidio: [
    { lat: 37.8028, lng: -122.4487 },
    { lat: 37.8034, lng: -122.4492 },
    { lat: 37.8024, lng: -122.448 },
  ],
} as const satisfies Record<string, readonly Coordinate[]>;

export type DemoLocationTarget = keyof typeof DEMO_COORDINATES;

export const buildDemoMemberLocations = (
  memberIds: readonly string[],
  target: DemoLocationTarget,
): MemberLocation[] =>
  memberIds.map((userId, index) => {
    const coordinates = DEMO_COORDINATES[target];
    const coordinate = coordinates[index % coordinates.length];

    if (coordinate === undefined) {
      throw new Error(`No demo coordinates configured for ${target}.`);
    }

    return {
      lat: coordinate.lat,
      lng: coordinate.lng,
      userId,
    };
  });

export const DEMO_PRESIDIO_LOCATIONS = buildDemoMemberLocations(
  DEMO_MEMBER_IDS,
  "presidio",
);

export const DEMO_CHINATOWN_LOCATIONS = buildDemoMemberLocations(
  DEMO_MEMBER_IDS,
  "chinatown",
);
