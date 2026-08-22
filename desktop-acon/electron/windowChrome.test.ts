import { describe, expect, test } from "vitest";
import { windowChrome } from "./windowChrome.ts";

describe("windowChrome", () => {
  test("hides the native title on macOS so the light title bar can host traffic lights", () => {
    expect(windowChrome("darwin")).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
    });
  });

  test("leaves the native title bar on other platforms", () => {
    expect(windowChrome("win32")).toEqual({});
    expect(windowChrome("linux")).toEqual({});
  });
});
