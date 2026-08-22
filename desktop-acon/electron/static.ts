import { extname, join, posix, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".hdr": "image/vnd.radiance",
  ".exr": "image/x-exr",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Maps a request path to a file inside the bundled renderer. Returns null when
 * the path tries to climb out of the root — a packaged app is reading the
 * user's own disk, so the root has to be enforced rather than assumed.
 */
export function resolveStaticPath(root: string, urlPath: string): string | null {
  const bare = urlPath.split("?")[0].split("#")[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    return null;
  }
  if (decoded === "/" || decoded === "") {
    return join(root, "index.html");
  }

  // Normalised as a path relative to the root, so a leading `..` survives and
  // can be refused. Normalising the absolute form would silently swallow it and
  // serve some other file instead.
  const relative = posix.normalize(decoded.replace(/^\/+/, ""));
  if (relative === ".." || relative.startsWith("../")) {
    return null;
  }
  const target = resolve(root, relative);
  const base = resolve(root);
  if (target !== base && !target.startsWith(base + sep)) {
    return null;
  }
  // Client routes have no file extension; the shell handles them.
  return extname(target) ? target : join(root, "index.html");
}

export function contentType(path: string): string {
  return TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}
