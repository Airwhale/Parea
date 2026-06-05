import { z } from "zod";

import { VibeSchema } from "./schemas.js";

import type { Vibe } from "./schemas.js";

const NonEmptyTextSchema = z.string().trim().min(1);

export const TerminalTextInputSchema = z.object({
  spaceId: NonEmptyTextSchema,
  text: NonEmptyTextSchema,
  userId: NonEmptyTextSchema,
});
export type TerminalTextInput = z.infer<typeof TerminalTextInputSchema>;

export const MoveTargetSchema = z.enum([
  "chinatown",
  "outside",
  "presidio",
  "inside",
]);
export type MoveTarget = z.infer<typeof MoveTargetSchema>;

export type TerminalCommand =
  | { kind: "help" }
  | { kind: "join" }
  | { kind: "move"; target: MoveTarget }
  | { kind: "start"; vibe?: Vibe }
  | { kind: "status" }
  | { kind: "unknown"; reason: string };

const parseVibe = (value: string | undefined): Vibe | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const result = VibeSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

const parseMoveTarget = (value: string | undefined): MoveTarget | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const result = MoveTargetSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

const startCommand = (argument: string | undefined): TerminalCommand => {
  if (argument === undefined) {
    return { kind: "start" };
  }

  const vibe = parseVibe(argument);
  if (vibe === undefined) {
    return {
      kind: "unknown",
      reason: "Use start mellow, start foodie, start cultural, or start active.",
    };
  }

  return { kind: "start", vibe };
};

const vibeCommand = (argument: string | undefined): TerminalCommand => {
  const vibe = parseVibe(argument);
  if (vibe === undefined) {
    return {
      kind: "unknown",
      reason: "Use vibe mellow, vibe foodie, vibe cultural, or vibe active.",
    };
  }

  return { kind: "start", vibe };
};

const moveCommand = (argument: string | undefined): TerminalCommand => {
  const target = parseMoveTarget(argument);
  if (target === undefined) {
    return {
      kind: "unknown",
      reason: "Use move presidio, move inside, move chinatown, or move outside.",
    };
  }

  return { kind: "move", target };
};

const parseNaturalLanguageCommand = (text: string): TerminalCommand => {
  const normalized = text.toLowerCase();
  const vibe = VibeSchema.options.find((candidate) =>
    new RegExp(`\\b${candidate}\\b`, "iu").test(normalized),
  );

  if (/\b(help|commands?|what can i say)\b/iu.test(normalized)) {
    return { kind: "help" };
  }

  if (/\b(status|where are we|what is active|what's active)\b/iu.test(normalized)) {
    return { kind: "status" };
  }

  if (
    /\b(join|i am in|i'm in|add me|count me in|invite me)\b/iu.test(
      normalized,
    )
  ) {
    return { kind: "join" };
  }

  if (/\b(chinatown|outside)\b/iu.test(normalized)) {
    return { kind: "move", target: "chinatown" };
  }

  if (/\b(presidio|inside)\b/iu.test(normalized)) {
    return { kind: "move", target: "presidio" };
  }

  if (vibe !== undefined) {
    return { kind: "start", vibe };
  }

  if (/\b(start|begin|wander|let's go|lets go)\b/iu.test(normalized)) {
    return { kind: "start" };
  }

  return {
    kind: "unknown",
    reason: "Unknown command. Use help to see the terminal commands.",
  };
};

export const parseTerminalCommand = (text: string): TerminalCommand => {
  const trimmed = text.trim();
  const [rawKeyword, rawArgument] = trimmed.toLowerCase().split(/\s+/);
  const keyword = rawKeyword?.replace(/^\//, "");

  switch (keyword) {
    case "help":
      return { kind: "help" };
    case "join":
      return { kind: "join" };
    case "move":
      return moveCommand(rawArgument);
    case "start":
      return startCommand(rawArgument);
    case "status":
      return { kind: "status" };
    case "vibe":
      return vibeCommand(rawArgument);
    default:
      return parseNaturalLanguageCommand(trimmed);
  }
};
