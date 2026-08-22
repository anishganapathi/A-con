import { describe, expect, test } from "vitest";
import { electronEnv } from "./electronEnv.mjs";

describe("electronEnv", () => {
  // Editors built on Electron (VS Code, Cursor) export ELECTRON_RUN_AS_NODE to
  // their terminals. Inherited, it makes the child Electron boot as plain Node,
  // where require("electron") returns the binary path instead of the API.
  test("drops ELECTRON_RUN_AS_NODE", () => {
    const env = electronEnv({ ELECTRON_RUN_AS_NODE: "1", KEEP: "yes" });

    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
    expect(env.KEEP).toBe("yes");
  });

  test("drops the editor's own IPC and entrypoint hooks", () => {
    const env = electronEnv({
      VSCODE_IPC_HOOK: "/tmp/sock",
      VSCODE_ESM_ENTRYPOINT: "vs/workbench/api/node/extensionHostProcess",
      VSCODE_NLS_CONFIG: "{}",
      VSCODE_CWD: "/",
    });

    expect(Object.keys(env)).toEqual([]);
  });

  test("keeps everything else, including provider keys", () => {
    const env = electronEnv({ REPLICATE_API_TOKEN: "r8_abc", PATH: "/usr/bin" });

    expect(env).toEqual({ REPLICATE_API_TOKEN: "r8_abc", PATH: "/usr/bin" });
  });

  test("adds the overrides it is given", () => {
    expect(electronEnv({ PATH: "/usr/bin" }, { ACON_SMOKE: "1" })).toEqual({
      PATH: "/usr/bin",
      ACON_SMOKE: "1",
    });
  });

  test("lets an override win over the inherited value", () => {
    expect(electronEnv({ NODE_ENV: "test" }, { NODE_ENV: "development" }).NODE_ENV).toBe(
      "development",
    );
  });

  test("defaults to the current process environment", () => {
    expect(electronEnv().PATH).toBe(process.env.PATH);
  });
});
