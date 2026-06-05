import { describe, expect, it } from "vitest";

import { parseTerminalCommand } from "../src/terminalCommands.js";

describe("terminal commands", () => {
  it("parses command keywords case-insensitively", () => {
    expect(parseTerminalCommand(" START   mellow ")).toEqual({
      kind: "start",
      vibe: "mellow",
    });
    expect(parseTerminalCommand("JOIN")).toEqual({ kind: "join" });
    expect(parseTerminalCommand("status")).toEqual({ kind: "status" });
  });

  it("maps vibe selection to a start command", () => {
    expect(parseTerminalCommand("vibe foodie")).toEqual({
      kind: "start",
      vibe: "foodie",
    });
  });

  it("parses movement simulation commands", () => {
    expect(parseTerminalCommand("move chinatown")).toEqual({
      kind: "move",
      target: "chinatown",
    });
    expect(parseTerminalCommand("move inside")).toEqual({
      kind: "move",
      target: "inside",
    });
  });

  it("returns actionable reasons for invalid commands", () => {
    expect(parseTerminalCommand("vibe loud")).toMatchObject({
      kind: "unknown",
      reason: expect.stringContaining("vibe mellow"),
    });
    expect(parseTerminalCommand("move nowhere")).toMatchObject({
      kind: "unknown",
      reason: expect.stringContaining("move presidio"),
    });
    expect(parseTerminalCommand("hello")).toMatchObject({
      kind: "unknown",
      reason: expect.stringContaining("help"),
    });
  });
});
