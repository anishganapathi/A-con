import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { applyAgentAction } from "./applyAction";
import { narrateEdit } from "./followUp";
import { actionsFromIntent, interpretIntent } from "./intentAgent";

describe("edit follow-up", () => {
  test("asks about the roof after a setback resize", () => {
    const intent = interpretIntent(
      "decrease the L3 living room size to 40 keeping the remaining floors in the same size.",
      mockFloorPlan,
    );
    const after = actionsFromIntent(intent).reduce(applyAgentAction, mockFloorPlan);
    const story = narrateEdit(intent, mockFloorPlan, after);

    expect(story.reply).toMatch(/steps back/i);
    expect(story.followUp?.prompt).toMatch(/roof/i);
    expect(story.followUp?.options.some((option) => option.prompt === "remove the roof")).toBe(
      true,
    );
  });

  test("offers to add a roof when the top is already open", () => {
    const open = { ...mockFloorPlan, roof: { ...mockFloorPlan.roof, visible: false } };
    const intent = interpretIntent("increase the L3 living room size to 90 m", open);
    const after = actionsFromIntent(intent).reduce(applyAgentAction, open);
    const story = narrateEdit(intent, open, after);

    expect(story.followUp?.options.some((option) => option.prompt === "add the roof")).toBe(true);
  });

  test("asks to put the roof back after hiding it", () => {
    const intent = interpretIntent("remove the roof", mockFloorPlan);
    const after = { ...mockFloorPlan, roof: { ...mockFloorPlan.roof, visible: false } };
    const story = narrateEdit(intent, mockFloorPlan, after);

    expect(story.followUp?.options[0]).toMatchObject({
      prompt: "add the roof",
      recommended: true,
    });
  });
});
