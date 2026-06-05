import { createStubAdventureGen } from "./adventureGen.js";
import { buildDemoMemberLocations } from "./demoLocations.js";
import { createRecordingDelivery } from "./delivery.js";
import { createEngine } from "./engine.js";
import { createStubMemory } from "./memory.js";
import { OutMessageSchema } from "./schemas.js";
import { createStubStore } from "./store.js";
import {
  parseTerminalCommand,
  TerminalTextInputSchema,
} from "./terminalCommands.js";
import { createStubVenueSource } from "./venues.js";

import type { DeliveryRecord } from "./delivery.js";
import type { Engine } from "./engine.js";
import type { Memory } from "./memory.js";
import type { OutMessage, Vibe } from "./schemas.js";
import type { Store } from "./store.js";
import type { MoveTarget, TerminalTextInput } from "./terminalCommands.js";
import type { AdventureGen } from "./adventureGen.js";

type RecordingDelivery = ReturnType<typeof createRecordingDelivery>;

type TerminalGroupSession = {
  delivery: RecordingDelivery;
  engine: Engine;
  groupId: string;
  memberIds: Set<string>;
  pendingStart: boolean;
  started: boolean;
  store: Store;
};

export type TerminalSessionController = {
  handleText: (input: TerminalTextInput) => Promise<readonly OutMessage[]>;
};

export type TerminalSessionControllerOptions = {
  adventureGen?: AdventureGen;
  clock?: () => Date;
  memory?: Memory;
  noiseSigmaM?: number;
  random?: () => number;
  store?: Store;
};

const stableRandom = (): number => 0.5;

const terminalMessage = (body: string): OutMessage =>
  OutMessageSchema.parse({ body });

export const TERMINAL_HELP_MESSAGE = [
  "Parea terminal commands:",
  "/start - choose a vibe for a new Wander",
  "/start mellow - start immediately with a vibe",
  "/join - add yourself to the terminal group",
  "/vibe mellow - choose mellow, foodie, cultural, or active",
  "/move chinatown - simulate leaving the current zone",
  "/move presidio - simulate staying near the starting zone",
  "/status - show the current terminal session state",
  "",
  "Judge-friendly phrases also work:",
  "we want something mellow",
  "I am in",
  "we moved to Chinatown",
  "where are we?",
].join("\n");

const targetToDemoLocation = (target: MoveTarget): "chinatown" | "presidio" => {
  switch (target) {
    case "chinatown":
    case "outside":
      return "chinatown";
    case "inside":
    case "presidio":
      return "presidio";
  }
};

const formatValidationFailure = (): OutMessage =>
  terminalMessage("Send a text command. Use help to see the terminal commands.");

const groupIdForSpace = (spaceId: string): string => {
  const normalized = spaceId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `terminal_${normalized}`;
};

const createSession = (
  spaceId: string,
  {
    adventureGen = createStubAdventureGen(createStubVenueSource()),
    clock = () => new Date("2026-06-05T19:00:00.000Z"),
    memory = createStubMemory(),
    noiseSigmaM = 0,
    random = stableRandom,
    store = createStubStore(),
  }: TerminalSessionControllerOptions,
): TerminalGroupSession => {
  const delivery = createRecordingDelivery();
  const engine = createEngine({
    adventureGen,
    clock,
    delivery,
    memory,
    noiseSigmaM,
    random,
    store,
  });

  return {
    delivery,
    engine,
    groupId: groupIdForSpace(spaceId),
    memberIds: new Set<string>(),
    pendingStart: false,
    started: false,
    store,
  };
};

const newDeliveryMessages = (
  delivery: RecordingDelivery,
  fromIndex: number,
): readonly OutMessage[] =>
  delivery.records
    .slice(fromIndex)
    .map((record: DeliveryRecord) => record.message);

const startWander = async (
  session: TerminalGroupSession,
  initiatorId: string,
  vibe: Vibe,
): Promise<readonly OutMessage[]> => {
  if (session.started) {
    return [
      terminalMessage(
        "A Wander is already active. Use move chinatown to test rerouting.",
      ),
    ];
  }

  session.memberIds.add(initiatorId);
  const memberIds = [...session.memberIds];
  const deliveryStart = session.delivery.records.length;

  await session.engine.startWander({
    groupId: session.groupId,
    initialLocations: buildDemoMemberLocations(memberIds, "presidio"),
    initiatorId,
    memberIds,
    vibe,
  });
  session.pendingStart = false;
  session.started = true;

  return newDeliveryMessages(session.delivery, deliveryStart);
};

const moveGroup = async (
  session: TerminalGroupSession,
  target: MoveTarget,
): Promise<readonly OutMessage[]> => {
  if (!session.started) {
    return [terminalMessage("Start a Wander first with start.")];
  }

  const deliveryStart = session.delivery.records.length;
  const rerouted = await session.engine.handleZoneExit({
    groupId: session.groupId,
    locations: buildDemoMemberLocations(
      [...session.memberIds],
      targetToDemoLocation(target),
    ),
  });

  if (!rerouted) {
    return [terminalMessage("The group is still inside the active zone.")];
  }

  return newDeliveryMessages(session.delivery, deliveryStart);
};

const statusMessage = async (
  session: TerminalGroupSession,
): Promise<OutMessage> => {
  if (!session.started) {
    return terminalMessage(
      session.pendingStart
        ? "Waiting for a vibe. Use vibe mellow, foodie, cultural, or active."
        : "No Wander is active. Use start to begin.",
    );
  }

  const latestAdventure = await session.store.getLatestAdventure(
    session.groupId,
  );
  const title = latestAdventure?.title ?? "unknown adventure";

  return terminalMessage(
    `Active Wander: ${title}. Members: ${session.memberIds.size}.`,
  );
};

export const createTerminalSessionController =
  (
    options: TerminalSessionControllerOptions = {},
  ): TerminalSessionController => {
    const sessionsBySpace = new Map<string, TerminalGroupSession>();

    const getSession = (spaceId: string): TerminalGroupSession => {
      const existing = sessionsBySpace.get(spaceId);
      if (existing !== undefined) {
        return existing;
      }

      const created = createSession(spaceId, options);
      sessionsBySpace.set(spaceId, created);
      return created;
    };

    return {
      handleText: async (input) => {
        const parsedInput = TerminalTextInputSchema.safeParse(input);
        if (!parsedInput.success) {
          return [formatValidationFailure()];
        }

        const { spaceId, text, userId } = parsedInput.data;
        const session = getSession(spaceId);
        const command = parseTerminalCommand(text);

        switch (command.kind) {
          case "help":
            return [terminalMessage(TERMINAL_HELP_MESSAGE)];
          case "join":
            session.memberIds.add(userId);
            return [
              terminalMessage(
                `Joined this terminal Wander. Members: ${session.memberIds.size}.`,
              ),
            ];
          case "move":
            return moveGroup(session, command.target);
          case "start":
            if (command.vibe === undefined) {
              session.memberIds.add(userId);
              session.pendingStart = true;
              return [
                terminalMessage(
                  "Choose a vibe with vibe mellow, foodie, cultural, or active.",
                ),
              ];
            }

            return startWander(session, userId, command.vibe);
          case "status":
            return [await statusMessage(session)];
          case "unknown":
            return [terminalMessage(command.reason)];
        }
      },
    };
  };

export const formatTerminalOutMessage = (message: OutMessage): string => {
  if (message.mapUrl === undefined) {
    return message.body;
  }

  return `${message.body}\nMap: ${message.mapUrl}`;
};
