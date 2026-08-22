import { describe, expect, test } from "vitest";
import { contentType, resolveStaticPath } from "./static.ts";

const ROOT = "/app/renderer";

describe("resolveStaticPath", () => {
  test("serves the shell for the root URL", () => {
    expect(resolveStaticPath(ROOT, "/")).toBe("/app/renderer/index.html");
  });

  test("maps an asset path to a file inside the root", () => {
    expect(resolveStaticPath(ROOT, "/assets/index-abc.js")).toBe(
      "/app/renderer/assets/index-abc.js",
    );
  });

  test("drops a query string before resolving", () => {
    expect(resolveStaticPath(ROOT, "/assets/app.css?v=2")).toBe(
      "/app/renderer/assets/app.css",
    );
  });

  test("drops a hash before resolving", () => {
    expect(resolveStaticPath(ROOT, "/favicon.svg#icon")).toBe("/app/renderer/favicon.svg");
  });

  test("decodes a percent-encoded name", () => {
    expect(resolveStaticPath(ROOT, "/assets/my%20font.woff2")).toBe(
      "/app/renderer/assets/my font.woff2",
    );
  });

  test("falls back to the shell for a route with no file extension", () => {
    expect(resolveStaticPath(ROOT, "/inspector")).toBe("/app/renderer/index.html");
  });

  // A packaged app serves from the user's disk, so a crafted URL must not be
  // able to read outside the bundled renderer.
  test("refuses to escape the root with dot segments", () => {
    expect(resolveStaticPath(ROOT, "/../../etc/passwd")).toBeNull();
  });

  test("refuses to escape the root when the traversal is encoded", () => {
    expect(resolveStaticPath(ROOT, "/..%2f..%2fetc%2fpasswd")).toBeNull();
  });

  test("refuses a nested traversal that climbs past the root", () => {
    expect(resolveStaticPath(ROOT, "/assets/../../../secrets.txt")).toBeNull();
  });

  test("allows a dot segment that stays inside the root", () => {
    expect(resolveStaticPath(ROOT, "/assets/../index.html")).toBe(
      "/app/renderer/index.html",
    );
  });

  test("rejects a malformed escape rather than throwing", () => {
    expect(resolveStaticPath(ROOT, "/%E0%A4%A")).toBeNull();
  });
});

describe("contentType", () => {
  test.each([
    ["/app/index.html", "text/html; charset=utf-8"],
    ["/app/assets/index.js", "text/javascript; charset=utf-8"],
    ["/app/assets/index.css", "text/css; charset=utf-8"],
    ["/app/favicon.svg", "image/svg+xml"],
    ["/app/assets/model.glb", "model/gltf-binary"],
    ["/app/assets/tex.png", "image/png"],
    ["/app/assets/font.woff2", "font/woff2"],
    ["/app/assets/data.json", "application/json; charset=utf-8"],
  ])("types %s", (path, expected) => {
    expect(contentType(path)).toBe(expected);
  });

  test("falls back to a byte stream for an unknown extension", () => {
    expect(contentType("/app/assets/thing.xyz")).toBe("application/octet-stream");
  });
});
