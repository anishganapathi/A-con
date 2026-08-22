import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { forgetDrawings, recentDrawings, rememberDrawings } from "./referenceDrawings";

/** A stand-in for sessionStorage, optionally with a byte ceiling like the real one. */
function fakeStorage(limit = Number.POSITIVE_INFINITY) {
  const cells = new Map<string, string>();
  return {
    getItem: (key: string) => cells.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (value.length > limit) {
        throw new Error("QuotaExceededError");
      }
      cells.set(key, value);
    },
    removeItem: (key: string) => {
      cells.delete(key);
    },
  };
}

const sheet = (name: string, body: string) => ({
  name,
  type: "image/png",
  size: 1024,
  dataUrl: `data:image/png;base64,${body}`,
});

describe("referenceDrawings", () => {
  beforeEach(() => {
    forgetDrawings();
  });

  test("keeps an uploaded drawing so it outlives the agent turn", () => {
    rememberDrawings([sheet("plan.png", "aaa")]);

    expect(recentDrawings()).toHaveLength(1);
    expect(recentDrawings()[0].name).toBe("plan.png");
  });

  test("ignores attachments the model could not see", () => {
    rememberDrawings([{ name: "plan.dwg", type: "image/vnd.dwg", size: 10 }]);
    rememberDrawings(undefined);

    expect(recentDrawings()).toEqual([]);
  });

  test("puts the newest sheet first, since that is what was just built from", () => {
    rememberDrawings([sheet("first.png", "aaa")]);
    rememberDrawings([sheet("second.png", "bbb")]);

    expect(recentDrawings().map((entry) => entry.name)).toEqual([
      "second.png",
      "first.png",
    ]);
  });

  test("re-uploading the same sheet moves it up rather than listing it twice", () => {
    rememberDrawings([sheet("first.png", "aaa")]);
    rememberDrawings([sheet("second.png", "bbb")]);
    rememberDrawings([sheet("first.png", "aaa")]);

    expect(recentDrawings().map((entry) => entry.name)).toEqual([
      "first.png",
      "second.png",
    ]);
  });

  test("holds a bounded number of sheets so base64 does not pile up", () => {
    for (let index = 0; index < 9; index += 1) {
      rememberDrawings([sheet(`sheet-${index}.png`, `body-${index}`)]);
    }

    expect(recentDrawings()).toHaveLength(6);
    expect(recentDrawings()[0].name).toBe("sheet-8.png");
  });

  test("gives every sheet in one upload its own id", () => {
    rememberDrawings([sheet("ground.png", "aaa"), sheet("first.png", "bbb")]);

    const [ground, first] = recentDrawings();
    expect(ground.id).not.toBe(first.id);
  });

  test("works when there is no session storage at all", () => {
    // Node, and the desktop main process, have none.
    expect(() => rememberDrawings([sheet("plan.png", "aaa")])).not.toThrow();
    expect(recentDrawings()).toHaveLength(1);
  });
});

describe("referenceDrawings across a reload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test("comes back after the page is reloaded", async () => {
    vi.stubGlobal("sessionStorage", fakeStorage());

    vi.resetModules();
    const before = await import("./referenceDrawings");
    before.forgetDrawings();
    before.rememberDrawings([sheet("test-2.png", "aaa")]);

    // A fresh module registry is what a reload leaves behind.
    vi.resetModules();
    const after = await import("./referenceDrawings");

    expect(after.recentDrawings().map((entry) => entry.name)).toEqual(["test-2.png"]);
  });

  test("keeps the newest sheet when the quota rejects the whole set", async () => {
    const oneSheet = 400;
    vi.stubGlobal("sessionStorage", fakeStorage(oneSheet));

    vi.resetModules();
    const store = await import("./referenceDrawings");
    store.forgetDrawings();
    store.rememberDrawings([sheet("old.png", "a".repeat(150))]);
    store.rememberDrawings([sheet("new.png", "b".repeat(150))]);

    vi.resetModules();
    const reloaded = await import("./referenceDrawings");

    expect(reloaded.recentDrawings().map((entry) => entry.name)).toEqual(["new.png"]);
  });

  test("ignores a stored blob that is not a drawing", async () => {
    const storage = fakeStorage();
    storage.setItem("econ-reference-drawings", JSON.stringify([{ id: "x" }, "junk"]));
    vi.stubGlobal("sessionStorage", storage);

    vi.resetModules();
    const store = await import("./referenceDrawings");

    expect(store.recentDrawings()).toEqual([]);
  });
});
