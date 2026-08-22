import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { applyAgentAction, describeAction } from "./applyAction";
import { bindVisionEdits } from "./bindVisionEdits";
import type { AgentAction } from "./types";

function bind(action: unknown, text = "") {
  return bindVisionEdits(mockFloorPlan, [action as AgentAction], text);
}

describe("adding a service the model cannot name", () => {
  test("a patch with no run id becomes a routed addition", () => {
    // What the local model actually returns for "add a cable in the L3 living
    // room": a patch, because a run that does not exist has no id to patch.
    const [action] = bind(
      { type: "patch_electrical", room: "l3-living", cable: "extra_cable" },
      "i need an extra electric cable in the l3 living room",
    );

    expect(action.type).toBe("add_electrical");
    if (action.type !== "add_electrical") return;
    expect(action.floorId).toBe("l3");
    expect(action.run.circuit).toBe("power");
    expect(action.run.points.length).toBeGreaterThanOrEqual(2);
    expect(describeAction(action)).toContain("L3 Living Room");
  });

  test("the addition lands on the plan", () => {
    const before = mockFloorPlan.floors.find((floor) => floor.id === "l3")!.electrical;
    const [action] = bind(
      { type: "add_electrical", room: "l3-living", circuit: "power" },
      "add a cable",
    );
    const next = applyAgentAction(mockFloorPlan, action);
    const after = next.floors.find((floor) => floor.id === "l3")!.electrical;

    expect(after).toHaveLength(before.length + 1);
    expect(after.at(-1)!.id).not.toBe(before.at(-1)!.id);
  });

  test("routes lighting at the ceiling and power at socket height", () => {
    const [light] = bind({ type: "add_electrical", room: "l3-living", circuit: "lighting" });
    const [power] = bind({ type: "add_electrical", room: "l3-living", circuit: "power" });

    if (light.type !== "add_electrical" || power.type !== "add_electrical") {
      throw new Error("expected electrical additions");
    }
    expect(light.run.points[0].height).toBeGreaterThan(2);
    expect(power.run.points[0].height).toBeLessThan(1);
  });

  test("reads the room from the prompt when the action does not name it", () => {
    const [action] = bind(
      { type: "add_electrical", circuit: "power" },
      "add a socket in the l2 kitchen",
    );

    expect(action.type).toBe("add_electrical");
    if (action.type !== "add_electrical") return;
    expect(action.floorId).toBe("l2");
    expect(action.run.name).toContain("Kitchen");
  });

  test("a pipe request becomes a pipe, not a cable", () => {
    const [action] = bind(
      { type: "patch_pipe", room: "l3-bath" },
      "i need an extra water pipe in the l3 bathroom",
    );

    expect(action.type).toBe("add_pipe");
    if (action.type !== "add_pipe") return;
    expect(action.pipe.system).toBe("supply");
  });

  test("a patch against a real run is left alone", () => {
    const runId = mockFloorPlan.floors.find((floor) => floor.id === "l3")!.electrical[0].id;
    const [action] = bind({ type: "patch_electrical", runId, patch: { diameter: 0.05 } });

    expect(action.type).toBe("patch_electrical");
    if (action.type !== "patch_electrical") return;
    expect(action.runId).toBe(runId);
  });

  test("a request naming no room at all is dropped", () => {
    expect(bind({ type: "patch_electrical", cable: "extra" }, "add a cable")).toEqual([]);
  });
});

describe("removing a service", () => {
  const pipeId = mockFloorPlan.floors.find((floor) => floor.id === "l3")!.pipes[0].id;

  test("a deletion smuggled inside a patch becomes a removal, not an addition", () => {
    // The local model answers "remove the balcony pipe" with exactly this.
    const [action] = bind(
      { type: "patch_pipe", id: pipeId, action: "remove" },
      "remove the water pipe line balcony",
    );

    expect(action.type).toBe("remove");
    if (action.type !== "remove") return;
    expect(action.selection).toEqual({ kind: "pipe", id: pipeId });
  });

  test("a deletion of something that is not there adds nothing", () => {
    expect(
      bind({ type: "patch_pipe", id: "l2-pipe-ghost", action: "remove" }, "remove that pipe"),
    ).toEqual([]);
  });

  test("a bare id is classified against the plan, not the model's guess", () => {
    const [action] = bind({ type: "remove", selection: { kind: "wall", id: pipeId } });

    expect(action.type).toBe("remove");
    if (action.type !== "remove") return;
    expect(action.selection.kind).toBe("pipe");
  });

  test("removing something that does not exist is dropped", () => {
    expect(bind({ type: "remove", selection: { kind: "pipe", id: "nope" } })).toEqual([]);
  });

  test("a patch keyed on id still patches", () => {
    const [action] = bind({ type: "patch_pipe", id: pipeId, diameter: 0.09 });

    expect(action.type).toBe("patch_pipe");
    if (action.type !== "patch_pipe") return;
    expect(action.pipeId).toBe(pipeId);
    expect(action.patch).toEqual({ diameter: 0.09 });
  });
});
