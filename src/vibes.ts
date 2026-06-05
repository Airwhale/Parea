import type { Vibe } from "./schemas.js";

export const VIBE_QUERIES: Record<Vibe, readonly string[]> = {
  active: ["trailhead", "climbing", "bike_rental", "pier", "stairs"],
  cultural: ["art_gallery", "mural", "museum", "historic_site", "bookshop"],
  foodie: ["bakery", "dim_sum", "tea_house", "market", "dessert"],
  mellow: ["park", "garden", "viewpoint", "cafe", "bookshop"],
};
