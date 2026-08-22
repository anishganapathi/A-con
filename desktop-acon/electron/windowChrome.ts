import type { BrowserWindowConstructorOptions } from "electron";

/**
 * Hiro-style window chrome: on macOS the native title is hidden and the
 * traffic lights sit in the custom light title bar. Other platforms keep
 * their standard title bar.
 */
export function windowChrome(
  platform: NodeJS.Platform,
): Pick<BrowserWindowConstructorOptions, "titleBarStyle" | "trafficLightPosition"> {
  if (platform !== "darwin") {
    return {};
  }
  return {
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
  };
}
