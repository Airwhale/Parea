import type { Adventure, OutMessage } from "./schemas.js";

export type Delivery = {
  sendToGroup: (groupId: string, message: OutMessage) => Promise<void>;
};

export type DeliveryRecord = {
  groupId: string;
  message: OutMessage;
};

export const adventureToMessage = (
  adventure: Adventure,
  prefix = "Your Wander is ready",
): OutMessage => ({
  body: [
    `${prefix}: ${adventure.title}`,
    ...adventure.beats.map(
      (beat) => `${beat.order}. ${beat.venue.name}: ${beat.prompt}`,
    ),
  ].join("\n"),
  mapUrl: `https://www.google.com/maps/search/?api=1&query=${adventure.zone.centerLat},${adventure.zone.centerLng}`,
  title: adventure.title,
});

export const createConsoleDelivery = (): Delivery => ({
  sendToGroup: async (groupId, message) => {
    console.log(
      JSON.stringify({
        groupId,
        message,
        type: "delivery",
      }),
    );
  },
});

export const createRecordingDelivery = (): Delivery & {
  records: readonly DeliveryRecord[];
} => {
  const records: DeliveryRecord[] = [];

  return {
    records,
    sendToGroup: async (groupId, message) => {
      records.push({ groupId, message });
    },
  };
};
