import { describe, expect, test } from "vitest";
import { applyMasterCall, parseMasterCall } from "./masterIntent";

describe("master intent tools", () => {
  test("routes a similar-elevation prompt to match_elevation", () => {
    const call = parseMasterCall(
      JSON.stringify({
        tool: "match_elevation",
        arguments: { reply: "Steepen the gable.", ridgeHeight: 14.2, windowWidth: 1 },
      }),
    );
    expect(call.tool).toBe("match_elevation");
    const applied = applyMasterCall(call, { text: "front elevation should be similar" });
    expect(applied.agent).toBe("edit");
    expect(applied.elevation).toMatchObject({ ridgeHeight: 14.2, windowWidth: 1 });
  });

  test("routes a similar-elevation prompt to edit_live_model", () => {
    const call = parseMasterCall(
      JSON.stringify({
        tool: "edit_live_model",
        arguments: {
          reply: "I will match the live roof heights to the drawing.",
          actions: [{ type: "patch_roof", patch: { ridgeHeight: 13 } }],
        },
      }),
    );
    expect(call.tool).toBe("edit_live_model");
    const applied = applyMasterCall(call, { text: "make the elevation similar" });
    expect(applied.agent).toBe("edit");
    expect(applied.actions).toEqual([{ type: "patch_roof", patch: { ridgeHeight: 13 } }]);
  });

  test("routes a rebuild prompt to propose_building", () => {
    const call = parseMasterCall(
      JSON.stringify({
        tool: "propose_building",
        arguments: {
          reply: "New house from the sheet.",
          spec: { typology: "residential", width: 12, depth: 9, stories: 2 },
        },
      }),
    );
    expect(call.tool).toBe("propose_building");
    expect(applyMasterCall(call, { text: "rebuild from this" }).agent).toBe("construct");
  });

  test("reads a call the model wrote out with OpenAI's name/arguments shape", () => {
    // What "hello" actually comes back as: routed right, but written as text in
    // the {"name","arguments"} shape rather than sent down the tool channel.
    const call = parseMasterCall(
      JSON.stringify({
        name: "explain",
        arguments: { reply: "Hello! Ask me to build, edit, or read a drawing." },
      }),
    );

    expect(call.tool).toBe("explain");
    const applied = applyMasterCall(call, { text: "hello" });
    expect(applied.agent).toBe("explain");
    expect(applied.reply).toBe("Hello! Ask me to build, edit, or read a drawing.");
  });

  test("does not leave a greeting reading as raw JSON", () => {
    const applied = applyMasterCall(
      parseMasterCall(
        JSON.stringify({ name: "explain", arguments: { reply: "Hi there." } }),
      ),
      { text: "hello" },
    );

    expect(String(applied.reply)).not.toContain("{");
    expect(String(applied.reply)).not.toContain("arguments");
  });

  test("routes an edit written in the name/arguments shape", () => {
    const call = parseMasterCall(
      JSON.stringify({
        name: "edit_live_model",
        arguments: {
          reply: "Raising the ridge.",
          actions: [{ type: "patch_roof", patch: { ridgeHeight: 13 } }],
        },
      }),
    );

    expect(call.tool).toBe("edit_live_model");
    expect(applyMasterCall(call, { text: "raise the ridge" }).actions).toEqual([
      { type: "patch_roof", patch: { ridgeHeight: 13 } },
    ]);
  });

  test("recovers Ground and First from a truncated VL dump", () => {
    const dump = `{"reply": "Rebuilding from the provided floor plans.", "spec": {"typology": "residential", "width": 7.6, "depth": 12.2, "stories": 2, "footprint": [{"name": "Ground Floor", "zones": [{"name": "Parking", "x": 4.6, "y": 0, "w": 3.0, "h": 5.1, "kind": "entry"}]}, {"name": "First Floor", "zones": [{"name": "Kitchen", "x": 4.3, "y": 7.6, "w": 2.4, "h": 3.0, "kind": "wet"}]}, {"name": "Twelfth Floor", "zones": [{"name": "L12 Living Room"`;
    const call = parseMasterCall(dump);
    expect(call.tool).toBe("propose_building");
    expect(call.arguments.reply).toMatch(/Rebuilding/i);
    const spec = call.arguments.spec as { width?: number; footprint?: { name: string }[] };
    expect(spec.width).toBe(7.6);
    expect(spec.footprint?.map((floor) => floor.name) ?? spec).toBeTruthy();
  });

  test("marks a drawing rebuild as measured so chat will not ask the plate size", () => {
    const call = parseMasterCall(
      JSON.stringify({
        tool: "propose_building",
        arguments: {
          reply: "From the sheet.",
          spec: { typology: "residential", width: 25, depth: 40, stories: 2 },
        },
      }),
    );
    const applied = applyMasterCall(call, {
      text: "rebuild",
      attachments: [{ dataUrl: "data:image/png;base64,aaa" }],
    });
    expect((applied.spec as { measured?: boolean }).measured).toBe(true);
  });

  test("does not rebuild when the workspace is locked", () => {
    const call = parseMasterCall(
      JSON.stringify({
        tool: "propose_building",
        arguments: { reply: "Rebuild.", spec: { width: 10 } },
      }),
    );
    const applied = applyMasterCall(call, { locked: true });
    expect(applied.agent).toBe("edit");
    expect(applied.spec).toBeUndefined();
  });

  test("reads tool arguments that are already an object", () => {
    const call = parseMasterCall("", {
      tool_calls: [
        {
          function: {
            name: "edit_live_model",
            arguments: { reply: "Match the eave.", actions: [] },
          },
        },
      ],
    });
    expect(call.tool).toBe("edit_live_model");
    expect(call.arguments.reply).toBe("Match the eave.");
  });

  test("reads a JSON string in arguments", () => {
    const call = parseMasterCall(
      JSON.stringify({
        tool: "explain",
        arguments: JSON.stringify({ reply: "The live box is three storeys." }),
      }),
    );
    expect(call.tool).toBe("explain");
    expect(call.arguments.reply).toBe("The live box is three storeys.");
  });

  test("reads OpenAI tool_calls", () => {
    const call = parseMasterCall("", {
      tool_calls: [
        {
          function: {
            name: "read_drawing",
            arguments: JSON.stringify({ reply: "A three-storey gable house." }),
          },
        },
      ],
    });
    expect(call.tool).toBe("read_drawing");
  });
});
