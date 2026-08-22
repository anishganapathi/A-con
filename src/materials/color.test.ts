import { describe, expect, test } from "vitest";
import { mixHex, shadeHex } from "./color";

describe("mixHex", () => {
  test("returns the first colour at zero", () => {
    expect(mixHex("#9c4a35", "#0d1418", 0)).toBe("#9c4a35");
  });

  test("returns the second colour at one", () => {
    expect(mixHex("#9c4a35", "#0d1418", 1)).toBe("#0d1418");
  });

  test("meets in the middle", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  test("clamps a ratio below zero", () => {
    expect(mixHex("#112233", "#ffffff", -2)).toBe("#112233");
  });

  test("clamps a ratio above one", () => {
    expect(mixHex("#112233", "#ffffff", 9)).toBe("#ffffff");
  });

  test("accepts uppercase hex", () => {
    expect(mixHex("#FFFFFF", "#FFFFFF", 0.5)).toBe("#ffffff");
  });

  test("always returns six-digit hex", () => {
    expect(mixHex("#010203", "#040506", 0.5)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("shadeHex", () => {
  // A fifth of the way to white from mid grey: 128 + (255 - 128) × 0.2.
  test("lightens on a positive amount", () => {
    expect(shadeHex("#808080", 0.2)).toBe("#999999");
  });

  test("darkens on a negative amount", () => {
    expect(shadeHex("#808080", -0.2)).toBe("#666666");
  });

  test("stops at white", () => {
    expect(shadeHex("#ffffff", 0.5)).toBe("#ffffff");
  });

  test("stops at black", () => {
    expect(shadeHex("#000000", -0.5)).toBe("#000000");
  });

  test("leaves the colour alone at zero", () => {
    expect(shadeHex("#3f5c4f", 0)).toBe("#3f5c4f");
  });
});
