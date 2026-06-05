import { z } from "zod";

const LatitudeSchema = z.number().min(-90).max(90);
const LongitudeSchema = z.number().min(-180).max(180);
const NonEmptyStringSchema = z.string().trim().min(1);

export const VibeSchema = z.enum(["mellow", "foodie", "cultural", "active"]);
export type Vibe = z.infer<typeof VibeSchema>;

export const ZoneSchema = z.object({
  centerLat: LatitudeSchema,
  centerLng: LongitudeSchema,
  radiusM: z.number().positive(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const VenueSchema = z.object({
  category: NonEmptyStringSchema,
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  name: NonEmptyStringSchema,
  openNow: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
});
export type Venue = z.infer<typeof VenueSchema>;

export const BeatSchema = z.object({
  order: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: NonEmptyStringSchema,
  venue: VenueSchema,
});
export type Beat = z.infer<typeof BeatSchema>;

export const AdventureSchema = z.object({
  beats: z.array(BeatSchema).length(3),
  groupId: NonEmptyStringSchema,
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  vibe: VibeSchema,
  zone: ZoneSchema,
});
export type Adventure = z.infer<typeof AdventureSchema>;

export const GroupSchema = z.object({
  createdAt: z.string().datetime(),
  id: NonEmptyStringSchema,
  initiatorId: NonEmptyStringSchema,
  vibe: VibeSchema.optional(),
});
export type Group = z.infer<typeof GroupSchema>;

export const MembershipSchema = z.object({
  groupId: NonEmptyStringSchema,
  joinedAt: z.string().datetime(),
  userId: NonEmptyStringSchema,
});
export type Membership = z.infer<typeof MembershipSchema>;

export const BeliefRefSchema = z.object({
  groupId: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  xtraceId: NonEmptyStringSchema,
});
export type BeliefRef = z.infer<typeof BeliefRefSchema>;

export const LocationUpdateSchema = z.object({
  groupId: NonEmptyStringSchema,
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  userId: NonEmptyStringSchema,
});
export type LocationUpdate = z.infer<typeof LocationUpdateSchema>;

export const OutMessageSchema = z.object({
  body: NonEmptyStringSchema,
  mapUrl: z.string().url().optional(),
  title: NonEmptyStringSchema.optional(),
});
export type OutMessage = z.infer<typeof OutMessageSchema>;
