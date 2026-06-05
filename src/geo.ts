import type { Coordinate, MemberLocation, Zone } from "./schemas.js";

// Privacy rule: individual member coordinates are transient inputs only. They
// are used to compute a noised group centroid and must never be stored or sent.

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_DEGREE_LAT = 111_320;

export type RandomSource = () => number;

export type NoiseOptions = {
  random?: RandomSource;
  sigmaM?: number;
};

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;

const metersToLatitudeDegrees = (metersNorth: number): number =>
  metersNorth / METERS_PER_DEGREE_LAT;

const metersToLongitudeDegrees = (
  metersEast: number,
  latitude: number,
): number =>
  metersEast / (METERS_PER_DEGREE_LAT * Math.cos(degreesToRadians(latitude)));

const gaussian = (random: RandomSource): number => {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

export const centroid = (locations: readonly MemberLocation[]): Coordinate => {
  if (locations.length === 0) {
    throw new Error("At least one location is required to compute a centroid.");
  }

  let x = 0;
  let y = 0;
  let z = 0;

  for (const location of locations) {
    const lat = degreesToRadians(location.lat);
    const lng = degreesToRadians(location.lng);

    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }

  const total = locations.length;
  x /= total;
  y /= total;
  z /= total;

  const lng = Math.atan2(y, x);
  const hypotenuse = Math.sqrt(x * x + y * y);
  const lat = Math.atan2(z, hypotenuse);

  return {
    lat: radiansToDegrees(lat),
    lng: radiansToDegrees(lng),
  };
};

export const noisedCentroid = (
  locations: readonly MemberLocation[],
  { random = Math.random, sigmaM = 200 }: NoiseOptions = {},
): Coordinate => {
  const center = centroid(locations);
  const metersNorth = gaussian(random) * sigmaM;
  const metersEast = gaussian(random) * sigmaM;

  return {
    lat: center.lat + metersToLatitudeDegrees(metersNorth),
    lng: center.lng + metersToLongitudeDegrees(metersEast, center.lat),
  };
};

export const haversineDistanceM = (
  first: Coordinate,
  second: Coordinate,
): number => {
  const deltaLat = degreesToRadians(second.lat - first.lat);
  const deltaLng = degreesToRadians(second.lng - first.lng);
  const firstLat = degreesToRadians(first.lat);
  const secondLat = degreesToRadians(second.lat);
  const a = Math.min(
    1,
    Math.sin(deltaLat / 2) ** 2 +
      Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2,
  );

  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const isOutsideZone = (
  location: Coordinate,
  zone: Zone,
  hysteresisM = 25,
): boolean =>
  haversineDistanceM(location, {
    lat: zone.centerLat,
    lng: zone.centerLng,
  }) > zone.radiusM + hysteresisM;
