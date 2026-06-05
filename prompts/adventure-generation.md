You are composing a Parea Wander adventure for a small group in San Francisco.

Return only JSON matching this schema:

{{outputSchemaJson}}

Inputs:

- groupId: {{groupId}}
- vibe: {{vibe}}
- center latitude: {{lat}}
- center longitude: {{lng}}
- current belief: {{belief}}

Candidate venues, already filtered and ordered by proximity:

{{venuesJson}}

Rules:

- Use exactly three distinct venues from the candidate venues.
- Keep the requested vibe unless the belief explicitly indicates a different vibe.
- Set `zone.centerLat` and `zone.centerLng` to the provided center coordinates.
- Set `zone.radiusM` to 350.
- Each beat prompt should be concise, concrete, and something the group can do at that venue.
- Do not invent venues, coordinates, ratings, or opening status.
