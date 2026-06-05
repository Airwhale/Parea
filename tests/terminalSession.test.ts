import { describe, expect, it } from "vitest";

import {
  createTerminalSessionController,
  formatTerminalOutMessage,
  TERMINAL_HELP_MESSAGE,
} from "../src/terminalSession.js";

const input = (text: string, userId = "user_ada") => ({
  spaceId: "terminal-room",
  text,
  userId,
});

describe("terminal session controller", () => {
  it("shows command help", async () => {
    const controller = createTerminalSessionController();

    await expect(controller.handleText(input("help"))).resolves.toEqual([
      { body: TERMINAL_HELP_MESSAGE },
    ]);
  });

  it("runs a start, join, and reroute sequence through the engine", async () => {
    const controller = createTerminalSessionController();

    await expect(controller.handleText(input("start"))).resolves.toEqual([
      {
        body: "Choose a vibe with vibe mellow, foodie, cultural, or active.",
      },
    ]);
    await expect(
      controller.handleText(input("join", "user_grace")),
    ).resolves.toEqual([
      {
        body: "Joined this terminal Wander. Members: 2.",
      },
    ]);

    const started = await controller.handleText(input("vibe mellow"));
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      body: expect.stringContaining("Your Wander is ready: Presidio Stroll"),
      mapUrl: expect.stringContaining("google.com/maps"),
      title: "Presidio Stroll",
    });

    await expect(controller.handleText(input("move presidio"))).resolves.toEqual(
      [{ body: "The group is still inside the active zone." }],
    );

    const rerouted = await controller.handleText(input("move chinatown"));
    expect(rerouted).toHaveLength(1);
    expect(rerouted[0]).toMatchObject({
      body: expect.stringContaining("Reroute: Chinatown Snack Quest"),
      mapUrl: expect.stringContaining("google.com/maps"),
      title: "Chinatown Snack Quest",
    });

    await expect(controller.handleText(input("status"))).resolves.toEqual([
      {
        body: "Active Wander: Chinatown Snack Quest. Members: 2.",
      },
    ]);
  });

  it("rejects movement before a Wander starts", async () => {
    const controller = createTerminalSessionController();

    await expect(controller.handleText(input("move chinatown"))).resolves.toEqual(
      [{ body: "Start a Wander first with start." }],
    );
  });

  it("formats map links for Spectrum terminal output", () => {
    expect(
      formatTerminalOutMessage({
        body: "Route ready.",
        mapUrl: "https://example.com/map",
      }),
    ).toBe("Route ready.\nMap: https://example.com/map");
  });
});
