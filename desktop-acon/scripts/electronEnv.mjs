/**
 * Electron-based editors export ELECTRON_RUN_AS_NODE=1 and their own IPC hooks
 * into integrated terminals. A child Electron that inherits them starts as a
 * plain Node process — no app, no window — so they are stripped before launch.
 */
const STRIPPED = ["ELECTRON_RUN_AS_NODE", "VSCODE_IPC_HOOK", "VSCODE_ESM_ENTRYPOINT"];

export function electronEnv(source = process.env, overrides = {}) {
  const env = {};
  for (const [key, value] of Object.entries(source)) {
    if (STRIPPED.includes(key) || key.startsWith("VSCODE_")) {
      continue;
    }
    env[key] = value;
  }
  return { ...env, ...overrides };
}
