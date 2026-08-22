import { describe, expect, test } from "vitest";
import type { FloorPlan } from "../types/floorPlan";
import { normalizeSpec, type BuildingSpec } from "./buildingSpec";
import { compileSpec } from "./compileSpec";
import { applySpecChoice, buildSpecQuestions, type SpecQuestion } from "./specOptions";

function draft(overrides: Partial<BuildingSpec> = {}): BuildingSpec {
  return normalizeSpec({
    name: "Clinic",
    typology: "civic",
    width: 40,
    depth: 30,
    stories: 3,
    storyHeight: 4,
    ...overrides,
  });
}

function extent(ring: { x: number; y: number }[]) {
  const xs = ring.map((point) => point.x);
  const ys = ring.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...ys) - Math.min(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
}

describe("buildSpecQuestions", () => {
  test("does not ask when the plate was read from a drawing", () => {
    expect(buildSpecQuestions(draft({ measured: true }))).toEqual([]);
  });

  test("asks for footprint, height, then windows in that order", () => {
    expect(buildSpecQuestions(draft()).map((question) => question.id)).toEqual([
      "footprint",
      "height",
      "windows",
    ]);
  });

  test("offers exactly three options per question", () => {
    for (const question of buildSpecQuestions(draft())) {
      expect(question.options).toHaveLength(3);
    }
  });

  test("puts the model's own size in the middle as the suggestion", () => {
    const [footprint] = buildSpecQuestions(draft({ width: 40, depth: 30 }));
    const middle = footprint.options[1];

    expect(middle.patch.width).toBe(40);
    expect(middle.patch.depth).toBe(30);
    expect(middle.recommended).toBe(true);
  });

  test("orders footprint options from smallest to largest", () => {
    const [footprint] = buildSpecQuestions(draft());
    const areas = footprint.options.map(
      (option) => (option.patch.width ?? 0) * (option.patch.depth ?? 0),
    );

    expect(areas[0]).toBeLessThan(areas[1]);
    expect(areas[1]).toBeLessThan(areas[2]);
  });

  test("keeps the model's storey count as the suggested height", () => {
    const height = buildSpecQuestions(draft({ stories: 3 }))[1];

    expect(height.options[1].patch.stories).toBe(3);
    expect(height.options[0].patch.stories).toBeLessThan(3);
    expect(height.options[2].patch.stories).toBeGreaterThan(3);
  });

  test("never offers fewer than one storey", () => {
    const height = buildSpecQuestions(draft({ stories: 1 }))[1];

    for (const option of height.options) {
      expect(option.patch.stories).toBeGreaterThanOrEqual(1);
    }
  });

  test("labels whichever height matches the proposal as the suggestion", () => {
    // A single-storey draft has no room beneath it, so the trio shifts upward
    // and the suggestion is no longer the middle option.
    const height = buildSpecQuestions(draft({ stories: 1 }))[1];
    const suggested = height.options.filter((option) => option.recommended);

    expect(suggested).toHaveLength(1);
    expect(suggested[0].patch.stories).toBe(1);
    expect(suggested[0].label).toContain("Suggested");
  });

  test("gives three distinct heights even for a one-storey draft", () => {
    const height = buildSpecQuestions(draft({ stories: 1 }))[1];
    const stories = height.options.map((option) => option.patch.stories);

    expect(new Set(stories).size).toBe(3);
  });

  test("offers window sizes that fit under the storey height", () => {
    const windows = buildSpecQuestions(draft({ storyHeight: 3 }))[2];

    for (const option of windows.options) {
      const glazing = option.patch.windows!;
      expect(glazing.height + glazing.sillHeight).toBeLessThan(3);
    }
  });

  test("orders window options from smallest to largest", () => {
    const windows = buildSpecQuestions(draft())[2];
    const areas = windows.options.map(
      (option) => option.patch.windows!.width * option.patch.windows!.height,
    );

    expect(areas[0]).toBeLessThan(areas[1]);
    expect(areas[1]).toBeLessThan(areas[2]);
  });

  test("every option is labelled with its measurements", () => {
    for (const question of buildSpecQuestions(draft())) {
      for (const option of question.options) {
        expect(option.label).toMatch(/\d/);
        expect(option.id).toBeTruthy();
      }
    }
  });

  test("does not question a surveyed building, whose envelope is measured", () => {
    const surveyed = draft({
      survey: {
        provider: "NYC Open Data",
        address: "350 5th Ave",
        bbl: "1008350001",
        bin: "1015250",
        yearBuilt: 1931,
        bldgClass: "O4",
        latitude: 40.7484,
        longitude: -73.9857,
        heightEstimated: false,
        attribution: "NYC Open Data",
      },
    });

    expect(buildSpecQuestions(surveyed)).toEqual([]);
  });
});

describe("applySpecChoice", () => {
  test("resizes the plate to the chosen footprint", () => {
    const next = applySpecChoice(draft(), { width: 60, depth: 45 });

    expect(next.width).toBe(60);
    expect(next.depth).toBe(45);
  });

  test("scales a model-authored outline so the choice is not ignored", () => {
    // compileSpec builds the plate from `footprint` when present, so resizing
    // width/depth alone would silently do nothing.
    const shaped = draft({
      footprint: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
        { x: 0, y: 30 },
      ],
    });

    const next = applySpecChoice(shaped, { width: 20, depth: 15 });
    const ring = extent(next.footprint!);

    expect(ring.width).toBeCloseTo(20, 1);
    expect(ring.depth).toBeCloseTo(15, 1);
  });

  test("keeps a scaled outline anchored at the origin", () => {
    const shaped = draft({
      footprint: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
        { x: 0, y: 30 },
      ],
    });

    const ring = extent(applySpecChoice(shaped, { width: 80, depth: 60 }).footprint!);

    expect(ring.minX).toBeCloseTo(0, 5);
    expect(ring.minY).toBeCloseTo(0, 5);
  });

  test("preserves the shape of a non-rectangular outline", () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 15 },
      { x: 20, y: 15 },
      { x: 20, y: 30 },
      { x: 0, y: 30 },
    ];
    const next = applySpecChoice(draft({ footprint: lShape }), {
      width: 20,
      depth: 15,
    });

    expect(next.footprint).toHaveLength(6);
    // The notch stayed at the same fraction of the plate.
    expect(next.footprint![3].x / 20).toBeCloseTo(20 / 40, 2);
  });

  test("scales massing bands with the outline so setbacks still line up", () => {
    const shaped = draft({
      footprint: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
        { x: 0, y: 30 },
      ],
      massing: [
        {
          id: "band-1",
          minHeight: 0,
          maxHeight: 12,
          roofShape: null,
          roofHeight: 0,
          polygon: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 30 },
            { x: 0, y: 30 },
          ],
        },
      ],
    });

    const next = applySpecChoice(shaped, { width: 20, depth: 15 });

    expect(extent(next.massing![0].polygon).width).toBeCloseTo(20, 1);
  });

  test("leaves the outline alone when only the height changes", () => {
    const shaped = draft({
      footprint: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
        { x: 0, y: 30 },
      ],
    });

    const next = applySpecChoice(shaped, { stories: 8 });

    expect(next.stories).toBe(8);
    expect(extent(next.footprint!).width).toBeCloseTo(40, 5);
  });

  test("carries the chosen glazing through", () => {
    const next = applySpecChoice(draft(), {
      windows: { width: 2.4, height: 1.8, sillHeight: 0.9 },
    });

    expect(next.windows).toEqual({ width: 2.4, height: 1.8, sillHeight: 0.9 });
  });

  test("does not mutate the spec it was given", () => {
    const original = draft();
    applySpecChoice(original, { width: 99, depth: 99 });

    expect(original.width).toBe(40);
  });
});

/** Answering every question the way the chat panel does, then compiling. */
function answerAll(spec: BuildingSpec, pick: (question: SpecQuestion) => number): FloorPlan {
  let next = spec;
  for (const question of buildSpecQuestions(spec)) {
    next = applySpecChoice(next, question.options[pick(question)].patch);
  }
  return compileSpec(next);
}

function planExtent(plan: FloorPlan) {
  const points = plan.floors.flatMap((floor) =>
    floor.walls.flatMap((wall) => [wall.start, wall.end]),
  );
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...ys) - Math.min(...ys),
  };
}

describe("answers reaching the compiled plan", () => {
  test("the compact answer builds a smaller plate than the generous one", () => {
    const compact = planExtent(answerAll(draft(), () => 0));
    const generous = planExtent(answerAll(draft(), () => 2));

    expect(compact.width).toBeLessThan(generous.width);
    expect(compact.depth).toBeLessThan(generous.depth);
  });

  test("a footprint answer survives a model-authored outline", () => {
    const shaped = draft({
      footprint: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
        { x: 0, y: 30 },
      ],
    });

    const compact = planExtent(answerAll(shaped, () => 0));

    expect(compact.width).toBeLessThan(40);
  });

  test("the taller answer stacks more floors", () => {
    expect(answerAll(draft(), () => 2).floors.length).toBeGreaterThan(
      answerAll(draft(), () => 0).floors.length,
    );
  });

  test("the chosen glazing is what gets cut into the walls", () => {
    const questions = buildSpecQuestions(draft());
    const chosen = questions[2].options[2].patch.windows!;
    const plan = answerAll(draft(), (question) => (question.id === "windows" ? 2 : 1));
    const windows = plan.floors
      .flatMap((floor) => floor.openings)
      .filter((opening) => opening.type === "window");

    expect(windows.length).toBeGreaterThan(0);
    for (const window of windows) {
      expect(window.width).toBe(chosen.width);
      expect(window.height).toBe(chosen.height);
    }
  });
});
