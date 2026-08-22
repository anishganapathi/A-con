import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { lockWorkspaceTurn, resolveAgentRole, runConstructionAgent } from "./runAgent";
import type { AgentTurn } from "./types";

describe("lock mode", () => {
  test("routes construct and extract prompts to edit when locked", () => {
    expect(resolveAgentRole("Build a 12×8 house", undefined, true, mockFloorPlan)).toBe("edit");
    expect(resolveAgentRole("Extract these sheets", [{ name: "a.pdf", type: "application/pdf", size: 1 }], true)).toBe(
      "edit",
    );
  });

  test("routes a room size change to edit", () => {
    expect(
      resolveAgentRole("increase the l3 living room size to 38 m", undefined, false, mockFloorPlan),
    ).toBe("edit");
    expect(
      resolveAgentRole(
        "decrease the L3 living room size to 40 keeping the remaining floors in the same size.",
        undefined,
        false,
        mockFloorPlan,
      ),
    ).toBe("edit");
  });

  test("leaves unlocked construct prompts alone", () => {
    expect(resolveAgentRole("Build a 12×8 house", undefined, false, mockFloorPlan)).toBe(
      "construct",
    );
  });

  test("strips rebuilds and keeps patch actions", () => {
    const turn: AgentTurn = {
      agent: "construct",
      planner: "llm",
      reply: "Rebuilt the tower.",
      draftSpec: { name: "New" } as AgentTurn["draftSpec"],
      actions: [
        { type: "replace_plan", plan: mockFloorPlan, note: "Rebuilt" },
        { type: "patch_wall", wallId: "w1", patch: { thickness: 0.4 } },
      ],
    };

    const locked = lockWorkspaceTurn(turn);
    expect(locked.agent).toBe("edit");
    expect(locked.draftSpec).toBeUndefined();
    expect(locked.actions).toEqual([{ type: "patch_wall", wallId: "w1", patch: { thickness: 0.4 } }]);
    expect(locked.reply).toMatch(/locked/i);
  });

  test("does not replace the live plan from a construct prompt", async () => {
    const turn = await runConstructionAgent({
      text: "Build a 20×12 two-story house",
      plan: mockFloorPlan,
      locked: true,
    });

    expect(turn.agent).toBe("edit");
    expect(turn.draftSpec).toBeUndefined();
    expect(turn.actions.some((action) => action.type === "replace_plan")).toBe(false);
  });

  test("a locked grow past the plate is still an edit, so Nemoclaw can hold it", async () => {
    const turn = await runConstructionAgent({
      text: "increase the living room to 40m",
      plan: mockFloorPlan,
      locked: true,
    });

    expect(turn.agent).toBe("edit");
    expect(turn.actions).toEqual([
      { type: "resize_room", roomId: "living", areaSqM: 40, stack: true },
    ]);
  });

  test("still applies live edits while locked", async () => {
    const turn = await runConstructionAgent({
      text: "paint exterior walls warmer",
      plan: mockFloorPlan,
      locked: true,
    });

    expect(turn.actions.length).toBeGreaterThan(0);
    expect(turn.actions.every((action) => action.type !== "replace_plan")).toBe(true);
  });

  test("intent agent resizes a named room without a rigid sentence", async () => {
    const turn = await runConstructionAgent({
      text: "decrease the L3 living room size to 40 keeping the remaining floors in the same size.",
      plan: mockFloorPlan,
      locked: true,
    });

    expect(turn.planner).toBe("intent");
    expect(turn.actions).toEqual([
      { type: "resize_room", roomId: "l3-living", areaSqM: 40, stack: false },
    ]);
    expect(turn.reply).toMatch(/steps back/i);
    expect(turn.followUp?.options.some((option) => option.prompt === "remove the roof")).toBe(
      true,
    );
  });

  test("keep the roof is an edit, not an explanation dump", async () => {
    const turn = await runConstructionAgent({
      text: "Keep the roof",
      plan: mockFloorPlan,
      locked: true,
    });

    expect(turn.agent).toBe("edit");
    expect(turn.reply).toMatch(/keeping the roof/i);
    expect(turn.actions).toEqual([]);
  });

  test("an elevation image stays in edit and does not rebuild", async () => {
    const turn = await runConstructionAgent({
      text: "match this elevation",
      plan: mockFloorPlan,
      locked: true,
      attachments: [
        { name: "elev.png", type: "image/png", size: 12, dataUrl: "data:image/png;base64,aaa" },
      ],
    });

    expect(turn.agent).toBe("edit");
    expect(turn.actions.some((action) => action.type === "replace_plan")).toBe(false);
  });

  test("removing the roof hides it", async () => {
    const turn = await runConstructionAgent({
      text: "removing the roof",
      plan: mockFloorPlan,
      locked: true,
    });

    expect(turn.agent).toBe("edit");
    expect(turn.actions).toEqual([{ type: "patch_roof", patch: { visible: false } }]);
  });
});
